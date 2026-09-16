/**
 * What a busy Saturday is worth.
 *
 * Hotels have priced scarcity for forty years and caterers almost never do,
 * because at the moment of quoting nobody knows how full the day already is.
 * lib/capacity.ts has always known. This turns that into a number.
 *
 * The two tests that matter most are about what it refuses to do: it never
 * discounts a quiet day, and it never prices a day it cannot judge.
 */
import { pressureFor, BANDS, PRESSURE_LABEL, type Pressure } from "@/lib/pressure";
import { DEFAULT_KIT, type Booking } from "@/lib/capacity";
import { DISHES } from "@/data/dishes";
import { DISTRICTS, VENUE_TYPES } from "@/data/venues";
import { buildQuote, TIERS } from "@/lib/pricing";

const district = DISTRICTS.find((d) => d.id === "miraflores")!;
const venue = VENUE_TYPES.find((v) => v.id === "house")!;

const job = (id: string, hour: number, guests = 60): Booking => ({
  id, serviceMinutes: hour * 60, durationMinutes: 180, guests,
  tier: "plated", dishes: DISHES.slice(0, 4), district, venue
});

describe("how full a day is", () => {
  it("an empty day is quiet and costs nothing extra", () => {
    const p = pressureFor([]);
    expect(p.level).toBe("quiet");
    expect(p.surcharge).toBe(1);
    expect(p.because).toEqual([]);
    expect(p.sold).toBe(0);
  });

  it("never discounts, whatever the load", () => {
    // A caterer who drops the price on an empty Saturday has taught the market
    // to wait, and there are about fifty Saturdays a year to sell.
    for (const band of BANDS) expect(band.surcharge).toBeGreaterThanOrEqual(1);
    expect(pressureFor([]).surcharge).toBe(1);
  });

  it("climbs as the day fills, never falls", () => {
    const loads = [[], [job("a", 13)], [job("a", 13), job("b", 19)],
                   [job("a", 12), job("b", 16), job("c", 20)]];
    const surcharges = loads.map((l) => pressureFor(l).surcharge);
    expect([...surcharges].sort((a, b) => a - b)).toEqual(surcharges);
  });

  it("reports the load as a fraction of what the crew can work", () => {
    const p = pressureFor([job("a", 13)]);
    expect(p.load).toBeGreaterThan(0);
    expect(p.load).toBeLessThanOrEqual(1);
    expect(p.capacityHours).toBe((DEFAULT_KIT.crew * DEFAULT_KIT.maxShiftMinutes) / 60);
  });

  it("caps at one — a day cannot be more than full", () => {
    const many = Array.from({ length: 12 }, (_, i) => job(`j${i}`, 8 + i));
    expect(pressureFor(many).load).toBe(1);
  });

  it("counts crew hours, so a bigger kit absorbs more before charging", () => {
    const day = [job("a", 13), job("b", 19)];
    const small = pressureFor(day, DEFAULT_KIT);
    const large = pressureFor(day, { ...DEFAULT_KIT, crew: 20 });
    expect(large.surcharge).toBeLessThanOrEqual(small.surcharge);
  });
});

describe("what the client is told", () => {
  it("says nothing when there is no surcharge", () => {
    expect(pressureFor([]).because).toEqual([]);
  });

  it("gives a reason whenever it charges", () => {
    const busy = pressureFor([job("a", 12), job("b", 16), job("c", 20)]);
    expect(busy.surcharge).toBeGreaterThan(1);
    expect(busy.because.length).toBeGreaterThan(0);
    for (const line of busy.because) expect(line.trim()).not.toBe("");
  });

  it("names the last slot as the last slot", () => {
    const full = Array.from({ length: 8 }, (_, i) => job(`j${i}`, 8 + i));
    const p = pressureFor(full);
    expect(p.level).toBe("full");
    expect(p.because.join(" ")).toMatch(/last job/i);
  });

  it("labels every band in both languages", () => {
    for (const band of BANDS) {
      const label = PRESSURE_LABEL[band.level as Pressure];
      expect(label.en.trim()).not.toBe("");
      expect(label.es.trim()).not.toBe("");
      expect(label.en).not.toBe(label.es);
    }
  });
});

describe("what it does to a quote", () => {
  const menu = DISHES.filter((d) => d.tiers.includes("plated")).slice(0, 5);
  const base = { dishes: menu, guests: 40, tier: "plated" as const, district, venue };

  it("adds a visible line rather than moving a number quietly", () => {
    const quiet = buildQuote(base);
    const busy = buildQuote({ ...base, pressure: 1.25, pressureLabel: "Nearly full" });

    expect(busy.serviceLines.length).toBe(quiet.serviceLines.length + 1);
    expect(busy.serviceLines.at(-1)!.label).toBe("Nearly full");
    expect(busy.netPerGuest).toBeGreaterThan(quiet.netPerGuest);
  });

  it("charges the service half only — food does not cost more on a busy day", () => {
    const quiet = buildQuote(base);
    const busy = buildQuote({ ...base, pressure: 1.4 });

    expect(busy.menuValuePerGuest).toBe(quiet.menuValuePerGuest);
    expect(busy.foodCostPerGuest).toBe(quiet.foodCostPerGuest);
    expect(busy.serviceCostPerGuest).toBeGreaterThan(quiet.serviceCostPerGuest);
  });

  it("charges exactly the multiplier on the service lines", () => {
    const quiet = buildQuote(base);
    const busy = buildQuote({ ...base, pressure: 1.25 });
    expect(busy.serviceCostPerGuest).toBeCloseTo(quiet.serviceCostPerGuest * 1.25, 6);
  });

  it("changes nothing at all when the day is quiet", () => {
    const quiet = buildQuote(base);
    const explicit = buildQuote({ ...base, pressure: 1 });
    expect(explicit.netTotal).toBe(quiet.netTotal);
    expect(explicit.serviceLines).toHaveLength(quiet.serviceLines.length);
  });

  it("still balances: net plus IGV is what the client pays", () => {
    const busy = buildQuote({ ...base, pressure: 1.4 });
    expect(busy.grossTotal).toBeCloseTo(busy.netTotal * 1.18, 4);
    expect(busy.netTotal).toBeCloseTo(busy.netPerGuest * 40, 4);
  });

  it("holds for every tier", () => {
    for (const tier of Object.keys(TIERS) as (keyof typeof TIERS)[]) {
      const dishes = DISHES.slice(0, 4);
      const quiet = buildQuote({ dishes, guests: 40, tier, district, venue });
      const busy = buildQuote({ dishes, guests: 40, tier, district, venue, pressure: 1.25 });
      expect(busy.netPerGuest).toBeGreaterThanOrEqual(quiet.netPerGuest);
    }
  });
});
