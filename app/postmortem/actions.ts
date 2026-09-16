"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/session";
import { recordActuals } from "@/lib/repo/actuals";
import { issueShare, revokeShare } from "@/lib/repo/pack";
import { blank } from "@/lib/forms";

const Form = z.object({
  foodSpend: blank(z.coerce.number().nonnegative()),
  staffSpend: blank(z.coerce.number().nonnegative()),
  transportSpend: blank(z.coerce.number().nonnegative()),
  otherSpend: blank(z.coerce.number().nonnegative()),
  guestsServed: blank(z.coerce.number().int().positive()),
  note: blank(z.string().max(500))
});

export async function saveActuals(
  bookingId: string, _prev: string | undefined, form: FormData
) {
  const me = await requireViewer();
  const parsed = Form.safeParse(Object.fromEntries(form));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "That did not look right.";

  try {
    await recordActuals(me, { bookingId, ...parsed.data });
  } catch (err) {
    return err instanceof Error ? err.message : "Could not record that.";
  }
  revalidatePath("/postmortem");
  return "saved";
}

/** The client link for one booking. Returns the URL once, never again. */
export async function shareBooking(bookingId: string): Promise<{ url: string } | string> {
  const me = await requireViewer();
  try {
    const { token } = await issueShare(me, bookingId);
    const base = (process.env.AUTH_URL ?? "").replace(/\/+$/, "");
    return { url: `${base}/evento/${token}` };
  } catch (err) {
    return err instanceof Error ? err.message : "Could not make a link.";
  }
}

export async function unshareBooking(bookingId: string) {
  const me = await requireViewer();
  await revokeShare(me, bookingId);
  revalidatePath("/postmortem");
}
