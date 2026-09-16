/**
 * Quote maths for Aye Si Cena.
 *
 * Three rules this module exists to enforce, because getting any of them wrong
 * silently loses money on every event quoted:
 *
 *  1. IGV (18%) is stated explicitly. A quote is either NET (client pays
 *     price + IGV) or GROSS (the headline already contains IGV). Never assume.
 *  2. Canapes are sold per guest as a bite count, never per piece. The
 *     per-piece menu value is a costing device only.
 *  3. Per-event costs (menaje, staff, transport, packaging) come off before
 *     anything is called profit. Food cost alone overstates margin badly on
 *     plated service.
 */

import type { Dish, ServiceTier } from "./dishes";
import { transportCost } from "./venues";
import type { District, VenueType } from "./venues";

export const IGV_RATE = 0.18;

/** Food-cost band we price to. Outside this, a dish needs repricing or re-speccing. */
export const FOOD_COST_TARGET = { min: 0.25, max: 0.3 } as const;

/*
 * There was a `QuoteBasis = "net" | "gross"` here, accepted by buildQuote,
 * defaulted, stored on the Quote and never read. Both figures are computed
 * either way, so it changed nothing - but it advertised a headline figure that
 * moves with it, and the first caller to set "gross" and read netPerGuest as
 * the price they quoted would have been 18% out: S/595.80 on a S/3,310 job.
 *
 * A quote states both numbers and labels which is which. That is the rule at
 * the top of this file, and it does not need a switch.
 */

export interface TierRules {
  id: ServiceTier;
  name: string;
  /** Below this head count the tier is not offered. */
  minGuests: number;
  /** Menaje (tableware) hire per guest. Zero where food ships in boxes. */
  menajePerGuest: number;
  /** Disposable packaging per guest. Zero where we plate onto hired china. */
  packagingPerGuest: number;
  /** One waiter per this many guests. Zero means no floor staff. */
  guestsPerWaiter: number;
  /** On-site chefs required regardless of head count. */
  chefs: number;
  /**
   * Fallback flat transport, used only when no venue is given. A real quote
   * should pass a district and venue type and let lib/venues cost the run;
   * this number is a placeholder that ignores where the event actually is.
   */
  transport: number;
  /** Canape bites included per guest. */
  bitesPerGuest: number;
}

export const STAFF_SHIFT_COST = 100; // freelance waiter or prep chef, 6-8h shift
export const CHEF_SHIFT_COST = 180; // on-site chef, plating service

export const TIERS: Record<ServiceTier, TierRules> = {
  /*
   * A children's party.
   *
   * Not a cheaper version of the boxes — a different job. Everything arrives
   * cold or at room temperature in one drop, there is no crew, and the whole
   * menu is drawn from dishes lib/dietary.ts says are kid-friendly and that
   * carry no alcohol at all. The licence rule is absolute here: cooking with
   * alcohol is legal without the giro especial, but nothing containing it goes
   * to a room full of eight-year-olds.
   *
   * Six bites rather than eight because children eat less and waste more, and
   * a box that comes back half full is a complaint whatever it cost.
   */
  ninos: {
    id: "ninos",
    name: "Wee Feast",
    minGuests: 10,
    menajePerGuest: 0,
    packagingPerGuest: 5,
    guestsPerWaiter: 0,
    chefs: 0,
    transport: 60,
    bitesPerGuest: 6
  },
  scran: {
    id: "scran",
    name: "Scran Boxes",
    minGuests: 8,
    menajePerGuest: 0,
    packagingPerGuest: 7,
    guestsPerWaiter: 0,
    chefs: 0,
    transport: 60,
    bitesPerGuest: 8
  },
  buffet: {
    id: "buffet",
    name: "Two Shores Buffet",
    minGuests: 20,
    menajePerGuest: 18,
    packagingPerGuest: 2,
    guestsPerWaiter: 25,
    chefs: 1,
    transport: 220,
    bitesPerGuest: 6
  },
  plated: {
    id: "plated",
    name: "The Aye Si Plated Experience",
    minGuests: 20,
    menajePerGuest: 27.5,
    packagingPerGuest: 0,
    guestsPerWaiter: 12,
    chefs: 1,
    transport: 300,
    bitesPerGuest: 6
  },

  /*
   * The top of the range.
   *
   * A reception standing with a drink, then courses to the table — so ten
   * bites a head rather than six, and the guest count is low because that is
   * what this service is: a wedding top table, a company's twelve most
   * important people, an anniversary.
   *
   * The staffing is where the money goes and it is not a markup. One server
   * per eight guests and two chefs is what timing courses to a room actually
   * takes; at one per twelve the third course arrives cold. The menaje figure
   * is premium hire — proper glassware, linen rather than paper — and the van
   * goes three times because the reception kit, the service kit and the
   * returns are three different loads.
   */
  ceilidh: {
    id: "ceilidh",
    name: "The Ceilidh Table",
    minGuests: 12,
    menajePerGuest: 45,
    packagingPerGuest: 0,
    guestsPerWaiter: 8,
    chefs: 2,
    transport: 380,
    bitesPerGuest: 10
  }
};

/** Food cost as a fraction of menu value. */
export function foodCostRatio(dish: Pick<Dish, "cost" | "price">): number {
  if (dish.price <= 0) throw new Error(`Dish price must be positive, got ${dish.price}`);
  return dish.cost / dish.price;
}

export type MarginFlag = "under" | "on-target" | "over";

/**
 * Under-target is not an error - it is headroom. Over-target is a real problem:
 * the dish is eating margin and needs repricing or a cheaper spec.
 */
export function marginFlag(dish: Pick<Dish, "cost" | "price">): MarginFlag {
  const r = foodCostRatio(dish);
  if (r > FOOD_COST_TARGET.max) return "over";
  if (r < FOOD_COST_TARGET.min) return "under";
  return "on-target";
}

/** Add IGV to a net figure. */
export function addIgv(net: number): number {
  return net * (1 + IGV_RATE);
}

/** Strip IGV out of a gross figure. */
export function removeIgv(gross: number): number {
  return gross / (1 + IGV_RATE);
}

export interface QuoteInput {
  dishes: Dish[];
  guests: number;
  tier: ServiceTier;
  /**
   * Where the event is. Omit and the quote falls back to the tier's flat
   * transport figure, which is wrong for anywhere but the near districts.
   */
  district?: District;
  venue?: VenueType;
  /** Loading in during Lima rush hour. Most evening events do. */
  peak?: boolean;
}

export interface QuoteLine {
  label: string;
  perGuest: number;
  total: number;
}

export interface Quote {
  tier: TierRules;
  guests: number;

  /** Menu value of the selected dishes, per guest, before any service costs. */
  menuValuePerGuest: number;
  foodCostPerGuest: number;

  /** Everything that is not food, itemised. */
  serviceLines: QuoteLine[];
  serviceCostPerGuest: number;

  /** What the client is quoted, excluding IGV. */
  netPerGuest: number;
  netTotal: number;
  igvTotal: number;
  /** What the client actually pays. */
  grossTotal: number;

  /**
   * Revenue less food AND service costs. This is the number to run the
   * business on - not revenue less food cost.
   */
  contributionPerGuest: number;
  contributionTotal: number;
  contributionRatio: number;

  warnings: string[];
}

/**
 * Canapes are counted as bites per guest; everything else is one portion per
 * guest. Returns [menuValue, foodCost] per guest.
 */
function menuTotals(dishes: Dish[], bitesPerGuest: number): [number, number] {
  const canapes = dishes.filter((d) => d.category === "canape");
  const plates = dishes.filter((d) => d.category !== "canape");

  let value = 0;
  let cost = 0;

  // Bites are distributed evenly across whichever canapes were chosen, so the
  // guest gets `bitesPerGuest` pieces in total, not that many of each.
  if (canapes.length > 0) {
    const avgValue = canapes.reduce((s, d) => s + d.price, 0) / canapes.length;
    const avgCost = canapes.reduce((s, d) => s + d.cost, 0) / canapes.length;
    value += avgValue * bitesPerGuest;
    cost += avgCost * bitesPerGuest;
  }

  for (const d of plates) {
    value += d.price;
    cost += d.cost;
  }

  return [value, cost];
}

export function buildQuote(input: QuoteInput): Quote {
  const { dishes, guests, tier: tierId } = input;
  const tier = TIERS[tierId];
  const warnings: string[] = [];

  if (!tier) throw new Error(`Unknown service tier: ${tierId}`);
  if (!Number.isFinite(guests) || guests <= 0) {
    throw new Error(`Guest count must be a positive number, got ${guests}`);
  }
  if (dishes.length === 0) {
    throw new Error("A quote needs at least one dish");
  }
  if (guests < tier.minGuests) {
    warnings.push(
      `${tier.name} has a ${tier.minGuests}-guest minimum; this quote is for ${guests}.`
    );
  }

  const [menuValuePerGuest, foodCostPerGuest] = menuTotals(dishes, tier.bitesPerGuest);

  // Per-event costs, spread across the head count.
  const waiters = tier.guestsPerWaiter > 0 ? Math.ceil(guests / tier.guestsPerWaiter) : 0;
  const staffTotal = waiters * STAFF_SHIFT_COST + tier.chefs * CHEF_SHIFT_COST;

  // Transport: costed against the real venue where one is given, and flagged
  // as a placeholder where it is not.
  let transportLine: QuoteLine;
  if (input.district && input.venue) {
    const liveStation = dishes.some((d) => d.format === "live-station");
    const t = transportCost({
      tier: tierId,
      district: input.district,
      venue: input.venue,
      peak: input.peak,
      liveStation
    });
    transportLine = {
      label: `Transport & load-in — ${input.district.name}, ${input.venue.name}`,
      perGuest: t.total / guests,
      total: t.total
    };
    warnings.push(...t.warnings);
  } else {
    transportLine = {
      label: "Transport & load-in (flat estimate — no venue set)",
      perGuest: tier.transport / guests,
      total: tier.transport
    };
  }

  const serviceLines: QuoteLine[] = [
    {
      label: "Menaje hire",
      perGuest: tier.menajePerGuest,
      total: tier.menajePerGuest * guests
    },
    {
      label: "Packaging",
      perGuest: tier.packagingPerGuest,
      total: tier.packagingPerGuest * guests
    },
    {
      label:
        waiters > 0
          ? `Staff — ${waiters} waiter${waiters === 1 ? "" : "s"}, ${tier.chefs} chef`
          : `Staff — ${tier.chefs} chef`,
      perGuest: staffTotal / guests,
      total: staffTotal
    },
    transportLine
  ].filter((l) => l.total > 0);

  const serviceCostPerGuest = serviceLines.reduce((s, l) => s + l.perGuest, 0);

  // The client-facing figure. Menu value already carries the margin on food;
  // service costs are recovered on top at cost.
  const netPerGuest = menuValuePerGuest + serviceCostPerGuest;
  const netTotal = netPerGuest * guests;
  const igvTotal = netTotal * IGV_RATE;
  const grossTotal = netTotal + igvTotal;

  const contributionPerGuest = netPerGuest - foodCostPerGuest - serviceCostPerGuest;
  const contributionTotal = contributionPerGuest * guests;

  const overspec = dishes.filter((d) => marginFlag(d) === "over");
  if (overspec.length > 0) {
    warnings.push(
      `${overspec.length} dish${overspec.length === 1 ? "" : "es"} above the 30% food-cost ceiling: ` +
        overspec.map((d) => d.name).join(", ")
    );
  }

  return {
    tier,
    guests,
    menuValuePerGuest,
    foodCostPerGuest,
    serviceLines,
    serviceCostPerGuest,
    netPerGuest,
    netTotal,
    igvTotal,
    grossTotal,
    contributionPerGuest,
    contributionTotal,
    contributionRatio: netPerGuest > 0 ? contributionPerGuest / netPerGuest : 0,
    warnings
  };
}

/** Format soles for display. */
export function soles(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}
