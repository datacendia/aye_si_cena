"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PUBLIC_LOCALE_COOKIE } from "@/lib/public-locale";

/**
 * A visitor's language, kept on their machine.
 *
 * A year, because somebody who reads the site in English this month will want
 * it in English next month. httpOnly: nothing on the page needs to read it and
 * it is one less thing a script can touch; sameSite lax so it survives arriving
 * from a WhatsApp link.
 */
export async function setPublicLocale(locale: "es" | "en") {
  const jar = await cookies();
  jar.set(PUBLIC_LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax"
  });
  revalidatePath("/", "layout");
}
