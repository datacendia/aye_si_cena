/**
 * Where the event is, and what that costs.
 *
 * The tier used to carry a flat transport figure - S/60 for boxes, S/300 for
 * plated - regardless of whether the van was going ten minutes down the road
 * or ninety minutes south to Asia. That is not a rounding error: at the far
 * end of Lima it understates the line by several hundred soles, and the
 * shortfall comes straight out of contribution.
 *
 * This module replaces that flat number with drive time, crew time and the
 * venue's own access. Every rate below is an UNVERIFIED estimate.
 */
import type { ServiceTier } from "./dishes";

export interface District {
  id: string;
  name: string;
  /** One-way drive from the kitchen, off-peak, in minutes. */
  driveMinutes: number;
  /** What rush hour adds to that one-way leg. */
  peakExtra: number;
  /** One-way distance, for fuel. */
  km: number;
}

export interface VenueType {
  id: string;
  name: string;
  /** Extra crew minutes each way, for stairs, lifts, security, distance to the door. */
  crewMinutes: number;
  /** Is there a real kitchen on site? */
  hasKitchen: boolean;
  /** Is there mains power for a live station? */
  hasPower: boolean;
  note: string;
}

/** Where the van starts and ends. */
export const KITCHEN_DISTRICT = "magdalena";

/** Van hire with a driver, per hour, including his waiting time on site. */
export const VAN_HOURLY = 45;
/** Fuel and wear, per km. */
export const COST_PER_KM = 1.8;
/** Crew doing the carrying, per hour, per person. */
export const CREW_HOURLY = 18;
/** A generator, hired for the day, when a live station has no mains power. */
export const GENERATOR_HIRE = 280;

/**
 * How many van runs a tier needs. Boxes go in one load; a plated service is
 * food, menaje and kit, and the menaje comes back afterwards.
 */
export const VAN_TRIPS: Record<ServiceTier, number> = {
  ninos: 1,
  scran: 1,
  buffet: 2,
  plated: 2,
  // Reception canapés, then courses, then the menaje home again.
  ceilidh: 3
};

/** Crew on the load-in, by tier. */
export const LOAD_CREW: Record<ServiceTier, number> = {
  ninos: 1,
  scran: 1,
  buffet: 2,
  plated: 3,
  ceilidh: 4
};

export interface TransportInput {
  tier: ServiceTier;
  district: District;
  venue: VenueType;
  /** Loading in during Lima rush hour. Most evening events do. */
  peak?: boolean;
  /** True if the menu puts a live station on site. */
  liveStation?: boolean;
}

export interface TransportCost {
  total: number;
  lines: { label: string; total: number }[];
  /** Round-trip driving minutes across every van run. */
  driveMinutes: number;
  warnings: string[];
}

/**
 * What getting to this venue and back actually costs.
 *
 * Round trips are counted per van run, so a tier needing two runs pays the
 * drive twice - which is the part a flat figure hides.
 */
export function transportCost(input: TransportInput): TransportCost {
  const { tier, district, venue } = input;
  const peak = input.peak ?? false;
  const warnings: string[] = [];

  const oneWay = district.driveMinutes + (peak ? district.peakExtra : 0);
  const trips = VAN_TRIPS[tier];
  const driveMinutes = oneWay * 2 * trips;

  const vanCost = (driveMinutes / 60) * VAN_HOURLY;
  const fuelCost = district.km * 2 * trips * COST_PER_KM;

  // Crew are paid for the carrying at both ends of every run.
  const crew = LOAD_CREW[tier];
  const crewMinutes = venue.crewMinutes * 2 * trips * crew;
  const crewCost = (crewMinutes / 60) * CREW_HOURLY;

  const lines = [
    { label: `Van — ${trips} run${trips === 1 ? "" : "s"}, ${Math.round(driveMinutes)} min driving`, total: vanCost },
    { label: `Fuel — ${district.km * 2 * trips} km`, total: fuelCost }
  ];

  if (crewCost > 0) {
    lines.push({
      label: `Load-in crew — ${crew} × ${Math.round(crewMinutes / crew)} min`,
      total: crewCost
    });
  }

  if (input.liveStation && !venue.hasPower) {
    lines.push({ label: "Generator hire — no mains power on site", total: GENERATOR_HIRE });
    warnings.push(
      `${venue.name} has no mains power. A live station needs a generator, priced in above.`
    );
  }

  if (!venue.hasKitchen && tier === "plated") {
    warnings.push(
      `${venue.name} has no kitchen. Plated service here means everything finishes off a hot box — check the menu holds.`
    );
  }

  if (oneWay >= 60) {
    warnings.push(
      `${district.name} is ${oneWay} minutes each way${peak ? " in traffic" : ""}. Cold-chain and crew hours both need checking before quoting.`
    );
  }

  const total = lines.reduce((s, l) => s + l.total, 0);
  return { total: round2(total), lines: lines.map((l) => ({ ...l, total: round2(l.total) })), driveMinutes, warnings };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
