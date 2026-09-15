/**
 * A menu that proposes itself.
 *
 * Six constraints, none of them new. What was new is asking all six at once,
 * which is what a person does in their head when a client rings — and the
 * tests here are mostly about the order they are asked in, because the order
 * is the argument.
 *
 * The veda filter goes first and is never traded away: it is the law, and a
 * proposal that quietly includes a species in its closed season because the
 * margin was good is the single worst thing this file could do. The margin
 * constraint is the only one that may be relaxed, and when it is, the proposal
 * says so in a sentence.
 *
 * The seasonal window is a preference and not a filter, and that is deliberate:
 * data/ingredients.ts says every one of its months is a guess and all nine
 * still read verified: false. An unverified guess must not be able to take a
 * dish off a menu.
 */
import { propose, REASON_LABEL, CONSTRAINT_LABEL } from "@/lib/propose";
import { DISHES } from "@/data/dishes";
import { RECIPES } from "@/data/recipes";
import { VEDAS } from "@/data/vedas";
import { INGREDIENTS } from "@/data/ingredients";
import { illegalInMonth } from "@/lib/vedas";
import { foodCostRatio, FOOD_COST_TARGET } from "@/lib/pricing";
import { dietaryIndex, dishesFor } from "@/lib/dietary";

const base = {
  dishes: DISHES, recipes: RECIPES, vedas: VEDAS, ingredients: INGREDIENTS,
  month: 6, diets: [], want: 8
} as const;

const run = (over: Partial<Parameters<typeof propose>[0]> = {}) =>
  propose({ ...base, ...over });

describe("it proposes a menu at all", () => {
  it("returns the number of dishes asked for", () => {
    expect(run().menu).toHaveLength(8);
  });

  it("never repeats a dish", () => {
    const menu = run({ want: 20 }).menu;
    expect(new Set(menu.map((m) => m.dish.id)).size).toBe(menu.length);
  });

  it("says why every dish is on it", () => {
    for (const m of run().menu) {
      expect(m.reasons.length).toBeGreaterThan(0);
      for (const r of m.reasons) expect(REASON_LABEL[r]).toBeDefined();
    }
  });

  it("labels every reason and every constraint in both languages", () => {
    for (const v of Object.values(REASON_LABEL)) {
      expect(v.en.trim()).not.toBe("");
      expect(v.es.trim()).not.toBe("");
    }
    for (const v of Object.values(CONSTRAINT_LABEL)) {
      expect(v.en.trim()).not.toBe("");
      expect(v.es.trim()).not.toBe("");
      expect(v.en).not.toBe(v.es);
    }
  });
});

describe("the law comes first and is never traded away", () => {
  /*
   * A month where a veda actually removes a dish, found from the data rather
   * than assumed. Most closed months remove nothing: the closure has to
   * coincide with a recipe that names the species, and only a few do.
   */
  const closedMonth = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find(
    (m) => illegalInMonth(DISHES, RECIPES, VEDAS, m).size > 0
  )!;

  it("there is such a month in the data, or the tests below check nothing", () => {
    expect(closedMonth).toBeDefined();
    expect(VEDAS.length).toBeGreaterThan(0);
  });

  it("proposes nothing that is illegal to sell this month, in any month", () => {
    for (let month = 1; month <= 12; month++) {
      const illegal = illegalInMonth(DISHES, RECIPES, VEDAS, month);
      const menu = run({ month, want: 30 }).menu;
      for (const m of menu) expect(illegal.has(m.dish.id)).toBe(false);
    }
  });

  it("says which dishes the closed season took, and calls it an offence", () => {
    const { rejected } = run({ month: closedMonth, want: 30 });
    const veda = rejected.find((r) => r.constraint === "veda");
    expect(veda).toBeDefined();
    expect(veda!.dishes.length).toBeGreaterThan(0);
    expect(veda!.dishes[0].because).toMatch(/offence/);
  });

  it("still refuses when relaxing the margin would otherwise fill the menu", () => {
    // want far beyond what clears every constraint, so the relaxation runs.
    const { menu } = run({ month: closedMonth, want: 200 });
    const illegal = illegalInMonth(DISHES, RECIPES, VEDAS, closedMonth);
    expect(menu.length).toBeGreaterThan(50);
    for (const m of menu) expect(illegal.has(m.dish.id)).toBe(false);
  });
});

describe("safe for the people eating", () => {
  it("proposes nothing a vegan client cannot eat", () => {
    const index = dietaryIndex(RECIPES);
    const { menu } = run({ diets: ["vegan"], want: 10 });
    const safe = new Set(dishesFor(DISHES, index, ["vegan"]).map((d) => d.id));
    for (const m of menu) expect(safe.has(m.dish.id)).toBe(true);
  });

  it("holds for two diets at once, not just the first", () => {
    const index = dietaryIndex(RECIPES);
    const { menu } = run({ diets: ["vegan", "gluten-free"], want: 6 });
    const safe = new Set(dishesFor(DISHES, index, ["vegan", "gluten-free"]).map((d) => d.id));
    expect(menu.length).toBeGreaterThan(0);
    for (const m of menu) expect(safe.has(m.dish.id)).toBe(true);
  });

  it("says what it removed and why", () => {
    const { rejected } = run({ diets: ["vegan"], want: 6 });
    const diet = rejected.find((r) => r.constraint === "diet")!;
    expect(diet.dishes.length).toBeGreaterThan(0);
    expect(diet.dishes[0].because.trim()).not.toBe("");
  });

  it("removes nothing when the client has recorded no diets", () => {
    expect(run({ diets: [] }).rejected.some((r) => r.constraint === "diet")).toBe(false);
  });
});

describe("kit you actually own", () => {
  it("proposes nothing needing equipment that is not on the list", () => {
    const { menu } = run({ equipment: ["cold"], want: 6 });
    for (const m of menu) expect(m.dish.equipment).toEqual(["cold"]);
  });

  it("names the missing kit rather than just refusing", () => {
    const { rejected } = run({ equipment: ["cold"], want: 6 });
    const kit = rejected.find((r) => r.constraint === "equipment")!;
    expect(kit.dishes[0].because.trim()).not.toBe("");
  });

  it("filters nothing when no equipment list is given", () => {
    expect(run().rejected.some((r) => r.constraint === "equipment")).toBe(false);
  });
});

describe("margin — the only constraint that may give", () => {
  it("stays inside the food-cost target when it can", () => {
    for (const m of run({ want: 8 }).menu) {
      expect(m.foodCost).toBeLessThanOrEqual(FOOD_COST_TARGET.max);
    }
  });

  it("says so in a sentence when it has to go outside it", () => {
    // More dishes than clear every constraint, so the relaxation must run.
    const p = run({ want: 400 });
    expect(p.complete).toBe(false);
    expect(p.compromise).toBeTruthy();
    expect(p.menu.length).toBeGreaterThan(0);
  });

  it("takes the cheapest of the over-target dishes first when it relaxes", () => {
    const p = run({ want: 400 });
    const over = p.menu.filter((m) => m.foodCost > FOOD_COST_TARGET.max);
    if (over.length > 1) {
      const costs = over.map((m) => m.foodCost);
      expect([...costs].sort((a, b) => a - b)).toEqual(costs);
    }
  });

  it("marks nothing as a compromise when everything fits", () => {
    const p = run({ want: 6 });
    expect(p.complete).toBe(true);
    expect(p.compromise).toBeNull();
  });
});

describe("the Scottish half", () => {
  it("keeps British origins at or above half", () => {
    // Ranking by margin alone produces a Peruvian menu — the Lima pantry is
    // cheaper — and a Scottish-Peruvian caterer whose menu is not Scottish is
    // a caterer in Lima with a good spreadsheet.
    for (const want of [4, 8, 12, 20]) {
      expect(run({ want }).britishShare).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("holds even for a vegan menu, where the Scottish options are fewest", () => {
    const p = run({ diets: ["vegan"], want: 6 });
    expect(p.menu.length).toBeGreaterThan(0);
    expect(p.britishShare).toBeGreaterThanOrEqual(0.5);
  });

  it("still brings something that is not British, so it is a fusion menu", () => {
    expect(run({ want: 12 }).britishShare).toBeLessThan(1);
  });
});

describe("keeping what you already chose", () => {
  it("keeps them, and marks them as yours", () => {
    const mine = [DISHES[3].id, DISHES[9].id];
    const { menu } = run({ keep: mine, want: 8 });

    for (const id of mine) {
      const row = menu.find((m) => m.dish.id === id)!;
      expect(row).toBeDefined();
      expect(row.reasons).toContain("kept");
    }
  });

  it("counts them towards the total rather than adding to it", () => {
    expect(run({ keep: [DISHES[3].id, DISHES[9].id], want: 8 }).menu).toHaveLength(8);
  });

  it("never proposes a kept dish twice", () => {
    const menu = run({ keep: [DISHES[3].id], want: 8 }).menu;
    expect(menu.filter((m) => m.dish.id === DISHES[3].id)).toHaveLength(1);
  });
});

describe("the season is a preference, not a filter", () => {
  it("prefers a dish carrying something that peaks this month", () => {
    // March–June is lúcuma. A June menu should reach for it.
    const june = run({ month: 6, want: 20 }).menu;
    expect(june.some((m) => m.peaking.length > 0)).toBe(true);
  });

  it("still fills a menu in a month when nothing peaks at all", () => {
    const p = propose({ ...base, ingredients: [], want: 8 });
    expect(p.menu).toHaveLength(8);
    expect(p.menu.every((m) => m.peaking.length === 0)).toBe(true);
  });

  it("never removes a dish for being out of season", () => {
    // Every one of the nine seasonal windows is still verified: false. A guess
    // must not be able to take something off a menu.
    const kinds = run({ want: 30 }).rejected.map((r) => r.constraint);
    expect(kinds).not.toContain("season");
  });
});

describe("when almost nothing survives", () => {
  it("returns what it can and says why there is no more", () => {
    const p = propose({
      ...base, diets: ["vegan", "gluten-free", "low-fodmap", "nut-free"],
      equipment: ["cold"], want: 40
    });
    expect(p.complete).toBe(false);
    expect(p.compromise).toBeTruthy();
    expect(p.menu.length).toBeLessThan(40);
  });

  it("returns an empty menu rather than nonsense when nothing survives", () => {
    const p = propose({ ...base, dishes: [], want: 8 });
    expect(p.menu).toEqual([]);
    expect(p.britishShare).toBe(0);
    expect(p.complete).toBe(false);
  });

  it("every rejection carries a reason a person can read", () => {
    const p = propose({
      ...base, diets: ["vegan"], equipment: ["cold"], month: 2, want: 10
    });
    for (const group of p.rejected) {
      expect(group.dishes.length).toBeGreaterThan(0);
      for (const d of group.dishes) {
        expect(d.name.trim()).not.toBe("");
        expect(d.because.trim()).not.toBe("");
      }
    }
  });
});
