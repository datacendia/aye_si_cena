/**
 * Did that job actually make money?
 *
 * Every margin figure in this app is modelled. Food cost comes from the recipe
 * priced with estimates; service cost from the tier's staffing rules. Both are
 * good models and neither is a receipt, and a business run on models is a
 * business that finds out in December.
 *
 * So: one row per booking, filled in afterwards from what was really spent, and
 * a comparison against what was quoted. The gap is the only honest answer, and
 * it tells you which of two different things is wrong — the model, or the
 * kitchen. A job that ran over on food when the prices had moved is a pricing
 * problem. One that ran over when they had not is a portioning problem. They
 * have opposite fixes and they look identical until you put the numbers side
 * by side.
 */
import { eq, inArray } from "drizzle-orm";
import { db, eventActuals, bookings, quotes, quoteDishes } from "@/db";
import { CAN, assertCan } from "@/lib/permissions";
import type { Viewer } from "@/lib/session";

export interface ActualsInput {
  bookingId: string;
  foodSpend?: number | null;
  staffSpend?: number | null;
  transportSpend?: number | null;
  otherSpend?: number | null;
  guestsServed?: number | null;
  note?: string | null;
}

export interface PostMortem {
  bookingId: string;
  eventDate: Date;
  name: string;
  guestsQuoted: number;
  guestsServed: number | null;

  /** What the client was charged, ex-IGV. Null when the booking had no quote. */
  quotedNet: number | null;
  /** What the food was modelled to cost when it was quoted. */
  quotedFoodCost: number | null;

  /** What was actually spent, where it has been recorded. */
  spentFood: number | null;
  spentTotal: number | null;

  /** Revenue less everything recorded. Null until something is recorded. */
  contribution: number | null;
  /** Food spend as a fraction of revenue — the number the trade runs on. */
  actualFoodCostRatio: number | null;
  quotedFoodCostRatio: number | null;

  /** Signed difference in food-cost ratio. Positive means it ran dearer. */
  foodCostGap: number | null;
  recorded: boolean;
}

export async function recordActuals(me: Viewer, input: ActualsInput): Promise<void> {
  assertCan(CAN.seeMoney, me.role, "record what an event actually cost");

  for (const [field, value] of Object.entries(input)) {
    if (typeof value === "number" && value < 0) {
      throw new Error(`${field} cannot be negative.`);
    }
  }

  const row = {
    bookingId: input.bookingId,
    foodSpend: input.foodSpend ?? null,
    staffSpend: input.staffSpend ?? null,
    transportSpend: input.transportSpend ?? null,
    otherSpend: input.otherSpend ?? null,
    guestsServed: input.guestsServed ?? null,
    note: input.note?.trim() || null,
    recordedBy: me.id,
    recordedAt: new Date()
  };

  await db.insert(eventActuals).values(row)
    .onConflictDoUpdate({ target: eventActuals.bookingId, set: row });
}

/**
 * Every past booking, with what it was quoted at and what it cost.
 *
 * Bookings with nothing recorded are returned too, with `recorded: false` —
 * they are the work list. A page that showed only the events somebody had
 * already filled in would be a page that never reminded anybody to fill one in.
 */
export async function postMortems(me: Viewer, before = new Date()): Promise<PostMortem[]> {
  assertCan(CAN.seeMoney, me.role, "see what events actually cost");

  const rows = await db
    .select({ b: bookings, q: quotes, a: eventActuals })
    .from(bookings)
    .leftJoin(quotes, eq(quotes.id, bookings.quoteId))
    .leftJoin(eventActuals, eq(eventActuals.bookingId, bookings.id));

  const past = rows.filter((r) => r.b.eventDate <= before);
  if (past.length === 0) return [];

  /*
   * The quoted food cost comes from quote_dishes, not from re-costing the menu
   * today. That is the whole reason costAtQuote is stored: re-deriving it would
   * compare what you spent in March against what the recipe would cost in
   * September, and call the difference your margin.
   */
  const quoteIds = past.map((r) => r.q?.id).filter((x): x is string => Boolean(x));
  const links = quoteIds.length
    ? await db.select().from(quoteDishes).where(inArray(quoteDishes.quoteId, quoteIds))
    : [];

  return past
    .map(({ b, q, a }) => {
      const guests = a?.guestsServed ?? b.guests;
      const spent = sum([a?.foodSpend, a?.staffSpend, a?.transportSpend, a?.otherSpend]);
      const quotedNet = q?.netTotal ?? null;

      const quotedFoodCost = q
        ? links.filter((l) => l.quoteId === q.id)
            .reduce((n, l) => n + l.costAtQuote, 0) * b.guests
        : null;

      const actualRatio =
        a?.foodSpend != null && quotedNet ? a.foodSpend / quotedNet : null;
      const quotedRatio =
        quotedFoodCost != null && quotedNet ? quotedFoodCost / quotedNet : null;

      return {
        bookingId: b.id,
        eventDate: b.eventDate,
        name: q?.name ?? b.notes ?? "—",
        guestsQuoted: b.guests,
        guestsServed: a?.guestsServed ?? null,
        quotedNet,
        quotedFoodCost,
        spentFood: a?.foodSpend ?? null,
        spentTotal: spent,
        contribution: quotedNet != null && spent != null ? quotedNet - spent : null,
        actualFoodCostRatio: actualRatio,
        quotedFoodCostRatio: quotedRatio,
        foodCostGap:
          actualRatio != null && quotedRatio != null ? actualRatio - quotedRatio : null,
        recorded: Boolean(a),
        _guests: guests
      } as PostMortem & { _guests: number };
    })
    .sort((x, y) => y.eventDate.getTime() - x.eventDate.getTime());
}

/** Null unless at least one figure was recorded — zero would be a claim. */
function sum(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => typeof v === "number");
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
}
