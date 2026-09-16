/**
 * Who is putting your prices up.
 *
 * lib/drift.ts answers what is rising. This answers who, and they are different
 * questions with opposite answers: a market problem you absorb or reprice, a
 * supplier problem you walk across the aisle about.
 *
 * The weighting is the part worth testing hardest. A stall that has put butter
 * up 20% has done far more damage than one that has put mace up 20%, because 47
 * dishes carry butter and two carry mace. A flat average calls them equal and
 * gets somebody to renegotiate the wrong contract.
 */
import { suppliers, notable, NOTABLE } from "@/lib/suppliers";
import type { PriceReading } from "@/lib/drift";

const day = (n: number) => new Date(2026, 0, 1 + n);
const r = (
  key: string, soles: number, dayN: number, source: string | null, per = "kg"
): PriceReading => ({ ingredientKey: key, soles, per, verifiedAt: day(dayN), source });

describe("grouping by stall", () => {
  it("measures each stall separately", () => {
    const lines = suppliers([
      r("butter", 30, 0, "Surquillo"), r("butter", 39, 60, "Surquillo"),
      r("lime", 10, 0, "Terminal"), r("lime", 10.2, 60, "Terminal")
    ]);
    expect(lines.map((l) => l.source).sort()).toEqual(["Surquillo", "Terminal"]);
  });

  it("puts the stall costing you money first", () => {
    const lines = suppliers([
      r("lime", 10, 0, "Calm"), r("lime", 10.1, 60, "Calm"),
      r("butter", 30, 0, "Steep"), r("butter", 45, 60, "Steep")
    ]);
    expect(lines[0].source).toBe("Steep");
  });

  it("attributes nothing to a reading with no stall recorded", () => {
    // "unknown" would be the largest line on the page and would mean nothing.
    const lines = suppliers([
      r("butter", 30, 0, null), r("butter", 45, 60, null),
      r("lime", 10, 0, "   "), r("lime", 12, 60, "")
    ]);
    expect(lines).toEqual([]);
  });

  it("reports a stall with one reading as thin rather than as flat", () => {
    const [line] = suppliers([r("butter", 30, 0, "Surquillo")]);
    expect(line.monthlyChange).toBeNull();
    expect(line.tracked).toBe(0);
    expect(line.readings).toBe(1);
  });

  it("counts the days it has been watching", () => {
    const [line] = suppliers([r("butter", 30, 0, "S"), r("butter", 39, 90, "S")]);
    expect(line.span).toBe(90);
  });
});

describe("the weighting", () => {
  const reach = new Map<string, number[]>([
    ["butter", Array.from({ length: 47 }, (_, i) => i + 1)],
    ["mace", [200, 201]]
  ]);

  it("weights by how many dishes carry the ingredient", () => {
    // Same 20% rise at two stalls, on ingredients with very different reach.
    const heavy = suppliers([
      r("butter", 30, 0, "Heavy"), r("butter", 36, 30, "Heavy")
    ], { dishesByIngredient: reach })[0];

    const light = suppliers([
      r("mace", 30, 0, "Light"), r("mace", 36, 30, "Light")
    ], { dishesByIngredient: reach })[0];

    // Each alone is the same rate — the weighting only bites within a stall.
    expect(heavy.monthlyChange).toBeCloseTo(light.monthlyChange!, 6);
  });

  it("lets the wide ingredient dominate a stall that sells both", () => {
    const [line] = suppliers([
      r("butter", 30, 0, "Both"), r("butter", 36, 30, "Both"),   // +20%, 47 dishes
      r("mace", 30, 0, "Both"), r("mace", 15, 30, "Both")        // −50%, 2 dishes
    ], { dishesByIngredient: reach });

    // A flat mean would read about −15% and say the stall is getting cheaper.
    expect(line.monthlyChange).toBeGreaterThan(0);
  });

  it("falls back to equal weight when nothing knows the reach", () => {
    const [line] = suppliers([r("butter", 30, 0, "S"), r("butter", 36, 30, "S")]);
    expect(line.monthlyChange).toBeCloseTo(0.2, 6);
  });
});

describe("refusing to answer", () => {
  it("gives no rate for readings less than a fortnight apart", () => {
    // A bad week at one stall is not a rate. Same rule as lib/drift.ts.
    const [line] = suppliers([r("butter", 30, 0, "S"), r("butter", 36, 3, "S")]);
    expect(line.monthlyChange).toBeNull();
  });

  it("ignores a unit change rather than calling it a 900% rise", () => {
    const [line] = suppliers([
      { ...r("coriander", 4, 0, "S"), per: "bunch" },
      { ...r("coriander", 40, 60, "S"), per: "kg" }
    ]);
    expect(line.tracked).toBe(0);
    expect(line.monthlyChange).toBeNull();
  });

  it("says nothing at all when nothing has been priced", () => {
    expect(suppliers([])).toEqual([]);
  });
});

describe("what is worth a conversation", () => {
  it("keeps stalls moving more than the threshold, either way", () => {
    const lines = suppliers([
      r("a", 100, 0, "Up"), r("a", 130, 30, "Up"),
      r("b", 100, 0, "Down"), r("b", 70, 30, "Down"),
      r("c", 100, 0, "Flat"), r("c", 100.5, 30, "Flat")
    ]);
    expect(notable(lines).map((l) => l.source).sort()).toEqual(["Down", "Up"]);
  });

  it("counts the ingredients that have fallen", () => {
    const [line] = suppliers([
      r("a", 100, 0, "S"), r("a", 130, 30, "S"),
      r("b", 100, 0, "S"), r("b", 70, 30, "S")
    ]);
    expect(line.falling).toBe(1);
    expect(line.tracked).toBe(2);
  });

  it("names the worst single movement for the sentence a person reads", () => {
    const [line] = suppliers([
      r("butter", 30, 0, "S"), r("butter", 60, 30, "S"),
      r("lime", 10, 0, "S"), r("lime", 11, 30, "S")
    ]);
    expect(line.worst?.ingredientKey).toBe("butter");
  });

  it("takes a different threshold when asked", () => {
    const lines = suppliers([r("a", 100, 0, "S"), r("a", 101, 30, "S")]);
    expect(notable(lines, 0.005)).toHaveLength(1);
    expect(notable(lines, NOTABLE)).toHaveLength(0);
  });
});
