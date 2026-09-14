/**
 * What a supplier is doing to you, over months rather than receipts.
 *
 * Every verified price is kept — recording a new one supersedes the last rather
 * than overwriting it — so the table already holds the answer to a question
 * nobody was asking it: butter was S/32 in March and is S/41 now, and nothing
 * in the app had ever said so.
 *
 * This is the whole point of the superseding design. A single receipt is
 * unreadable: S/41 for butter looks like the price of butter. It only becomes
 * information beside the S/32 you paid in March, and it only becomes urgent
 * when you can see that 47 dishes carry it.
 *
 * Pure functions, no database: lib/repo/prices.ts fetches the rows and this
 * reasons about them, so every case below is tested without one.
 */
import type { Dish, Recipe } from "./dishes";
import { canonicalIngredient } from "./ingredient-key";

export interface PriceReading {
  ingredientKey: string;
  soles: number;
  per: string;
  verifiedAt: Date;
  source: string | null;
}

export interface Drift {
  ingredientKey: string;
  /** Oldest kept reading. */
  first: { soles: number; at: Date; source: string | null };
  /** What it is now. */
  latest: { soles: number; at: Date; source: string | null };
  /** Signed fraction: 0.28 is 28% dearer than it was. */
  change: number;
  /** Whole days between the two readings. Zero when they are the same day. */
  days: number;
  /** How many readings that fraction is built on. Two is thin evidence. */
  readings: number;
  /** Dishes whose recipe names this ingredient. What the drift actually costs. */
  dishIds: number[];
  /** The shipped estimate, when there is one, so a bad estimate is visible too. */
  estimate: number | null;
}

/** Below this, a change is noise and a page listing it is noise. */
export const MATERIAL = 0.05;

const DAY = 86_400_000;

/**
 * Group readings by ingredient and measure what happened.
 *
 * Only keys with two or more readings appear: a single price is not a trend,
 * and presenting it as one would be the most misleading thing this page could
 * do. A key priced twice on the same day gives `days: 0`, which the screen
 * reads as "not yet a rate" rather than as an infinite one.
 */
export function drift(
  readings: PriceReading[],
  opts: { dishesByIngredient?: Map<string, number[]>; estimates?: Record<string, number> } = {}
): Drift[] {
  const byKey = new Map<string, PriceReading[]>();
  for (const r of readings) {
    const key = canonicalIngredient(r.ingredientKey);
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(r);
  }

  const out: Drift[] = [];
  for (const [key, rows] of byKey) {
    if (rows.length < 2) continue;

    const sorted = [...rows].sort((a, b) => a.verifiedAt.getTime() - b.verifiedAt.getTime());
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];

    /*
     * Comparing prices in different units would be arithmetic on nonsense — S/41
     * per kilo against S/4 per bunch is not a 90% fall. A unit change is a real
     * thing that happens (a supplier switches from bunches to kilos), and the
     * honest answer then is to say nothing rather than to invent a number.
     */
    if (first.per !== latest.per) continue;
    if (!(first.soles > 0)) continue;

    out.push({
      ingredientKey: key,
      first: { soles: first.soles, at: first.verifiedAt, source: first.source },
      latest: { soles: latest.soles, at: latest.verifiedAt, source: latest.source },
      change: (latest.soles - first.soles) / first.soles,
      days: Math.floor((latest.verifiedAt.getTime() - first.verifiedAt.getTime()) / DAY),
      readings: sorted.length,
      dishIds: opts.dishesByIngredient?.get(key) ?? [],
      estimate: opts.estimates?.[key] ?? null
    });
  }

  // Biggest rise first: that is the one costing money today. A fall is good news
  // and can wait until the bottom of the page.
  return out.sort((a, b) => b.change - a.change);
}

/** Only the movements worth a person's attention. */
export function material(drifts: Drift[], threshold = MATERIAL): Drift[] {
  return drifts.filter((d) => Math.abs(d.change) >= threshold);
}

/**
 * Which dishes name each ingredient.
 *
 * Built from the recipes through the same canonicaliser the price book uses, so
 * "Cold Butter" in a recipe line and "butter" in the price table are the same
 * thing here — which is the only reason a drift can say how many dishes it
 * touches.
 */
export function dishesByIngredient(
  recipes: Recipe[], dishes: Dish[]
): Map<string, number[]> {
  const live = new Set(dishes.map((d) => d.id));
  const out = new Map<string, number[]>();

  for (const r of recipes) {
    if (!live.has(r.dishId)) continue;
    const seen = new Set<string>();
    for (const line of r.ingredients) {
      const key = canonicalIngredient(line.item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      (out.get(key) ?? out.set(key, []).get(key)!).push(r.dishId);
    }
  }
  return out;
}

/**
 * Change per thirty days, for readings far enough apart to mean it.
 *
 * Null under a fortnight: a 6% rise over three days is far more likely to be
 * one stall having a bad week than a rate, and annualising it would produce a
 * number that is both alarming and false.
 */
export function monthlyRate(d: Drift): number | null {
  if (d.days < 14) return null;
  return d.change * (30 / d.days);
}
