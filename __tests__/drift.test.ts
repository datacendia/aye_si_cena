/**
 * What a supplier is doing to you, over months rather than receipts.
 *
 * lib/repo/prices.ts has never edited a price in place — recording a new one
 * supersedes the last — and until now nothing had ever read the history back.
 * The table already held the answer to a question nobody was asking it.
 *
 * The tests that matter are the ones about refusing to answer. A single reading
 * is not a trend. Two readings in different units are not comparable at all. A
 * 6% jump over three days is not a rate. Every one of those, presented as a
 * number, would be worse than an empty page — because somebody would act on it.
 */
import {
  drift, material, monthlyRate, dishesByIngredient, MATERIAL, type PriceReading
} from "@/lib/drift";
import { RECIPES } from "@/data/recipes";
import { DISHES } from "@/data/dishes";

const day = (n: number) => new Date(2026, 0, 1 + n);

const r = (
  key: string, soles: number, dayN: number, per = "kg", source: string | null = null
): PriceReading => ({ ingredientKey: key, soles, per, verifiedAt: day(dayN), source });

describe("measuring a movement", () => {
  it("reports the rise from the oldest reading to the newest", () => {
    const [d] = drift([r("butter", 32, 0), r("butter", 41, 90)]);
    expect(d.ingredientKey).toBe("butter");
    expect(d.first.soles).toBe(32);
    expect(d.latest.soles).toBe(41);
    expect(d.change).toBeCloseTo(0.28125, 5);
    expect(d.days).toBe(90);
    expect(d.readings).toBe(2);
  });

  it("reports a fall as a fall, not as an absolute", () => {
    const [d] = drift([r("lime", 8, 0), r("lime", 6, 30)]);
    expect(d.change).toBeCloseTo(-0.25, 5);
  });

  it("uses the oldest and newest regardless of the order they arrive in", () => {
    const [d] = drift([r("butter", 41, 90), r("butter", 36, 45), r("butter", 32, 0)]);
    expect(d.first.soles).toBe(32);
    expect(d.latest.soles).toBe(41);
    expect(d.readings).toBe(3);
  });

  it("carries the stall through, so you can see who it is", () => {
    const [d] = drift([
      r("butter", 32, 0, "kg", "Surquillo N.1"),
      r("butter", 41, 60, "kg", "Surquillo N.1")
    ]);
    expect(d.first.source).toBe("Surquillo N.1");
    expect(d.latest.source).toBe("Surquillo N.1");
  });

  it("puts the biggest rise first — that is the one costing money today", () => {
    const rows = drift([
      r("lime", 8, 0), r("lime", 9, 30),
      r("butter", 32, 0), r("butter", 48, 30),
      r("flour", 5, 0), r("flour", 4, 30)
    ]);
    expect(rows.map((d) => d.ingredientKey)).toEqual(["butter", "lime", "flour"]);
  });

  it("treats differently-written names as one ingredient", () => {
    const rows = drift([r("  BUTTER ", 32, 0), r("butter", 41, 60)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].readings).toBe(2);
  });
});

describe("refusing to answer", () => {
  it("says nothing about an ingredient priced once — one reading is not a trend", () => {
    expect(drift([r("butter", 32, 0)])).toEqual([]);
  });

  it("says nothing at all when nothing has been priced", () => {
    expect(drift([])).toEqual([]);
  });

  it("refuses to compare prices in different units", () => {
    // A supplier switching from bunches to kilos is a real thing that happens.
    // S/41 a kilo against S/4 a bunch is not a 925% rise; it is not a number.
    expect(drift([
      { ...r("coriander", 4, 0), per: "bunch" },
      { ...r("coriander", 41, 30), per: "kg" }
    ])).toEqual([]);
  });

  it("refuses to divide by a first price of zero", () => {
    expect(drift([r("butter", 0, 0), r("butter", 41, 30)])).toEqual([]);
  });

  it("gives days: 0 rather than an infinite rate for two readings the same day", () => {
    const [d] = drift([r("butter", 32, 0), r("butter", 41, 0)]);
    expect(d.days).toBe(0);
    expect(monthlyRate(d)).toBeNull();
  });
});

describe("the monthly rate", () => {
  it("is null under a fortnight — a bad week at one stall is not a rate", () => {
    const [d] = drift([r("butter", 32, 0), r("butter", 34, 3)]);
    expect(d.change).toBeGreaterThan(MATERIAL);
    expect(monthlyRate(d)).toBeNull();
  });

  it("scales a ninety-day movement to thirty days", () => {
    const [d] = drift([r("butter", 30, 0), r("butter", 39, 90)]);
    expect(monthlyRate(d)).toBeCloseTo(0.1, 5);
  });

  it("is the change itself over exactly thirty days", () => {
    const [d] = drift([r("butter", 30, 0), r("butter", 33, 30)]);
    expect(monthlyRate(d)).toBeCloseTo(d.change, 8);
  });
});

describe("what is worth showing", () => {
  it("drops movements under the threshold in both directions", () => {
    const rows = drift([
      r("butter", 100, 0), r("butter", 102, 30),
      r("lime", 100, 0), r("lime", 98, 30),
      r("flour", 100, 0), r("flour", 130, 30)
    ]);
    expect(material(rows).map((d) => d.ingredientKey)).toEqual(["flour"]);
  });

  it("keeps a fall as readily as a rise — a supplier undercutting is news too", () => {
    const rows = drift([r("lime", 100, 0), r("lime", 60, 30)]);
    expect(material(rows)).toHaveLength(1);
  });

  it("takes a threshold, so the page can offer a different one", () => {
    const rows = drift([r("butter", 100, 0), r("butter", 102, 30)]);
    expect(material(rows, 0.01)).toHaveLength(1);
    expect(material(rows, 0.5)).toHaveLength(0);
  });
});

describe("what the drift actually costs — dishes per ingredient", () => {
  const index = dishesByIngredient(RECIPES, DISHES);

  it("indexes the real recipes, not a sample", () => {
    expect(index.size).toBeGreaterThan(100);
  });

  it("counts each dish once even when a recipe names an ingredient twice", () => {
    for (const ids of index.values()) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("only ever names dishes that exist", () => {
    const live = new Set(DISHES.map((d) => d.id));
    for (const ids of index.values()) {
      for (const id of ids) expect(live.has(id)).toBe(true);
    }
  });

  it("attaches the dish count to the drift, which is what makes it urgent", () => {
    const [d] = drift([r("butter", 32, 0), r("butter", 41, 60)], {
      dishesByIngredient: index
    });
    // S/41 for butter is the price of butter. S/41 for butter across this many
    // dishes is a decision.
    expect(d.dishIds.length).toBeGreaterThan(0);
  });

  it("is empty rather than wrong when the index is not supplied", () => {
    const [d] = drift([r("butter", 32, 0), r("butter", 41, 60)]);
    expect(d.dishIds).toEqual([]);
  });

  it("carries the shipped estimate so a bad estimate is visible too", () => {
    const [d] = drift([r("butter", 32, 0), r("butter", 41, 60)], {
      estimates: { butter: 32 }
    });
    expect(d.estimate).toBe(32);
  });
});
