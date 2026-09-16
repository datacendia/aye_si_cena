import { requireCan, CAN } from "@/lib/session";
import type { Metadata } from "next";
import { menu } from "@/lib/repo/menu";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/dishes";
import { loadCopy, categoryLabel } from "@/lib/copy";
import { foodCostRatio, marginFlag, soles } from "@/lib/pricing";

export const metadata: Metadata = { title: "The matrix" };



const FLAG_STYLE = {
  "on-target": "text-good",
  under: "text-warn",
  over: "text-bad"
} as const;

export default async function MenuPage() {
  const me = await requireCan(CAN.seeMoney, "see the matrix, which carries every cost and margin");
  const dishes = await menu(me.locale);
  const t = await loadCopy(me.locale);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          The matrix
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Every dish with its lineage, its food cost and its menu value. The{" "}
          <span className="font-mono text-xs text-thistle">purple</span> half is the British
          original; the <span className="font-mono text-xs text-aji">gold</span> half is what Peru
          does to it.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-ink-3">
          FC% is food cost as a share of menu value. Anything above 30% is flagged — it is eating
          margin and needs repricing or a cheaper spec.
        </p>
      </section>

      {CATEGORY_ORDER.map((cat) => {
        const rows = dishes.filter((d) => d.category === cat);
        return (
          <section key={cat} className="py-10">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {categoryLabel(t, cat, CATEGORY_LABEL[cat])}
              </h2>
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink-3">
                {rows.length}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="bg-raised">
                    <th className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      #
                    </th>
                    <th className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      Dish
                    </th>
                    <th className="px-3 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      Cost
                    </th>
                    <th className="px-3 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      Menu value
                    </th>
                    <th className="px-3 py-3 text-right font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      FC%
                    </th>
                    <th className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const flag = marginFlag(d);
                    return (
                      <tr key={d.id} className="border-t border-line align-top">
                        <td className="px-3 py-3 font-mono text-xs text-ink-3">{d.id}</td>
                        <td className="px-3 py-3">
                          <span className="block font-bold leading-tight">{d.name}</span>
                          <span className="mt-1 block text-sm text-ink-2">{d.fusion}</span>
                          <span className="mt-1.5 block text-xs">
                            <span className="font-bold text-thistle">{d.origin}</span>
                            <span className="text-ink-3"> → </span>
                            <span className="font-bold text-aji">{d.subOrigin}</span>
                          </span>
                        </td>
                        <td className="tnum whitespace-nowrap px-3 py-3 text-right font-mono text-sm text-ink-2">
                          {soles(d.cost)}
                        </td>
                        <td className="tnum whitespace-nowrap px-3 py-3 text-right font-mono text-sm font-semibold">
                          {soles(d.price)}
                        </td>
                        <td
                          className={`tnum whitespace-nowrap px-3 py-3 text-right font-mono text-xs ${FLAG_STYLE[flag]}`}
                        >
                          {(foodCostRatio(d) * 100).toFixed(0)}%
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-ink-3">
                          {d.source}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
