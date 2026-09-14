"use client";

import { useMemo, useState } from "react";
import type { Dish, ServiceTier } from "@/lib/dishes";
import { buildQuote, TIERS, soles } from "@/lib/pricing";

const TIER_IDS: ServiceTier[] = ["scran", "buffet", "plated"];

/**
 * The Compare port, used commercially: one guest count, the same intent,
 * costed across all three tiers so a client sees what the money buys rather
 * than being told.
 */
export default function Compare({ dishes }: { dishes: Dish[] }) {
  const [guests, setGuests] = useState(30);

  // A representative menu per tier: the cheapest-margin dishes available at
  // that tier, one per course, so the comparison is like-for-like in shape.
  const menus = useMemo(() => {
    const out = {} as Record<ServiceTier, Dish[]>;
    for (const tier of TIER_IDS) {
      const pool = dishes.filter((d) => d.tiers.includes(tier));
      const picked: Dish[] = [];
      for (const cat of ["canape", "main", "side", "dessert"] as const) {
        const best = pool
          .filter((d) => d.category === cat)
          .sort((a, b) => a.cost / a.price - b.cost / b.price)[0];
        if (best) picked.push(best);
      }
      out[tier] = picked;
    }
    return out;
  }, [dishes]);

  const quotes = useMemo(
    () =>
      TIER_IDS.map((tier) => {
        try {
          return { tier, quote: buildQuote({ dishes: menus[tier], guests, tier }) };
        } catch {
          return { tier, quote: null };
        }
      }),
    [menus, guests]
  );

  return (
    <div>
      <div className="mb-8">
        <label
          htmlFor="compare-guests"
          className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-ink-3"
        >
          Guests
        </label>
        <input
          id="compare-guests"
          type="number"
          min={1}
          max={500}
          value={guests}
          onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
          className="tnum w-32 rounded-lg border border-line bg-surface px-3 py-2 font-mono"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {quotes.map(({ tier, quote }) => {
          const rules = TIERS[tier];
          return (
            <div key={tier} className="flex flex-col rounded-xl border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-semibold">{rules.name}</h2>
              <p className="mt-1 font-mono text-[11px] text-ink-3">
                min {rules.minGuests} guests
              </p>

              {!quote ? (
                <p className="mt-4 text-sm text-ink-2">Not available at this head count.</p>
              ) : (
                <>
                  <p className="tnum mt-4 font-mono text-3xl font-semibold">
                    {soles(quote.netPerGuest)}
                  </p>
                  <p className="font-mono text-[11px] text-ink-3">per guest, net of IGV</p>

                  {quote.warnings.length > 0 && (
                    <p className="mt-3 rounded border-l-2 border-warn bg-raised p-2 text-[11px] text-warn">
                      {quote.warnings[0]}
                    </p>
                  )}

                  <dl className="mt-4 space-y-1 font-mono text-[11px]">
                    <Row label="Food" value={soles(quote.foodCostPerGuest)} />
                    <Row label="Service" value={soles(quote.serviceCostPerGuest)} />
                    <Row label={`Total · ${guests}`} value={soles(quote.netTotal)} strong />
                    <Row label="Client pays inc. IGV" value={soles(quote.grossTotal)} strong />
                  </dl>

                  <div className="mt-5 border-t border-line pt-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      What lands on the table
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-ink-2">
                      {menus[tier].map((d) => (
                        <li key={d.id}>{d.name}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-ink-2">
                      {rules.menajePerGuest > 0 ? "Hired china and glassware. " : "Boxed, no china. "}
                      {rules.guestsPerWaiter > 0
                        ? `Waiting staff, 1 per ${rules.guestsPerWaiter}.`
                        : "No staff on site."}
                    </p>
                  </div>

                  <p className="tnum mt-auto pt-5 font-mono text-xs text-good">
                    You keep {soles(quote.contributionTotal)} (
                    {(quote.contributionRatio * 100).toFixed(0)}%)
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-3 ${
        strong ? "border-t border-line pt-1 font-semibold text-ink" : "text-ink-2"
      }`}
    >
      <dt>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}
