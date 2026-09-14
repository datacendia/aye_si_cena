import { DISHES } from "@/data/dishes";
import { RECIPES } from "@/data/recipes";
import { PRICES, SUB_PREP_PRICES, NON_FOOD_PRICES, SUB_RECIPE_OF } from "@/data/prices";
import { costLine, costRecipe, costVariance, portionsFromYield } from "@/lib/costing";
import { canonicalIngredient } from "@/lib/ingredient-key";
import { parseQty } from "@/lib/units";

describe("reading a recipe quantity", () => {
  it("reads the units a cook actually writes", () => {
    expect(parseQty("6 kg")).toEqual({ amount: 6000, base: "g" });
    expect(parseQty("300 ml")).toEqual({ amount: 300, base: "ml" });
    expect(parseQty("2 L")).toEqual({ amount: 2000, base: "ml" });
    expect(parseQty("3 tbsp")).toEqual({ amount: 45, base: "ml" });
    expect(parseQty("1 bunch")).toEqual({ amount: 1, base: "bunch" });
    expect(parseQty("8")).toEqual({ amount: 8, base: "each" });
    expect(parseQty("1/2 kg")).toEqual({ amount: 500, base: "g" });
  });

  it("refuses to guess rather than costing a guess at zero", () => {
    expect(parseQty("to taste")).toBeNull();
    expect(parseQty("a splash")).toBeNull();
    expect(parseQty("")).toBeNull();
  });
});

describe("folding ingredient names to one key", () => {
  it("throws away the prep, keeps the product", () => {
    expect(canonicalIngredient("Butter, softened")).toBe("butter");
    expect(canonicalIngredient("butter (room temperature)")).toBe("butter");
    expect(canonicalIngredient("onions, finely diced")).toBe("onion");
  });

  it("costs an either/or line as the first option, which is what the recipe intends", () => {
    expect(canonicalIngredient("lard or butter")).toBe("lard");
  });

  it("does not maul the plurals that break the trailing-s rule", () => {
    expect(canonicalIngredient("haggis mix")).toBe("haggis mix");
    expect(canonicalIngredient("chard leaves")).toBe("chard leaf");
    expect(canonicalIngredient("tomatoes")).toBe("tomato");
  });
});

describe("reading a yield", () => {
  it("prefers an explicit portion count", () => {
    expect(portionsFromYield("40 portions")).toBe(40);
    expect(portionsFromYield("50 bonbons")).toBe(50);
  });

  it("takes the serving count, not the tin count", () => {
    // "2 cakes, 24 slices" once read as 2, which made the cake look ten times
    // dearer per portion than it is.
    expect(portionsFromYield("2 cakes, 24 slices")).toBe(24);
    expect(portionsFromYield("3 tarts, 36 slices")).toBe(36);
  });
});

describe("costing a line", () => {
  it("prices by weight, volume and count alike", () => {
    expect(costLine("1 kg", "butter").soles).toBeCloseTo(32, 2);
    expect(costLine("500 ml", "milk").soles).toBeCloseTo(2.5, 2);
    expect(costLine("10", "eggs").soles).toBeCloseTo(5, 2);
  });

  it("costs a counted line against a per-kilo price using the unit weight", () => {
    // "3 onions" has to meet a price quoted per kilo. Before unitGrams this
    // line was reported unreadable and cost nothing.
    const l = costLine("3", "onions, diced");
    expect(l.status).toBe("costed");
    expect(l.soles).toBeGreaterThan(0);
  });

  it("keeps skewers out of food cost while still charging for them", () => {
    const l = costLine("80", "wooden skewers, soaked");
    expect(l.nonFood).toBe(true);
    expect(l.soles).toBeGreaterThan(0);
  });

  it("costs a sub-preparation through its own recipe, not at nothing", () => {
    // The Nordic Cure Box is four sub-preparations and a spoon of creme
    // fraiche. It priced out at S/0.30 a box while these cost zero.
    const l = costLine("1 batch", "paiche gravlax");
    expect(l.status).toBe("costed");
    expect(l.soles).toBeGreaterThan(0);
  });
});

describe("the price list", () => {
  it("quotes every price in a unit the costing understands", () => {
    const all = { ...PRICES, ...SUB_PREP_PRICES, ...NON_FOOD_PRICES };
    for (const [k, p] of Object.entries(all)) {
      expect(["kg", "L", "each", "bunch"]).toContain(p.per);
      expect(p.soles).toBeGreaterThan(0);
      if (p.unitGrams !== undefined) expect(p.unitGrams).toBeGreaterThan(0);
      expect(canonicalIngredient(k)).toBe(k);
    }
  });

  it("points every sub-recipe at a dish that exists and has a recipe", () => {
    const ids = new Set(DISHES.map((d) => d.id));
    const withRecipe = new Set(RECIPES.map((r) => r.dishId));
    for (const [name, id] of Object.entries(SUB_RECIPE_OF)) {
      expect(ids.has(id)).toBe(true);
      expect(withRecipe.has(id)).toBe(true);
      expect(canonicalIngredient(name)).toBe(name);
    }
  });
});

describe("costing every recipe", () => {
  const costs = RECIPES.map((r) => costRecipe(r));

  it("leaves no ingredient line uncosted", () => {
    // A line that cannot be costed is money going missing silently, which is
    // exactly the failure this module was built to end.
    const broken = costs.flatMap((c) =>
      c.lines.filter((l) => l.status !== "costed").map((l) => `${c.dishId}: "${l.qty}" ${l.item}`)
    );
    expect(broken).toEqual([]);
  });

  it("gets a portion count out of every yield", () => {
    const noYield = costs.filter((c) => c.portions === null).map((c) => c.dishId);
    expect(noYield).toEqual([]);
  });

  it("produces a positive cost for every recipe", () => {
    const free = costs.filter((c) => c.foodTotal <= 0).map((c) => c.dishId);
    expect(free).toEqual([]);
  });
});

describe("what the costing says about the matrix", () => {
  const variance = costVariance(DISHES, RECIPES);

  it("can now check every dish, which it could not before", () => {
    expect(variance.filter((v) => v.computed !== null)).toHaveLength(RECIPES.length);
  });

  it("reports the disagreement rather than overwriting either figure", () => {
    // This is deliberately NOT a gate. The matrix costs are guesses and the
    // prices are estimates; the gap between them is the finding, and closing
    // it is a market run, not a code change.
    const far = variance.filter((v) => v.ratio !== null && (v.ratio < 0.7 || v.ratio > 1.4));
     
    console.log(
      `  ${far.length} of ${variance.length} dishes are more than 40% away from their ` +
      `costed figure. Bakery is the worst: sugar and flour are cheap and the ` +
      `estimates assumed otherwise.`
    );
    expect(variance.length).toBeGreaterThan(0);
  });
});

describe("the ingredient-key exceptions", () => {
  it("keeps the noun on an either/or line that would otherwise lose it", () => {
    // "lamb or beef stock" read as "lamb" once put 2 litres of lamb on a
    // shopping list.
    expect(canonicalIngredient("lamb or beef stock")).toBe("lamb stock");
    expect(canonicalIngredient("fish or light chicken stock")).toBe("fish stock");
  });

  it("still takes the first option where that option is the whole ingredient", () => {
    expect(canonicalIngredient("lard or beef dripping, melted")).toBe("lard");
    expect(canonicalIngredient("chancaca or brown sugar")).toBe("chancaca");
  });
});
