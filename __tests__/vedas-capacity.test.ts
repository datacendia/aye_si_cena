import { DISHES } from "@/data/dishes";
import { RECIPES } from "@/data/recipes";
import { VEDAS } from "@/data/vedas";
import { DISTRICTS, VENUE_TYPES } from "@/data/venues";
import { vedaHits, illegalInMonth, closedMonthsFor, vedaBlockerText } from "@/lib/vedas";
import { clashesForDay, canTakeBooking, windowFor, DEFAULT_KIT, type Booking } from "@/lib/capacity";
import { canonicalIngredient } from "@/lib/ingredient-key";

const dish = (id: number) => DISHES.find((d) => d.id === id)!;
const district = (id: string) => DISTRICTS.find((d) => d.id === id)!;
const venue = (id: string) => VENUE_TYPES.find((v) => v.id === id)!;

describe("the vedas are law, not seasonality", () => {
  it("declares itself unverified on every row, because nobody has checked the RM", () => {
    for (const v of VEDAS) {
      expect(v.verified).toBe(false);
      expect(v.closed.length).toBeGreaterThan(0);
      for (const m of v.closed) expect(m).toBeGreaterThanOrEqual(1);
      for (const m of v.closed) expect(m).toBeLessThanOrEqual(12);
    }
  });

  /**
   * This used to also assert that every key matched a line in some recipe, and
   * that rule is why three vedas were wrong. There was no octopus on the menu,
   * so `pulpo` was keyed to "baby squid" to satisfy the test - blocking the
   * Txipirones for two months for a law about a different animal. `anchoveta`
   * was keyed to the tinned Cantabrian fillet its own note exempts, and
   * `langostino-wild` to the farmed prawn its own note calls legal all year.
   *
   * A veda covering a species the menu does not currently sell is correct and
   * useful: it is armed for the day a recipe adds it. What must hold is that
   * the key CAN match - that it is written in the form the canonicaliser
   * produces - not that it does match today.
   */
  it("writes keys in the form the canonicaliser produces, so they can match", () => {
    for (const v of VEDAS) {
      expect(v.ingredientKeys.length).toBeGreaterThan(0);
      for (const k of v.ingredientKeys) expect(canonicalIngredient(k)).toBe(k);
    }
  });

  /**
   * The blocks, pinned. A veda keyed to the wrong ingredient does not throw -
   * it quietly takes a sellable dish off the menu and cites the law while doing
   * it, which is how the three above survived. Any change to a key shows up
   * here as a readable diff, and every row has to be defensible out loud.
   */
  it("blocks these dishes in these months, and no others", () => {
    const blocks: string[] = [];
    for (let m = 1; m <= 12; m++) {
      for (const h of vedaHits(DISHES, RECIPES, VEDAS, m)) {
        blocks.push(`${m} ${h.dish.id} ${h.dish.name} <- ${h.veda.id} via ${h.ingredient}`);
      }
    }
    expect(blocks.sort()).toEqual([
      "10 125 Croquetas de Corvina Salada <- corvina via corvina",
      "10 127 Marmitako de Bonito <- bonito via bonito loin",
      "10 134 Ceviche de Corvina y Eneldo <- corvina via corvina fillet",
      "10 143 Chupe de Corvina Ahumada <- corvina via smoked corvina",
      "10 193 Partan Bree Shots <- cangrejo via crab meat",
      "10 201 Finnan Haddie, Mustard Cream <- corvina via corvina fillet",
      "10 209 Partan Bree Bowl <- cangrejo via crab meat",
      "10 219 Chupe de Cangrejo, Avena <- cangrejo via crab meat",
      "10 38 Fish Supper, Yuca Chips <- chita via chita",
      "10 43 Corvina al Pil-Pil <- corvina via corvina fillet",
      "11 127 Marmitako de Bonito <- bonito via bonito loin",
      "11 193 Partan Bree Shots <- cangrejo via crab meat",
      "11 209 Partan Bree Bowl <- cangrejo via crab meat",
      "11 219 Chupe de Cangrejo, Avena <- cangrejo via crab meat",
      "11 38 Fish Supper, Yuca Chips <- chita via chita",
      "7 196 Musselburgh Pie Minis <- concha-de-abanico via concha de abanico",
      "8 196 Musselburgh Pie Minis <- concha-de-abanico via concha de abanico",
      "9 125 Croquetas de Corvina Salada <- corvina via corvina",
      "9 134 Ceviche de Corvina y Eneldo <- corvina via corvina fillet",
      "9 143 Chupe de Corvina Ahumada <- corvina via smoked corvina",
      "9 193 Partan Bree Shots <- cangrejo via crab meat",
      "9 196 Musselburgh Pie Minis <- concha-de-abanico via concha de abanico",
      "9 201 Finnan Haddie, Mustard Cream <- corvina via corvina fillet",
      "9 209 Partan Bree Bowl <- cangrejo via crab meat",
      "9 219 Chupe de Cangrejo, Avena <- cangrejo via crab meat",
      "9 38 Fish Supper, Yuca Chips <- chita via chita",
      "9 43 Corvina al Pil-Pil <- corvina via corvina fillet",
    ].sort());
  });

  it("leaves the squid, the tinned anchovy and the farmed prawn alone", () => {
    // Each of these was blocked by a veda whose own note exempts it.
    const free: [number, number[]][] = [
      [128, [7, 8]],        // Txipirones - squid, not octopus
      [21, [8, 9]],         // Gilda - tinned Cantabrian anchovy, not anchoveta
      [18, [1, 2, 3]]       // Prawn Cocktail Chifles - farmed langostino
    ];
    for (const [id, months] of free) {
      for (const m of months) {
        expect(vedaHits([dish(id)], RECIPES, VEDAS, m)).toHaveLength(0);
      }
    }
  });

  it("keeps January to March open, now that the farmed prawn is not blocked", () => {
    // The langostino veda covers wild camarón de río, which nothing on the menu
    // buys, so its closed months cost nothing. 143 Chupe de Corvina Ahumada was
    // added as cover for those months and is still good cover - just for the
    // corvina veda in September and October instead.
    const langostino = VEDAS.find((v) => v.id === "langostino-wild")!;
    for (const m of langostino.closed) {
      expect(vedaHits(DISHES, RECIPES, [langostino], m)).toHaveLength(0);
    }
  });

  it("does block the dish that actually uses the closed species", () => {
    const corvina = VEDAS.find((v) => v.id === "corvina")!;
    const hits = vedaHits(DISHES, RECIPES, [corvina], corvina.closed[0]);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(corvina.ingredientKeys).toContain(h.ingredient);
  });

  it("reports the closed months for a dish across the whole year", () => {
    const corvina = dish(43);   // Corvina al Pil-Pil
    const closed = closedMonthsFor(corvina, RECIPES, VEDAS);
    expect(closed.length).toBeGreaterThan(0);
  });

  it("writes a blocker that says it is an offence, not a risk", () => {
    const m = 9;
    const hits = vedaHits(DISHES, RECIPES, VEDAS, m);
    const text = vedaBlockerText(hits, "September");
    expect(text.length).toBeGreaterThan(0);
    for (const t of text) {
      expect(t).toMatch(/offence/);
      expect(t).toMatch(/resolución ministerial/);
    }
  });

  it("counts what each month costs you legally", () => {
    const rows: string[] = [];
    for (let m = 1; m <= 12; m++) rows.push(`${m}:${illegalInMonth(DISHES, RECIPES, VEDAS, m).size}`);
     
    console.log("  dishes illegal by month — " + rows.join(" "));
    expect(rows.length).toBe(12);
  });
});

describe("whether a day can be delivered", () => {
  const make = (id: string, hour: number, over: Partial<Booking> = {}): Booking => ({
    id,
    serviceMinutes: hour * 60,
    durationMinutes: 180,
    guests: 40,
    tier: "plated",
    dishes: [dish(133), dish(130)],   // one live station, one baked
    district: district("san-isidro"),
    venue: venue("hotel"),
    ...over
  });

  it("takes a single booking without complaint", () => {
    expect(clashesForDay([make("a", 19)])).toEqual([]);
  });

  it("refuses two overlapping events that both need the one plancha", () => {
    const clashes = clashesForDay([make("a", 19), make("b", 20)]);
    expect(clashes.some((c) => c.kind === "equipment")).toBe(true);
  });

  it("allows two events far enough apart in the day", () => {
    const morning = make("a", 8, { durationMinutes: 90 });
    const evening = make("b", 21, { durationMinutes: 90 });
    const clashes = clashesForDay([morning, evening]);
    expect(clashes.filter((c) => c.kind !== "shift")).toEqual([]);
  });

  it("counts the crew across both jobs, not within one", () => {
    const clashes = clashesForDay([make("a", 19), make("b", 20)], { ...DEFAULT_KIT, planchas: 5, fryers: 5, vans: 5 });
    expect(clashes.some((c) => c.kind === "crew")).toBe(true);
  });

  it("says no when one van cannot be in two districts at once", () => {
    const clashes = clashesForDay(
      [make("a", 19, { district: district("asia") }), make("b", 19, { district: district("callao") })],
      { ...DEFAULT_KIT, planchas: 5, fryers: 5, crew: 40 }
    );
    expect(clashes.some((c) => c.kind === "van")).toBe(true);
  });

  it("flags a door-to-door day nobody can work", () => {
    const far = make("a", 20, { district: district("asia"), durationMinutes: 300 });
    expect(clashesForDay([far]).some((c) => c.kind === "shift")).toBe(true);
  });

  it("builds a window that starts before service and ends after it", () => {
    const w = windowFor(make("a", 19));
    expect(w.out).toBeLessThan(19 * 60);
    expect(w.back).toBeGreaterThan(19 * 60 + 180);
  });

  it("answers the actual question: can I take this one?", () => {
    const booked = [make("a", 19)];
    expect(canTakeBooking(booked, make("b", 20)).ok).toBe(false);
    expect(canTakeBooking(booked, make("c", 9, { durationMinutes: 60 })).ok).toBe(true);
  });

  it("only reports clashes involving the candidate", () => {
    const booked = [make("a", 19), make("b", 20)];
    const res = canTakeBooking(booked, make("c", 9, { durationMinutes: 60 }));
    for (const c of res.clashes) expect(c.bookings).toContain("c");
  });
});
