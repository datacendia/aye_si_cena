"use server";

import { redirect } from "next/navigation";
import { redeemReset } from "@/lib/repo/passwords";

/**
 * No session is required here, and that is the point: somebody who cannot sign
 * in is exactly who needs this page. The link itself is the authority — one
 * hour, one use, and only its SHA-256 is stored.
 */
export async function setNewPassword(
  token: string, _prev: string | undefined, form: FormData
) {
  const next = String(form.get("next") ?? "");
  if (next !== String(form.get("confirm") ?? "")) {
    return "The two new passwords are not the same.";
  }
  try {
    await redeemReset(token, next);
  } catch (err) {
    return err instanceof Error ? err.message : "Could not set that password.";
  }
  redirect("/login?reset=done");
}
