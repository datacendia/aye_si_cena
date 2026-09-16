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

/**
 * The language of whoever is actually reading, signed in or not.
 *
 * Every public page must use this rather than publicLocale() directly. A
 * signed-in person has a locale on their user row — a setting they own, that
 * follows them between devices — and a cookie that has nothing to do with it.
 * Reading the cookie for them produced a page where the header said English and
 * the body was in Spanish, which is how a chef whose account is English ended
 * up scanning a box and getting Spanish.
 *
 * The account wins. The cookie is the answer for people who have no account,
 * which is most readers of these pages and none of the staff.
 */
export async function readerLocale(): Promise<Locale> {
  const { viewer } = await import("./session");
  const me = await viewer();
  return me?.locale ?? (await publicLocale());
}
