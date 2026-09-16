import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { publicLocale } from "@/lib/public-locale";
import { publicMenu, publicPackages } from "@/lib/public";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/dishes";
import { categoryLabel } from "@/lib/copy";
import { WHATSAPP_HREF } from "./contact";

export const metadata: Metadata = {
  title: { absolute: "Aye, Si, Cena — Scottish-Peruvian catering in Lima" },
  description:
    "Glasgow technique run through the Lima pantry. Canapés, buffets and plated " +
    "dinners for events anywhere in Lima, with every allergen read off the recipe."
};

/**
 * The front door.
 *
 * Until now every page in this app required a login, which meant a stranger who
 * heard about the business and typed the address in got a password box. That is
 * the correct answer for a cost matrix and the wrong one for a catering
 * company: what a customer needs to see is the food.
 *
 * So the money moved behind the login and the menu came out in front of it.
 * Nothing on this page or the three beside it touches lib/repo directly; they
 * all read lib/public.ts, which builds each dish by picking fields rather than
 * dropping them — so a field added to `Dish` next spring reaches the internet
 * only when somebody puts it on the list on purpose.
 *
 * Signed-in staff are sent to /panel, so the front door is right for whoever
 * opens it.
 */
export default async function PublicHome() {
  if (await viewer()) redirect("/panel");

  const locale = await publicLocale();
  const t = await loadCopy(locale);
  const dishes = await publicMenu(locale);
  const packages = await publicPackages(locale);

  const counts = CATEGORY_ORDER.map((c) => ({
    label: categoryLabel(t, c, CATEGORY_LABEL[c]),
    n: dishes.filter((d) => d.category === c).length
  }));

  const cheapest = packages.reduce(
    (low, p) => (p.fromPerGuest > 0 && p.fromPerGuest < low ? p.fromPerGuest : low),
    Infinity
  );

  return (
    <>
      <section className="border-b border-line py-16 sm:py-24">
        <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
          {t("pub.tagline")}
        </p>
        <h1 className="font-display text-5xl font-semibold leading-none tracking-tight sm:text-7xl">
          Aye, <span className="text-aji">Si</span>, Cena.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-2">{t("pub.hero")}</p>
        <p className="mt-4 max-w-xl text-ink-2">{t("pub.heroLede")}</p>

        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/carta"
            className="rounded-lg bg-ink px-5 py-3 text-sm font-bold text-bg hover:opacity-90"
          >
            {t("pub.seeMenu")} · {dishes.length} {t("pub.dishes")}
          </Link>
          <Link
            href="/paquetes"
            className="rounded-lg border border-line px-5 py-3 text-sm font-bold hover:border-ink-3"
          >
            {t("pub.seePackages")}
            {Number.isFinite(cheapest) && (
              <span className="tnum ml-2 font-mono text-xs text-ink-3">
                {t("pub.pkgFrom")} S/ {cheapest}
              </span>
            )}
          </Link>
        </div>

        <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 font-mono text-xs text-ink-3">
          {counts.map((c) => (
            <div key={c.label}>
              <dt className="inline text-ink-2">{c.label}</dt>{" "}
              <dd className="tnum inline font-semibold text-ink">{c.n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-b border-line py-14">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          {t("pub.pkgHeading")}
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">{t("pub.pkgLede")}</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {packages.map((p) => (
            <div key={p.id} className="rounded-xl border border-line bg-surface p-6">
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              {p.fromPerGuest > 0 && (
                <p className="mt-3">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                    {t("pub.pkgFrom")}
                  </span>{" "}
                  <span className="tnum font-display text-3xl font-semibold">
                    S/ {p.fromPerGuest}
                  </span>
                  <span className="block font-mono text-[11px] text-ink-3">
                    {t("pub.pkgPerGuest")}
                  </span>
                </p>
              )}
              <p className="mt-3 font-mono text-xs text-ink-3">
                {t("pub.pkgMinimum")} {p.minGuests} {t("pub.pkgGuests")}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6">
          <Link href="/paquetes" className="text-sm text-aji underline hover:text-ink">
            {t("pub.seePackages")} →
          </Link>
        </p>
      </section>

      <section className="py-14">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          {t("pub.allergens")}
        </h2>
        <p className="mt-3 max-w-2xl text-ink-2">{t("pub.allergensLede")}</p>

        <h2 className="mt-12 font-display text-3xl font-semibold tracking-tight">
          {t("pub.contact")}
        </h2>
        <p className="mt-3 max-w-2xl text-ink-2">{t("pub.contactLede")}</p>
        <a
          href={WHATSAPP_HREF}
          className="mt-5 inline-block rounded-lg bg-ink px-5 py-3 text-sm font-bold text-bg
                     hover:opacity-90"
        >
          {t("pub.whatsapp")}
        </a>
      </section>
    </>
  );
}
