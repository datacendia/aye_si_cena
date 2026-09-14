import type { Metadata } from "next";
import { requireCan, CAN } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { menu } from "@/lib/repo/menu";
import { soldDishes } from "@/lib/repo/quotes";
import { engineer, bleeding, BOX_LABEL, BOX_ADVICE, type Box } from "@/lib/engineering";
import { soles, FOOD_COST_TARGET } from "@/lib/pricing";

export const metadata: Metadata = { title: "What sells" };

const ORDER: Box[] = ["star", "ploughhorse", "puzzle", "dog"];

const TONE: Record<Box, string> = {
  star: "border-good",
  ploughhorse: "border-warn",
  puzzle: "border-thistle",
  dog: "border-line"
};

/**
 * The four-box matrix, built from two numbers that are almost never in the same
 * place.
 *
 * Popularity comes from quote_dishes joined to won quotes — dishes people
 * actually chose and paid for. Margin comes from the recipe through
 * lib/costing.ts, priced with whatever has been verified at the market. In an
 * ordinary kitchen the first lives in a till and the second in a folder, and
 * putting them beside each other is a week of somebody's evenings.
 *
 * Owner only, and not merely because it carries cost: the whole page is a set
 * of decisions about what to stop cooking.
 */
export default async function EngineeringPage() {
  const me = await requireCan(CAN.seeMoney, "see what sells and what it earns");
  const t = await loadCopy(me.locale);
  const dishes = await menu(me.locale);
  const matrix = engineer(dishes, await soldDishes(me));
  const bleed = bleeding(matrix);
  const es = me.locale === "es";

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("eng.heading")}
        </h1>
        <p className="mt-4 max-w-3xl text-ink-2">{t("eng.lede")}</p>
        {matrix.totalCovers > 0 && (
          <p className="mt-3 font-mono text-sm text-ink-3">
            <span className="tnum">{matrix.totalCovers}</span> {t("eng.covers")} ·{" "}
            <span className="tnum">{matrix.rows.length}</span> dishes ·{" "}
            {t("eng.margin")} {soles(matrix.marginLine)}
          </p>
        )}
      </section>

      {matrix.rows.length === 0 ? (
        <section className="py-10">
          <p className="text-ink-2">{t("eng.nothingYet")}</p>
        </section>
      ) : (
        <>
          {bleed.length > 0 && (
            <section className="mt-8 rounded-xl border border-bad bg-bad/5 p-5">
              <h2 className="font-display text-xl font-semibold tracking-tight text-bad">
                {t("eng.bleeding")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-ink-2">{t("eng.bleedingLede")}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {bleed.map((r) => (
                  <li key={r.dish.id} className="flex flex-wrap items-baseline gap-x-3">
                    <span>{r.dish.name}</span>
                    <span className="tnum font-mono text-[11px] text-bad">
                      {(r.foodCost * 100).toFixed(0)}%
                    </span>
                    <span className="tnum font-mono text-[11px] text-ink-3">
                      {r.covers} {t("eng.covers")}
                    </span>
                    <span className="tnum font-mono text-[11px] text-ink-3">
                      {soles(r.margin)} {t("eng.margin")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-ink-3">
                target {(FOOD_COST_TARGET.min * 100).toFixed(0)}–
                {(FOOD_COST_TARGET.max * 100).toFixed(0)}%
              </p>
            </section>
          )}

          <section className="grid gap-5 py-10 lg:grid-cols-2">
            {ORDER.map((box) => {
              const rows = matrix.rows.filter((r) => r.box === box);
              return (
                <div key={box} className={`rounded-xl border ${TONE[box]} bg-surface p-5`}>
                  <h2 className="font-display text-2xl font-semibold tracking-tight">
                    {es ? BOX_LABEL[box].es : BOX_LABEL[box].en}
                    <span className="ml-2 font-mono text-sm font-normal text-ink-3">
                      {rows.length}
                    </span>
                  </h2>
                  <p className="mt-1.5 text-sm text-ink-2">
                    {es ? BOX_ADVICE[box].es : BOX_ADVICE[box].en}
                  </p>

                  {rows.length === 0 ? (
                    <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                      —
                    </p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[380px] border-collapse text-sm">
                        <caption className="sr-only">
                          {es ? BOX_LABEL[box].es : BOX_LABEL[box].en}
                        </caption>
                        <thead>
                          <tr className="border-b border-line text-left font-mono text-[10px]
                                         uppercase tracking-wider text-ink-3">
                            <th scope="col" className="py-1.5 pr-3 font-normal">·</th>
                            <th scope="col" className="py-1.5 pr-3 text-right font-normal">
                              {t("eng.covers")}
                            </th>
                            <th scope="col" className="py-1.5 pr-3 text-right font-normal">
                              {t("eng.margin")}
                            </th>
                            <th scope="col" className="py-1.5 text-right font-normal">
                              {t("eng.contribution")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {rows.slice(0, 12).map((r) => (
                            <tr key={r.dish.id}>
                              <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                                {r.dish.name}
                              </th>
                              <td className="tnum py-1.5 pr-3 text-right text-ink-2">
                                {r.covers}
                              </td>
                              <td className="tnum py-1.5 pr-3 text-right">{soles(r.margin)}</td>
                              <td className="tnum py-1.5 text-right font-medium">
                                {soles(r.contribution)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {rows.length > 12 && (
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-3">
                          +{rows.length - 12}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {matrix.neverQuoted.length > 0 && (
            <section className="border-t border-line py-10">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {t("eng.neverQuoted")}
                <span className="ml-2 font-mono text-sm font-normal text-ink-3">
                  {matrix.neverQuoted.length}
                </span>
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-ink-2">{t("eng.neverQuotedLede")}</p>
              <p className="mt-4 text-sm text-ink-3">
                {matrix.neverQuoted.slice(0, 40).map((d) => d.name).join(" · ")}
                {matrix.neverQuoted.length > 40 && ` · +${matrix.neverQuoted.length - 40}`}
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
