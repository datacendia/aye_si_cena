/**
 * Which language a visitor with no account is reading.
 *
 * Signed-in people carry a locale on their user row, because that is a setting
 * they own and it should follow them between devices. A stranger has no row, so
 * the choice lives in a cookie on their machine and nowhere else.
 *
 * The default is Spanish. The customers are in Lima; the English is for the
 * Scottish half of the story and for anyone who arrives from abroad.
 */
import { cookies } from "next/headers";
import type { Locale } from "./copy";

export const PUBLIC_LOCALE_COOKIE = "lang";

export async function publicLocale(): Promise<Locale> {
  const jar = await cookies();
  return jar.get(PUBLIC_LOCALE_COOKIE)?.value === "en" ? "en" : "es";
}
