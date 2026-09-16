/**
 * Which dishes a tier can carry.
 *
 * Three tiers come from the spreadsheet's `tiers` column. Two are derived from
 * what a dish already says about itself, because the alternative was two more
 * hand-maintained columns across 223 rows — and this repository has shipped one
 * of those before. The allergen column disagreed with its own recipe on 165 of
 * 223 dishes and offered 50 gluten-bearing dishes as gluten-free. A rule cannot
 * drift; a column can, and did.
 *
 * The test that matters most here is the alcohol one. Cooking with alcohol is
 * legal in Peru without the giro especial, so `needsLicence` is about selling
 * it — but a children's party is not a licensing question, it is a "do not send
 * a whisky cranachan to a room of eight-year-olds" question. The rule is
 * absolute and is checked against all 223 dishes rather than a sample.
 */
import {
  dishFitsTier, dishesForTier, tierCounts, eligibleIdsByTier,
  isDerived, DERIVED_TIERS, SPREADSHEET_TIERS
} from "@/lib/tiers";
import { TIERS } from "@/lib/pricing";
import { DISHES } from "@/data/dishes";
import { RECIPES } from "@/data/recipes";
import { dietaryIndex } from "@/lib/dietary";
import type { ServiceTier } from "@/lib/dishes";

const ALL = Object.keys(TIERS) as ServiceTier[];
const index = dietaryIndex(RECIPES) as unknown as
  Map<number, { suits: string[]; unknown: string[] }>;

describe("the five tiers", () => {
  it("are the five the pricing engine knows about", () => {
    expect(ALL.sort()).toEqual(["ceilidh", "ninos", "plated", "scran", "buffet"].sort());
  });

  it("splits cleanly into spreadsheet-backed and derived", () => {
    expect([...SPREADSHEET_TIERS, ...DERIVED_TIERS].sort()).toEqual([...ALL].sort());
    for (const t of DERIVED_TIERS) expect(isDerived(t)).toBe(true);
    for (const t of SPREADSHEET_TIERS) expect(isDerived(t as ServiceTier)).toBe(false);
  });

  it("gives every tier a van-trip and load-crew figure", async () => {
    const { VAN_TRIPS, LOAD_CREW } = await import("@/lib/venues");
    for (const t of ALL) {
      expect(VAN_TRIPS[t]).toBeGreaterThan(0);
      expect(LOAD_CREW[t]).toBeGreaterThan(0);
    }
  });

  it("can carry at least a menu's worth of dishes each", () => {
    for (const t of ALL) {
      const eligible = dishesForTier(DISHES, t, RECIPES);
      expect(eligible.length).toBeGreaterThan(TIERS[t].bitesPerGuest);
    }
  });
});

describe("Wee Feast — the children's tier", () => {
  const eligible = dishesForTier(DISHES, "ninos", RECIPES);

  it("offers a real menu, not a handful", () => {
    expect(eligible.length).toBeGreaterThan(40);
  });

  it("contains not one dish with alcohol in it, across all 223", () => {
    // Absolute, and separate from the licence question. Selling alcohol needs
    // the giro especial; serving it to children needs nobody's permission and
    // is still not happening.
    expect(eligible.filter((d) => d.needsLicence)).toEqual([]);
    expect(eligible.filter((d) => d.allergens.includes("alcohol"))).toEqual([]);
  });

  it("is every dish kid-friendly per lib/dietary.ts, read off the recipe", () => {
    for (const d of eligible) {
      expect(index.get(d.id)?.suits).toContain("kid-friendly");
    }
  });

  it("excludes a dish whose recipe has an ingredient nobody has classified", () => {
    // Claiming "children can eat this" because nothing contradicted it is how
    // somebody gets hurt.
    for (const d of eligible) {
      expect(index.get(d.id)?.unknown).toEqual([]);
    }
  });

  it("only offers what can actually travel in a box", () => {
    for (const d of eligible) expect(d.tiers).toContain("scran");
  });

  it("is a subset of the boxes tier, never wider", () => {
    const boxes = new Set(dishesForTier(DISHES, "scran", RECIPES).map((d) => d.id));
    for (const d of eligible) expect(boxes.has(d.id)).toBe(true);
  });
});

describe("The Ceilidh Table — the top tier", () => {
  const eligible = dishesForTier(DISHES, "ceilidh", RECIPES);

  it("carries everything that can be plated", () => {
    const plated = dishesForTier(DISHES, "plated", RECIPES).map((d) => d.id).sort();
    expect(eligible.map((d) => d.id).sort()).toEqual(plated);
  });

  it("asks the most of the kitchen, so it takes the most kit", async () => {
    const { VAN_TRIPS, LOAD_CREW } = await import("@/lib/venues");
    for (const t of ["scran", "buffet", "plated"] as ServiceTier[]) {
      expect(VAN_TRIPS.ceilidh).toBeGreaterThanOrEqual(VAN_TRIPS[t]);
      expect(LOAD_CREW.ceilidh).toBeGreaterThanOrEqual(LOAD_CREW[t]);
    }
    expect(TIERS.ceilidh.chefs).toBeGreaterThan(TIERS.plated.chefs);
    expect(TIERS.ceilidh.guestsPerWaiter).toBeLessThan(TIERS.plated.guestsPerWaiter);
    expect(TIERS.ceilidh.bitesPerGuest).toBeGreaterThan(TIERS.plated.bitesPerGuest);
  });
});

describe("the spreadsheet tiers still answer from the column", () => {
  it.each(SPREADSHEET_TIERS)("%s matches the dish's own tiers array", (tier) => {
    const byRule = dishesForTier(DISHES, tier as ServiceTier, RECIPES).map((d) => d.id).sort();
    const byColumn = DISHES.filter((d) => d.tiers.includes(tier as ServiceTier))
      .map((d) => d.id).sort();
    expect(byRule).toEqual(byColumn);
  });
});

describe("the helpers agree with each other", () => {
  it("tierCounts matches dishesForTier for every tier", () => {
    const counts = tierCounts(DISHES, ALL, RECIPES);
    for (const t of ALL) {
      expect(counts[t]).toBe(dishesForTier(DISHES, t, RECIPES).length);
    }
  });

  it("eligibleIdsByTier matches dishesForTier for every tier", () => {
    const ids = eligibleIdsByTier(DISHES, ALL, RECIPES);
    for (const t of ALL) {
      expect([...ids[t]].sort()).toEqual(dishesForTier(DISHES, t, RECIPES).map((d) => d.id).sort());
    }
  });

  it("dishFitsTier without an index still answers for the spreadsheet tiers", () => {
    for (const t of SPREADSHEET_TIERS) {
      expect(dishFitsTier(DISHES[0], t as ServiceTier))
        .toBe(DISHES[0].tiers.includes(t as ServiceTier));
    }
  });

  it("refuses to guess for a derived tier with no index rather than saying yes", () => {
    // Without the recipes there is no way to know whether a dish is
    // kid-friendly, and "probably" is not an answer to that question.
    const kid = dishesForTier(DISHES, "ninos", RECIPES)[0];
    expect(dishFitsTier(kid, "ninos")).toBe(false);
  });
});

describe("the price ladder", () => {
  it("climbs: each tier asks more of the kitchen than the one below", () => {
    const order: ServiceTier[] = ["ninos", "scran", "buffet", "plated", "ceilidh"];
    const effort = (t: ServiceTier) =>
      TIERS[t].chefs * 2 +
      (TIERS[t].guestsPerWaiter > 0 ? 40 / TIERS[t].guestsPerWaiter : 0) +
      TIERS[t].menajePerGuest / 10;

    for (let i = 1; i < order.length; i++) {
      expect(effort(order[i])).toBeGreaterThanOrEqual(effort(order[i - 1]));
    }
  });

  it("gives the children's tier no staff and no chef — it is a delivery", () => {
    expect(TIERS.ninos.chefs).toBe(0);
    expect(TIERS.ninos.guestsPerWaiter).toBe(0);
    expect(TIERS.ninos.menajePerGuest).toBe(0);
  });
});

describe("event filters only name tiers the spreadsheet answers for", () => {
  /**
   * matchesEvent() in lib/dishes.ts checks `dish.tiers.includes(filter.tier)`
   * directly, and it has to: it is a pure hot function used in client
   * components that have no recipes to derive from.
   *
   * That is correct for as long as no event or moment filter names a derived
   * tier. If one ever does, matchesEvent will quietly return false for every
   * dish rather than answer wrongly — which is the safe direction, but it would
   * look like an empty pane. This fails first instead.
   */
  it("no event or moment filter asks for ninos or ceilidh", () => {
    const { EVENTS } = require("@/data/events");
    const { MOMENTS } = require("@/data/moments");

    const named = [...EVENTS, ...MOMENTS]
      .map((e: { id: string; filter?: { tier?: string } }) => e.filter?.tier)
      .filter(Boolean) as string[];

    for (const tier of named) {
      expect(DERIVED_TIERS as readonly string[]).not.toContain(tier);
    }
  });
});
