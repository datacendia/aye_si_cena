import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { readerLocale } from "@/lib/public-locale";
import { publicMenu } from "@/lib/public";
import { MOMENTS } from "@/data/moments";
import { matchesEvent } from "@/lib/dishes";
import { WHATSAPP_HREF } from "../contact";

export const metadata: Metadata = {
  title: "By the moment",
  description:
    "An arrival canapé and a late-night bite are not the same job. What works " +
    "for each moment of an event."
};

/**
 * The same menu, organised by the moment rather than by the course.
 *
 * This is the page that does the most selling, because it is the one that shows
 * you have thought about the event rather than about the food. An arrival
 * canapé is eaten with one hand while the other holds a drink; a late bite is
 * eaten standing up at midnight by somebody who has been drinking for five
 * hours. Those are different problems and the matrix already knows which dishes
 * solve which.
 *
 * Rendered on the server as plain lists: no filter state, nothing to hydrate,
 * and it works with JavaScript off — which for a shop window is worth more than
 * interactivity.
 */
export default async function EventosPage() {
  if (await viewer()) redirect("/moments");

  const locale = await readerLocale();
  const t = await loadCopy(locale);
  const dishes = await publicMenu(locale);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("pub.eventsHeading")}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">{t("pub.eventsLede")}</p>
      </section>

      {MOMENTS.map((moment) => {
        const fits = dishes.filter((d) => matchesEvent(d, moment.filter));
        if (fits.length === 0) return null;

        return (
          <section key={moment.id} className="border-b border-line py-10">
            <div className="flex flex-wrap items-baseline gap-x-4">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {moment.name}
              </h2>
              <span className="tnum font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {fits.length} {t("pub.dishes")}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-ink-2">{moment.blurb}</p>

            <ul className="mt-5 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {fits.slice(0, 12).map((d) => (
                <li key={d.id} className="text-sm text-ink-2">
                  <span className="text-ink">{d.name}</span>
                  {d.allergens.length === 0 && (
                    <span className="ml-2 font-mono text-[10px] uppercase text-good">
                      {t("pub.noneDeclarable")}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {fits.length > 12 && (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                +{fits.length - 12}
              </p>
            )}
          </section>
        );
      })}

      <section className="py-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{t("pub.contact")}</h2>
        <p className="mt-3 max-w-2xl text-ink-2">{t("pub.contactLede")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={WHATSAPP_HREF}
            className="rounded-lg bg-ink px-5 py-3 text-sm font-bold text-bg hover:opacity-90"
          >
            {t("pub.whatsapp")}
          </a>
          <Link
            href="/paquetes"
            className="rounded-lg border border-line px-5 py-3 text-sm font-bold hover:border-ink-3"
          >
            {t("pub.seePackages")}
          </Link>
        </div>
      </section>
    </>
  );
}
