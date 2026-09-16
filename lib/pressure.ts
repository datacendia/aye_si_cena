/**
 * What a busy Saturday is worth.
 *
 * Hotels and airlines have priced scarcity for forty years. Caterers almost
 * never do, and the reason is not principle — it is that nobody knows, at the
 * moment of quoting, how full the day already is. lib/capacity.ts knows
 * exactly: it can tell you what is already sold that day, whether the kit
 * stretches, and how close to the shift limit the crew already are.
 *
 * So a date that is nearly full quotes higher, and the quote says so in a
 * sentence rather than moving a number quietly. That last part is the whole
 * design. A surcharge a client discovers is a surcharge that loses the job; a
 * surcharge that arrives as "this is our last Saturday in December" is a reason
 * to book today.
 *
 * Two things this deliberately will not do:
 *
 *   It never discounts a quiet day. A caterer who drops the price on an empty
 *   Saturday has taught the market to wait, and this business has one kitchen
 *   and about fifty Saturdays a year to sell.
 *
 *   It never prices a day it cannot judge. A booking with no district cannot be
 *   costed for travel, so the day's load is unknown and the answer is "no
 *   surcharge" rather than a guess.
 */
import type { Booking, Clash, Kit } from "./capacity";
import { DEFAULT_KIT, clashesForDay, windowFor } from "./capacity";

export type Pressure = "quiet" | "busy" | "tight" | "full";

export interface DayPressure {
  level: Pressure;
  /** Jobs already sold that day that could be judged. */
  sold: number;
  /** Crew-hours already committed, against what the kit can work. */
  committedHours: number;
  capacityHours: number;
  /** 0–1. How much of the day is already spoken for. */
  load: number;
  /** Multiplier on the service half of the quote. Never below 1. */
  surcharge: number;
  /** Why, in the client's words. Empty when there is no surcharge. */
  because: string[];
  /** Clashes the day already has, before this job is added. */
  clashes: Clash[];
}

/**
 * The bands, and why they sit where they do.
 *
 * These are judgements, not measurements, and they are here as constants so
 * they can be argued with. The reasoning: one job on a day costs nothing extra
 * — the crew were coming out anyway. Two jobs means the van does the run twice
 * and somebody eats at 4pm. Three means the day only works if nothing goes
 * wrong, and something always goes wrong.
 */
export const BANDS: { level: Pressure; from: number; surcharge: number }[] = [
  { level: "quiet", from: 0, surcharge: 1 },
  { level: "busy", from: 0.35, surcharge: 1.1 },
  { level: "tight", from: 0.6, surcharge: 1.25 },
  { level: "full", from: 0.85, surcharge: 1.4 }
];

/** The service half only. Food cost does not rise because the day is busy. */
export function pressureFor(
  existing: Booking[], kit: Kit = DEFAULT_KIT
): DayPressure {
  const judgeable = existing.filter(Boolean);

  const committedHours = judgeable.reduce((sum, b) => {
    const w = windowFor(b);
    return sum + (w.back - w.out) / 60;
  }, 0);

  // One crew, one shift each. The real ceiling is people, not ovens: you can
  // hire a second plancha on a Friday and you cannot hire a second Saturday.
  const capacityHours = (kit.crew * kit.maxShiftMinutes) / 60;
  const load = capacityHours > 0 ? Math.min(1, committedHours / capacityHours) : 0;

  const band = [...BANDS].reverse().find((b) => load >= b.from) ?? BANDS[0];
  const clashes = clashesForDay(judgeable, kit);

  const because: string[] = [];
  if (band.surcharge > 1) {
    because.push(
      judgeable.length === 1
        ? "There is already an event on this date."
        : `There are already ${judgeable.length} events on this date.`
    );
    if (band.level === "full") {
      because.push("This is the last job the kitchen can take that day.");
    }
    if (clashes.length > 0) {
      because.push("The crew and the van are both committed for part of it.");
    }
  }

  return {
    level: band.level,
    sold: judgeable.length,
    committedHours: Math.round(committedHours * 10) / 10,
    capacityHours,
    load: Math.round(load * 100) / 100,
    surcharge: band.surcharge,
    because,
    clashes
  };
}

export const PRESSURE_LABEL: Record<Pressure, { en: string; es: string }> = {
  quiet: { en: "Open", es: "Libre" },
  busy: { en: "Filling", es: "Llenándose" },
  tight: { en: "Nearly full", es: "Casi lleno" },
  full: { en: "Last job of the day", es: "Último trabajo del día" }
};
