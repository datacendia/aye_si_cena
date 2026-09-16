/**
 * Which dishes a tier can actually carry.
 *
 * Three of the five tiers come from the spreadsheet: every dish has a `tiers`
 * column saying whether it works as a box, on a buffet, or plated. Two do not,
 * and deliberately so.
 *
 * "Wee Feast" and "The Ceilidh Table" are derived from what a dish already says
 * about itself — its diet suitability, its licence flag, its format. The
 * alternative was a sixth and seventh column in the spreadsheet, re-typed for
 * 223 rows and then re-typed again every time a recipe changed. This repository
 * has already shipped one hand-maintained column that drifted out of step with
 * the recipes it described: the allergen column, which disagreed with its own
 * recipe on 165 of 223 dishes. A rule cannot drift.
 *
 * The rules, and why each clause is there:
 *
 *   Wee Feast      kid-friendly per lib/dietary.ts, works as a box, and carries
 *                  no alcohol at all. The licence clause is absolute — cooking
 *                  with alcohol is legal without the giro especial, but nothing
 *                  containing it goes to a room full of eight-year-olds.
 *
 *   Ceilidh Table  anything that can be plated. The top tier is not a narrower
 *                  menu, it is a longer one and more people serving it.
 */
import type { Dish, ServiceTier } from "./dishes";
import { dietaryIndex } from "./dietary";
import type { Recipe } from "./dishes";

/** Tiers the spreadsheet's `tiers` column answers for directly. */
export const SPREADSHEET_TIERS = ["scran", "buffet", "plated"] as const;

/** Tiers worked out from the dish itself. */
export const DERIVED_TIERS = ["ninos", "ceilidh"] as const;

export type DerivedTier = (typeof DERIVED_TIERS)[number];

export function isDerived(tier: ServiceTier): tier is DerivedTier {
  return (DERIVED_TIERS as readonly string[]).includes(tier);
}

/**
 * Whether one dish belongs to one tier.
 *
 * `recipes` is only consulted for the derived tiers, so the common path costs
 * nothing. Pass the index in when filtering a whole menu — building it per dish
 * would walk all 223 recipes 223 times.
 */
export function dishFitsTier(
  dish: Dish,
  tier: ServiceTier,
  index?: Map<number, { suits: string[]; unknown: string[] }>
): boolean {
  if (tier === "ceilidh") return dish.tiers.includes("plated");

  if (tier === "ninos") {
    if (!dish.tiers.includes("scran")) return false;
    // Absolute: nothing with alcohol in it, whatever the licence position.
    if (dish.needsLicence) return false;
    const entry = index?.get(dish.id);
    if (!entry) return false;
    // A dish with an unclassified ingredient claims nothing. Offering it to
    // children because nothing contradicted it is how somebody gets hurt.
    if (entry.unknown.length > 0) return false;
    return entry.suits.includes("kid-friendly");
  }

  return dish.tiers.includes(tier);
}

/** Every dish a tier can carry. The one place any screen should ask. */
export function dishesForTier(
  dishes: Dish[], tier: ServiceTier, recipes: Recipe[]
): Dish[] {
  const index = isDerived(tier)
    ? (dietaryIndex(recipes) as unknown as Map<number, { suits: string[]; unknown: string[] }>)
    : undefined;
  return dishes.filter((d) => dishFitsTier(d, tier, index));
}

/**
 * How many dishes each tier can carry, in one pass.
 *
 * The packages screens all want this and the naive version builds the dietary
 * index once per tier.
 */
export function tierCounts(
  dishes: Dish[], tiers: readonly ServiceTier[], recipes: Recipe[]
): Record<string, number> {
  const index = dietaryIndex(recipes) as unknown as
    Map<number, { suits: string[]; unknown: string[] }>;
  const out: Record<string, number> = {};
  for (const tier of tiers) {
    out[tier] = dishes.filter((d) => dishFitsTier(d, tier, index)).length;
  }
  return out;
}

/**
 * Dish ids per tier, for a client component.
 *
 * Compare.tsx and MenuBuilder.tsx both need to know which dishes a tier can
 * carry, and neither can work it out: the derived tiers read the dietary index,
 * which reads all 223 recipes, and shipping those to the browser to answer a
 * filter would be several hundred kilobytes to save a server round trip that
 * has already happened.
 *
 * So the server resolves it once and hands over the ids.
 */
export function eligibleIdsByTier(
  dishes: Dish[], tiers: readonly ServiceTier[], recipes: Recipe[]
): Record<string, number[]> {
  const index = dietaryIndex(recipes) as unknown as
    Map<number, { suits: string[]; unknown: string[] }>;
  const out: Record<string, number[]> = {};
  for (const tier of tiers) {
    out[tier] = dishes.filter((d) => dishFitsTier(d, tier, index)).map((d) => d.id);
  }
  return out;
}
