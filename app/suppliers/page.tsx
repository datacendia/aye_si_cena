import type { Metadata } from "next";
import { requireCan, CAN } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { priceDrift } from "@/lib/repo/prices";
import { suppliers, notable, NOTABLE } from "@/lib/suppliers";
import { db, priceOverrides } from "@/db";
import { dishesByIngredient } from "@/lib/drift";
import { RECIPES } from "@/data/recipes";
import { menu } from "@/lib/repo/menu";
import { soles } from "@/lib/pricing";

export const metadata: Metadata = { title: "Stalls" };

/**
 * Who is putting your prices up.
 *
 * /prices answers what is rising. This answers who, and they are different
 * questions with opposite answers: a market problem you absorb or reprice, a
 * supplier problem you walk across the aisle about. The column that makes it
 * possible — `source` on every verified price — has been filled in since the
 * first market run and read by nothing.
 */
export default async function SuppliersPage() {
  const me = await requireCan(CAN.writePrices, "see the supplier record");
  const t = await loadCopy(me.locale);

  const dishes = await menu(me.locale);
  const rows = await db.select().from(priceOverrides).orderBy(priceOverrides.verifiedAt);
  const lines = suppliers(
    rows.map((r) => ({
      ingredientKey: r.ingredientKey, soles: r.soles, per: r.per,
      verifiedAt: r.verifiedAt, source: r.source
    })),
    { dishesByIngredient: dishesByIngredient(RECIPES, dishes) }
  );
  const moving = notable(lines);

  // Only read to check there is anything at all to talk about.
  const anyDrift = (await priceDrift()).length;

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("sup.heading")}
        </h1>
        <p className="mt-4 max-w-3xl text-ink-2">{t("sup.lede")}</p>
      </section>

      <section className="py-10">
        {lines.length === 0 ? (
          <p className="text-ink-2">{t("sup.needTwo")}</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lines.map((l) => {
              const rate = l.monthlyChange;
              const up = rate !== null && rate > 0;
              const flagged = moving.includes(l);

              return (
                <div
                  key={l.source}
                  className={`rounded-xl border bg-surface p-5 ${
                    flagged && up ? "border-bad" : flagged ? "border-good" : "border-line"
                  }`}
                >
                  <h2 className="font-display text-xl font-semibold tracking-tight">
                    {l.source}
                  </h2>

                  {rate === null ? (
                    <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                      {t("sup.thin")}
                    </p>
                  ) : (
                    <p className="mt-3">
                      <span
                        className={`tnum font-display text-3xl font-semibold ${
                          up ? "text-bad" : "text-good"
                        }`}
                      >
                        {up ? "+" : ""}{(rate * 100).toFixed(1)}%
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-ink-3">
                        {t("sup.perMonth")}
                      </span>
                    </p>
                  )}

                  <p className="mt-3 font-mono text-[11px] text-ink-3">
                    <span className="tnum">{l.tracked}</span> {t("sup.tracked")} ·{" "}
                    <span className="tnum">{l.readings}</span> · {l.span}d
                    {l.falling > 0 && (
                      <span className="text-good"> · {l.falling} {t("sup.falling")}</span>
                    )}
                  </p>

                  {l.worst && (
                    <p className="mt-3 border-t border-line pt-3 text-sm">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                        {t("sup.worst")}
                      </span>{" "}
                      <span className="text-ink-2">{l.worst.ingredientKey}</span>{" "}
                      <span className="tnum text-ink-3">
                        {soles(l.worst.first.soles)} → {soles(l.worst.latest.soles)}
                      </span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-ink-3">
          {lines.length - moving.length} under {(NOTABLE * 100).toFixed(0)}% · {anyDrift} tracked
        </p>
      </section>
    </>
  );
}
