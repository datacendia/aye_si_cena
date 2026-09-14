"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/session";
import { saveCopy, revertCopy, saveDishEdit, revertDish } from "@/lib/repo/copy";
import { issueReset, setActive } from "@/lib/repo/passwords";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Both languages or nothing. The refusal lives in the repository so it cannot
 * be skipped by a second caller; this only carries the message back.
 */
export async function updateCopy(key: string, _prev: string | undefined, form: FormData) {
  const me = await requireViewer();
  try {
    await saveCopy(me, key, String(form.get("en") ?? ""), String(form.get("es") ?? ""));
  } catch (err) {
    return err instanceof Error ? err.message : "Could not save that.";
  }
  revalidatePath("/", "layout");
  return "saved";
}

export async function resetCopy(key: string) {
  const me = await requireViewer();
  await revertCopy(me, key);
  revalidatePath("/", "layout");
}

const DishForm = z.object({
  name: z.string().max(160).nullish(),
  nameEs: z.string().max(160).nullish(),
  fusion: z.string().max(1200).nullish(),
  fusionEs: z.string().max(1200).nullish(),
  price: z.coerce.number().nullish().or(z.literal("").transform(() => null)),
  category: z.string().max(40).nullish(),
  needsLicence: z.coerce.boolean().nullish()
});

export async function updateDish(dishId: number, _prev: string | undefined, form: FormData) {
  const me = await requireViewer();
  const parsed = DishForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "That did not look right.";
  try {
    await saveDishEdit(me, { dishId, ...parsed.data, price: parsed.data.price ?? null });
  } catch (err) {
    return err instanceof Error ? err.message : "Could not save that dish.";
  }
  revalidatePath("/", "layout");
  return "saved";
}

export async function resetDish(dishId: number) {
  const me = await requireViewer();
  await revertDish(me, dishId);
  revalidatePath("/", "layout");
}

/** Which language this person reads. Stored on the account, not in a cookie. */
export async function setLocale(locale: "es" | "en") {
  const me = await requireViewer();
  await db.update(users).set({ locale }).where(eq(users.id, me.id));
  revalidatePath("/", "layout");
}

/* ─────────────────────────────── logins ─────────────────────────────── */

/**
 * Issue a one-hour, one-use link for somebody to set their own password.
 *
 * The absolute URL is built here rather than in the browser because the owner
 * is going to paste it into WhatsApp, and a path on its own is not something
 * you can send anyone. AUTH_URL is the deployment's own address, which is
 * already required for Auth.js to work at all.
 */
export async function issueResetLink(userId: string): Promise<{ url: string } | string> {
  const me = await requireViewer();
  try {
    const { token } = await issueReset(me, userId);
    const base = (process.env.AUTH_URL ?? "").replace(/\/+$/, "");
    return { url: `${base}/reset/${token}` };
  } catch (err) {
    return err instanceof Error ? err.message : "Could not issue a link.";
  }
}

export async function toggleAccount(userId: string, active: boolean) {
  const me = await requireViewer();
  await setActive(me, userId, active);
  revalidatePath("/admin");
}
