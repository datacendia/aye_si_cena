/**
 * What each stall is doing to you.
 *
 * Every verified price already records where it was bought — `source` on
 * price_overrides, "Surquillo N.1", "Terminal Pesquero VMT". Nothing had ever
 * read that column back, so the app could tell you butter was up 28% and not
 * that every one of those readings came from the same stall.
 *
 * That is the difference between a market problem and a supplier problem, and
 * they have opposite answers: a market problem you absorb or reprice, a
 * supplier problem you walk across the aisle about. lib/drift.ts answers the
 * first question. This answers the second.
 *
 * Pure, so every case below is tested without a database.
 */
import type { PriceReading } from "./drift";
import { drift, type Drift } from "./drift";

export interface SupplierLine {
  source: string;
  /** Ingredients you have priced there more than once. */
  tracked: number;
  /** Total readings, so a line built on two visits is visibly thin. */
  readings: number;
  /**
   * Weighted average monthly change across everything tracked, as a fraction.
   * Weighted by how many dishes carry the ingredient, so a stall that has put
   * up butter matters more than one that has put up mace.
   */
  monthlyChange: number | null;
  /** The worst single movement, for the sentence a person will actually read. */
  worst: Drift | null;
  /** Ingredients that have fallen — a supplier undercutting is news too. */
  falling: number;
  /** Days between the oldest and newest reading at this stall. */
  span: number;
}

const DAY = 86_400_000;

/**
 * Group readings by where they were bought and measure each stall.
 *
 * A reading with no source is not attributed to anybody: "unknown" as a
 * supplier would be the largest line on the page and would mean nothing. They
 * still count towards lib/drift.ts, which asks a different question.
 */
export function suppliers(
  readings: PriceReading[],
  opts: { dishesByIngredient?: Map<string, number[]> } = {}
): SupplierLine[] {
  const byStall = new Map<string, PriceReading[]>();
  for (const r of readings) {
    const source = r.source?.trim();
    if (!source) continue;
    (byStall.get(source) ?? byStall.set(source, []).get(source)!).push(r);
  }

  const out: SupplierLine[] = [];
  for (const [source, rows] of byStall) {
    const movements = drift(rows, opts);
    if (movements.length === 0) {
      out.push({
        source, tracked: 0, readings: rows.length,
        monthlyChange: null, worst: null, falling: 0, span: spanOf(rows)
      });
      continue;
    }

    /*
     * Weighted by dish reach, not a flat mean.
     *
     * A stall that has put butter up 20% has done far more damage than one that
     * has put mace up 20%, because 47 dishes carry butter and two carry mace.
     * A flat average says they are the same, which is the kind of number that
     * gets somebody to renegotiate the wrong contract.
     */
    let weighted = 0;
    let weight = 0;
    for (const m of movements) {
      const rate = monthly(m);
      if (rate === null) continue;
      const w = Math.max(1, m.dishIds.length);
      weighted += rate * w;
      weight += w;
    }

    out.push({
      source,
      tracked: movements.length,
      readings: rows.length,
      monthlyChange: weight > 0 ? weighted / weight : null,
      worst: movements[0] ?? null,
      falling: movements.filter((m) => m.change < 0).length,
      span: spanOf(rows)
    });
  }

  // Worst first: the stall costing you money is the one to read about.
  return out.sort((a, b) => (b.monthlyChange ?? -Infinity) - (a.monthlyChange ?? -Infinity));
}

/** Change per thirty days, null under a fortnight. Same rule as lib/drift.ts. */
function monthly(d: Drift): number | null {
  if (d.days < 14) return null;
  return d.change * (30 / d.days);
}

function spanOf(rows: PriceReading[]): number {
  if (rows.length < 2) return 0;
  const times = rows.map((r) => r.verifiedAt.getTime());
  return Math.floor((Math.max(...times) - Math.min(...times)) / DAY);
}

/** Stalls worth a conversation: moving more than this a month, either way. */
export const NOTABLE = 0.02;

export function notable(lines: SupplierLine[], threshold = NOTABLE): SupplierLine[] {
  return lines.filter((l) => l.monthlyChange !== null && Math.abs(l.monthlyChange) >= threshold);
}
