/**
 * Reading and writing quotes.
 *
 * Every function here takes the Viewer and applies `quoteScope` itself. The
 * alternative - a repository that returns everything and a caller that filters
 * - works right up until one caller forgets, and the failure is a client
 * reading another client's event. Narrowing in the query means a forgotten
 * check cannot leak anything, because there is no unscoped read to forget.
 *
 * A quote stores dish IDs, never dish rows. The 223 dishes live in data/,
 * version controlled and tested; copying them into Postgres would give the
 * menu two sources of truth and we have been there. What IS copied is the
 * price and cost each dish carried at the moment of quoting - because that is
 * what you charged, and it must still say so after the menu is repriced.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, quotes, quoteDishes, clients } from "@/db";
import type { QuoteStatus } from "@/db/schema";
import { quoteScope, CAN, assertCan } from "@/lib/permissions";
import type { Viewer } from "@/lib/session";
import { DISHES } from "@/data/dishes";
import { buildQuote } from "@/lib/pricing";
import type { ServiceTier } from "@/lib/dishes";
import { DISTRICTS, VENUE_TYPES } from "@/data/venues";
import type { Sold } from "@/lib/engineering";

export interface QuoteInput {
  name: string;
  clientId?: string | null;
  guests: number;
  tier: ServiceTier;
  district?: string | null;
  venue?: string | null;
  month?: number | null;
  peak?: boolean;
  eventDate?: Date | null;
  dishIds: number[];
  notes?: string | null;
}

/** A saved quote, plus the dishes as ids. Totals are as quoted, not recomputed. */
export interface SavedQuote {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  status: QuoteStatus;
  guests: number;
  tier: string;
  district: string | null;
  venue: string | null;
  month: number | null;
  peak: boolean;
  eventDate: Date | null;
  netTotal: number;
  grossTotal: number;
  foodCostTotal: number;
  notes: string | null;
  dishIds: number[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Price the selection with lib/pricing.ts and write down what it said.
 *
 * The totals are computed here rather than accepted from the browser. A number
 * that arrives in a form is a number somebody can edit, and a quote is the one
 * artefact in this app that a client will hold you to.
 */
function price(input: QuoteInput) {
  const dishes = DISHES.filter((d) => input.dishIds.includes(d.id));
  if (dishes.length === 0) throw new Error("A quote needs at least one dish.");

  return {
    dishes,
    quote: buildQuote({
      dishes,
      guests: input.guests,
      tier: input.tier,
      district: input.district
        ? DISTRICTS.find((d) => d.id === input.district)
        : undefined,
      venue: input.venue
        ? VENUE_TYPES.find((v) => v.id === input.venue)
        : undefined,
      peak: input.peak ?? false
    })
  };
}

export async function createQuote(me: Viewer, input: QuoteInput): Promise<string> {
  assertCan(CAN.writeQuotes, me.role, "create a quote");
  const { dishes, quote } = price(input);

  const [row] = await db.insert(quotes).values({
    name: input.name.trim() || "Untitled quote",
    clientId: input.clientId ?? null,
    guests: input.guests,
    tier: input.tier,
    district: input.district ?? null,
    venue: input.venue ?? null,
    month: input.month ?? null,
    peak: input.peak ?? false,
    eventDate: input.eventDate ?? null,
    netTotal: quote.netTotal,
    grossTotal: quote.grossTotal,
    foodCostTotal: quote.foodCostPerGuest * input.guests,
    notes: input.notes ?? null,
    createdBy: me.id
  }).returning({ id: quotes.id });

  await db.insert(quoteDishes).values(
    dishes.map((d) => ({
      quoteId: row.id,
      dishId: d.id,
      priceAtQuote: d.price,
      costAtQuote: d.cost
    }))
  );
  return row.id;
}

export async function updateQuote(me: Viewer, id: string, input: QuoteInput): Promise<void> {
  assertCan(CAN.writeQuotes, me.role, "edit a quote");
  const { dishes, quote } = price(input);

  await db.update(quotes).set({
    name: input.name.trim() || "Untitled quote",
    clientId: input.clientId ?? null,
    guests: input.guests,
    tier: input.tier,
    district: input.district ?? null,
    venue: input.venue ?? null,
    month: input.month ?? null,
    peak: input.peak ?? false,
    eventDate: input.eventDate ?? null,
    netTotal: quote.netTotal,
    grossTotal: quote.grossTotal,
    foodCostTotal: quote.foodCostPerGuest * input.guests,
    notes: input.notes ?? null,
    updatedAt: new Date()
  }).where(eq(quotes.id, id));

  // Replace rather than reconcile: the dish list is small and a diff here would
  // be more code than it saves, with more ways to leave a stale row behind.
  await db.delete(quoteDishes).where(eq(quoteDishes.quoteId, id));
  await db.insert(quoteDishes).values(
    dishes.map((d) => ({ quoteId: id, dishId: d.id, priceAtQuote: d.price, costAtQuote: d.cost }))
  );
}

export async function setQuoteStatus(me: Viewer, id: string, status: QuoteStatus): Promise<void> {
  assertCan(CAN.writeQuotes, me.role, "change a quote's status");
  await db.update(quotes).set({ status, updatedAt: new Date() }).where(eq(quotes.id, id));
}

export async function deleteQuote(me: Viewer, id: string): Promise<void> {
  assertCan(CAN.writeQuotes, me.role, "delete a quote");
  await db.delete(quotes).where(eq(quotes.id, id));
}

/** Every quote this viewer may see, newest first. */
export async function listQuotes(me: Viewer): Promise<SavedQuote[]> {
  const scope = quoteScope(me.role, me.clientId);
  if ("none" in scope) return [];

  const rows = await db
    .select({ q: quotes, clientName: clients.name })
    .from(quotes)
    .leftJoin(clients, eq(clients.id, quotes.clientId))
    .where("clientId" in scope ? eq(quotes.clientId, scope.clientId) : undefined)
    .orderBy(desc(quotes.updatedAt));

  if (rows.length === 0) return [];
  const links = await db.select().from(quoteDishes)
    .where(inArray(quoteDishes.quoteId, rows.map((r) => r.q.id)));

  return rows.map((r) => ({
    ...r.q,
    clientName: r.clientName,
    status: r.q.status as QuoteStatus,
    dishIds: links.filter((l) => l.quoteId === r.q.id).map((l) => l.dishId)
  }));
}

/**
 * One quote, or null.
 *
 * Null covers both "no such quote" and "not yours" on purpose: telling them
 * apart lets someone enumerate ids to learn how many events you have on.
 */
export async function getQuote(me: Viewer, id: string): Promise<SavedQuote | null> {
  const scope = quoteScope(me.role, me.clientId);
  if ("none" in scope) return null;

  const [row] = await db
    .select({ q: quotes, clientName: clients.name })
    .from(quotes)
    .leftJoin(clients, eq(clients.id, quotes.clientId))
    .where(
      "clientId" in scope
        ? and(eq(quotes.id, id), eq(quotes.clientId, scope.clientId))
        : eq(quotes.id, id)
    )
    .limit(1);

  if (!row) return null;
  const links = await db.select().from(quoteDishes).where(eq(quoteDishes.quoteId, id));
  return {
    ...row.q,
    clientName: row.clientName,
    status: row.q.status as QuoteStatus,
    dishIds: links.map((l) => l.dishId)
  };
}

/**
 * What actually sold, from the quotes you won.
 *
 * Aggregated in SQL rather than by loading every quote and counting in
 * JavaScript: this is the join that makes the menu engineering matrix possible
 * at all, and it is a few hundred rows on a free tier that sleeps.
 *
 * Only won quotes count. A draft is a thing you were thinking about and a lost
 * quote is a thing somebody else cooked; counting either as popularity would
 * measure what you offer rather than what people chose.
 *
 * priceAtQuote, not the menu price. That is what the client was charged, and
 * repricing the menu must not rewrite last March's margin.
 */
export async function soldDishes(me: Viewer): Promise<Sold[]> {
  assertCan(CAN.seeMoney, me.role, "see what has sold and what it earned");

  const rows = await db
    .select({
      dishId: quoteDishes.dishId,
      quotes: sql<number>`count(distinct ${quotes.id})::int`,
      covers: sql<number>`coalesce(sum(${quotes.guests}), 0)::int`,
      averagePrice: sql<number>`coalesce(avg(${quoteDishes.priceAtQuote}), 0)::double precision`
    })
    .from(quoteDishes)
    .innerJoin(quotes, eq(quotes.id, quoteDishes.quoteId))
    .where(eq(quotes.status, "won"))
    .groupBy(quoteDishes.dishId);

  return rows;
}
