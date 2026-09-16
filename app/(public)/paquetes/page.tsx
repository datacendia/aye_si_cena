import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { publicLocale } from "@/lib/public-locale";
import { publicPackages } from "@/lib/public";
import { WHATSAPP_HREF } from "../contact";

export const metadata: Metadata = {
  title: "What it costs",
  description:
    "Three levels of service from one kitchen, with a per-guest figure to " +
    "start from — IGV included."
};

/**
 * What it costs, for somebody deciding whether to ring.
 *
 * The internal /packages page carries the cost structure: what a waiter shift
 * costs, what a chef shift costs, what the van costs, what the menaje costs per
 * head. None of that is on this page and none of it is in the payload — this
 * reads publicPackages(), which runs the real pricing engine on the server and
 * returns one rounded per-guest number per tier.
 *
 * Rounded UP to the nearest S/5, deliberately. A "from" price that every actual
 * quote then has to exceed is worse than publishing no price at all.
 */
export default async function PaquetesPage() {
  if (await viewer()) redirect("/packages");

  const locale = await publicLocale();
  const t = await loadCopy(locale);
  const packages = await publicPackages(locale);
  const es = locale === "es";

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("pub.pkgHeading")}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">{t("pub.pkgLede")}</p>
      </section>

      <section className="grid gap-5 py-10 lg:grid-cols-3">
        {packages.map((p) => (
          <div key={p.id} className="flex flex-col rounded-xl border border-line bg-surface p-6">
            <h2 className="font-display text-2xl font-semibold tracking-tight">{p.name}</h2>

            {p.fromPerGuest > 0 && (
              <p className="mt-4">
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                  {t("pub.pkgFrom")}
                </span>{" "}
                <span className="tnum font-display text-4xl font-semibold">
                  S/ {p.fromPerGuest}
                </span>
                <span className="mt-1 block font-mono text-[11px] text-ink-3">
                  {t("pub.pkgPerGuest")}
                </span>
              </p>
            )}

            <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-2">
              {p.includes.map((line) => (
                <li key={line.en} className="relative pl-5">
                  <span aria-hidden="true" className="absolute left-0 text-aji">·</span>
                  {es ? line.es : line.en}
                </li>
              ))}
            </ul>

            <dl className="mt-6 border-t border-line pt-4 font-mono text-[11px] text-ink-3">
              <div className="flex justify-between py-0.5">
                <dt>{t("pub.pkgMinimum")}</dt>
                <dd className="tnum text-ink-2">{p.minGuests} {t("pub.pkgGuests")}</dd>
              </div>
              <div className="flex justify-between py-0.5">
                <dt>{t("pub.pkgAvailable")}</dt>
                <dd className="tnum text-ink-2">{p.dishes}</dd>
              </div>
            </dl>
          </div>
        ))}
      </section>

      <section className="border-t border-line py-10">
        <p className="max-w-2xl text-sm text-ink-2">{t("pub.pkgLicence")}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={WHATSAPP_HREF}
            className="rounded-lg bg-ink px-5 py-3 text-sm font-bold text-bg hover:opacity-90"
          >
            {t("pub.whatsapp")}
          </a>
          <Link
            href="/carta"
            className="rounded-lg border border-line px-5 py-3 text-sm font-bold hover:border-ink-3"
          >
            {t("pub.seeMenu")}
          </Link>
        </div>
      </section>
    </>
  );
}
