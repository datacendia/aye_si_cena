/**
 * Prices somebody actually verified, standing over the stall.
 *
 * data/prices.ts stays the seed and the fallback. A row here supersedes one
 * key, so a market run on Tuesday morning reaches every device on Tuesday
 * afternoon instead of waiting for a rebuild and a redistributed file.
 *
 * Rows are never edited in place. Recording a new price marks the previous one
 * not-current and inserts a fresh row, so what you paid for butter in March is
 * still answerable in September - which is the only way to see a supplier
 * drifting upwards.
 */
import { and, desc, eq } from "drizzle-orm";
import { db, priceOverrides, users } from "@/db";
import { canonicalIngredient } from "@/lib/ingredient-key";
import { ESTIMATES, type PriceBook } from "@/lib/costing";
import type { Price } from "@/lib/costing";
import { CAN, assertCan } from "@/lib/permissions";
import type { Viewer } from "@/lib/session";
import { drift, dishesByIngredient, type Drift } from "@/lib/drift";
import { RECIPES } from "@/data/recipes";
import { DISHES } from "@/data/dishes";

export interface VerifiedPrice {
  id: string;
  ingredientKey: string;
  soles: number;
  per: string;
  unitGrams: number | null;
  source: string | null;
  note: string | null;
  verifiedAt: Date;
  verifiedByName: string | null;
  /** The shipped estimate, for comparison. Null if the key is not in data/prices.ts. */
  estimate: number | null;
}

/** Every current override, newest first. */
export async function listVerifiedPrices(): Promise<VerifiedPrice[]> {
  const rows = await db
    .select({ p: priceOverrides, who: users.name })
    .from(priceOverrides)
    .leftJoin(users, eq(users.id, priceOverrides.verifiedBy))
    .where(eq(priceOverrides.current, true))
    .orderBy(desc(priceOverrides.verifiedAt));

  return rows.map((r) => ({
    ...r.p,
    verifiedByName: r.who,
    estimate: ESTIMATES.food[r.p.ingredientKey]?.soles ?? null
  }));
}

/**
 * The price book to cost with: the estimates, with every verified price laid
 * over the top.
 */
export async function priceBook(): Promise<PriceBook> {
  const verified = await listVerifiedPrices();
  if (verified.length === 0) return ESTIMATES;

  const food: Record<string, Price> = { ...ESTIMATES.food };
  for (const v of verified) {
    food[v.ingredientKey] = {
      per: v.per as Price["per"],
      soles: v.soles,
      ...(v.unitGrams ? { unitGrams: v.unitGrams } : {}),
      ...(v.note ? { note: v.note } : {})
    };
  }
  return { ...ESTIMATES, food };
}

export interface PriceInput {
  ingredientKey: string;
  soles: number;
  per: string;
  unitGrams?: number | null;
  source?: string | null;
  note?: string | null;
}

/** Record what was actually paid. A chef buys too, so a chef may. */
export async function recordPrice(me: Viewer, input: PriceInput): Promise<void> {
  assertCan(CAN.writePrices, me.role, "record a verified price");

  /*
   * The key has to name something the recipes actually buy, or the row sits in
   * the table forever matching nothing and the price you wrote down never
   * reaches a dish. This is the same rule the vedas learned the hard way.
   *
   * The first version of this check compared the input to its own canonical
   * form, which passes anything already lower-case: "buttter" canonicalises to
   * "buttter", so a typo was accepted in silence. Membership of the price book
   * is the question worth asking.
   */
  const key = canonicalIngredient(input.ingredientKey);
  const known = ESTIMATES.food[key] ?? ESTIMATES.sub[key] ?? ESTIMATES.nonFood[key];
  if (!known) {
    const near = Object.keys(ESTIMATES.food)
      .filter((k) => k.includes(key.slice(0, 4)) || key.includes(k.slice(0, 4)))
      .slice(0, 3);
    throw new Error(
      `"${input.ingredientKey}" is not an ingredient the recipes name, so a price ` +
      `for it would never reach a dish.` +
      (near.length ? ` Did you mean ${near.map((n) => `"${n}"`).join(", ")}?` : "")
    );
  }
  if (!(input.soles > 0)) throw new Error("A price has to be more than zero.");

  await db.update(priceOverrides)
    .set({ current: false })
    .where(and(eq(priceOverrides.ingredientKey, key), eq(priceOverrides.current, true)));

  await db.insert(priceOverrides).values({
    ingredientKey: key,
    soles: input.soles,
    per: input.per,
    unitGrams: input.unitGrams ?? null,
    source: input.source ?? null,
    note: input.note ?? null,
    verifiedBy: me.id
  });
}

/** Drop back to the shipped estimate for one key. */
export async function forgetPrice(me: Viewer, ingredientKey: string): Promise<void> {
  assertCan(CAN.writePrices, me.role, "remove a verified price");
  await db.update(priceOverrides)
    .set({ current: false })
    .where(and(eq(priceOverrides.ingredientKey, ingredientKey), eq(priceOverrides.current, true)));
}

/** What has been bought for this key over time, newest first. */
export async function priceHistory(ingredientKey: string) {
  return db.select().from(priceOverrides)
    .where(eq(priceOverrides.ingredientKey, ingredientKey))
    .orderBy(desc(priceOverrides.verifiedAt));
}

/**
 * Every price you have recorded more than once, and what has happened since.
 *
 * The rows have been accumulating since the first market run — this is the
 * first thing to read them. One query for the whole table rather than one per
 * key: there are a few hundred rows at most, and a round trip per ingredient on
 * a free tier that sleeps is the difference between a page and a wait.
 */
export async function priceDrift(): Promise<Drift[]> {
  const rows = await db.select().from(priceOverrides).orderBy(priceOverrides.verifiedAt);

  const estimates = Object.fromEntries(
    Object.entries(ESTIMATES.food).map(([k, v]) => [k, v.soles])
  );

  return drift(
    rows.map((r) => ({
      ingredientKey: r.ingredientKey,
      soles: r.soles,
      per: r.per,
      verifiedAt: r.verifiedAt,
      source: r.source
    })),
    { dishesByIngredient: dishesByIngredient(RECIPES, DISHES), estimates }
  );
}
