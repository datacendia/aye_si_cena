"use server";

import { requireViewer } from "@/lib/session";
import { changeOwnPassword } from "@/lib/repo/passwords";

export async function changePassword(_prev: string | undefined, form: FormData) {
  const me = await requireViewer();
  const next = String(form.get("next") ?? "");

  if (next !== String(form.get("confirm") ?? "")) {
    return "The two new passwords are not the same.";
  }
  try {
    await changeOwnPassword(me, String(form.get("current") ?? ""), next);
  } catch (err) {
    return err instanceof Error ? err.message : "Could not change it.";
  }
  return "changed";
}
