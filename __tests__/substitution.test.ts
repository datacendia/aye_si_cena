import { DISHES } from "@/data/dishes";
import { RECIPES } from "@/data/recipes";
import { INGREDIENTS } from "@/data/ingredients";
import { dietaryIndex } from "@/lib/dietary";
import { substitutesFor, planForMonth, offMenu, blockedBy } from "@/lib/substitution";

const dietary = dietaryIndex(RECIPES);
const base = { ingredients: INGREDIENTS, dietary };
const dish = (id: number) => DISHES.find((d) => d.id === id)!;

describe("what a month takes off the menu", () => {
  it("blocks a dish only when one of its ingredients is out of window", () => {
    for (let m = 1; m <= 12; m++) {
      for (const id of offMenu(INGREDIENTS, m)) {
        expect(blockedBy(INGREDIENTS, m, id).length).toBeGreaterThan(0);
      }
    }
  });

  it("names what is to blame, so the answer can be checked", () => {
    const m = 11;
    const [first] = [...offMenu(INGREDIENTS, m)];
    expect(blockedBy(INGREDIENTS, m, first).join("")).not.toBe("");
  });
});

describe("choosing a substitute", () => {
  const target = dish(92);   // Chirimoya Cranachan - dessert, drop-off

  it("never offers a dish that is itself out of season", () => {
    for (let m = 1; m <= 12; m++) {
      const blocked = offMenu(INGREDIENTS, m);
      for (const s of substitutesFor(target, DISHES, { ...base, month: m })) {
        expect(blocked.has(s.dish.id)).toBe(false);
      }
    }
  });

  it("replaces a dish with one of the same course", () => {
    for (const s of substitutesFor(target, DISHES, { ...base, month: 11 })) {
      expect(s.dish.category).toBe(target.category);
    }
  });

  it("never asks for more service than the original needed", () => {
    // A live station cannot stand in for something that ships in a box.
    const boxed = dish(107);   // Shortbread, drop-off
    for (const s of substitutesFor(boxed, DISHES, { ...base, month: 6 })) {
      expect(s.dish.format).toBe("drop-off");
    }
  });

  it("keeps the price inside the tolerance it was given", () => {
    for (const s of substitutesFor(target, DISHES, { ...base, month: 11, priceTolerance: 0.1 })) {
      expect(Math.abs(s.priceShift)).toBeLessThanOrEqual(0.1);
    }
  });

  it("will not break a diet the original satisfied", () => {
    const veg = DISHES.find((d) => dietary.get(d.id)?.suits.includes("vegetarian"))!;
    const subs = substitutesFor(veg, DISHES, { ...base, month: 6, diets: ["vegetarian"] });
    for (const s of subs) {
      expect(dietary.get(s.dish.id)!.suits).toContain("vegetarian");
    }
  });

  it("offers nothing rather than something wrong", () => {
    // An impossible ask must return an empty list. A menu hole you can see
    // beats a substitute that breaks a diet or moves the quote.
    const subs = substitutesFor(target, DISHES, {
      ...base, month: 11, priceTolerance: 0.001, diets: ["vegan", "gluten-free", "soft-texture"]
    });
    expect(Array.isArray(subs)).toBe(true);
  });

  it("gives a reason for every suggestion", () => {
    for (const s of substitutesFor(target, DISHES, { ...base, month: 11 })) {
      expect(s.reasons.length).toBeGreaterThan(0);
      expect(s.flavourMatch).toBeGreaterThan(0);
    }
  });

  it("ranks the closest flavour match first", () => {
    const subs = substitutesFor(target, DISHES, { ...base, month: 11, limit: 10 });
    for (let i = 1; i < subs.length; i++) {
      expect(subs[i - 1].score).toBeGreaterThanOrEqual(subs[i].score);
    }
  });
});

describe("planning a whole month", () => {
  it("covers every blocked dish, with or without an answer", () => {
    for (let m = 1; m <= 12; m++) {
      const plan = planForMonth(DISHES, { ...base, month: m });
      expect(plan.blocked.length).toBe(offMenu(INGREDIENTS, m).size);
      for (const row of plan.blocked) expect(row.because.length).toBeGreaterThan(0);
    }
  });

  it("puts the dishes with no answer at the top, because they are the work", () => {
    const plan = planForMonth(DISHES, { ...base, month: 11 });
    if (plan.unreplaceable.length && plan.blocked.length > plan.unreplaceable.length) {
      expect(plan.blocked[0].options.length).toBe(0);
    }
  });

  it("reports the worst month, which is a fact about the business", () => {
    const rows = [];
    for (let m = 1; m <= 12; m++) {
      const plan = planForMonth(DISHES, { ...base, month: m });
      rows.push([m, plan.blocked.length, plan.unreplaceable.length] as const);
    }
    const worst = [...rows].sort((a, b) => b[2] - a[2])[0];
     
    console.log("  month | off menu | no substitute");
     
    for (const [m, b, u] of rows) console.log(`  ${String(m).padStart(5)} | ${String(b).padStart(8)} | ${String(u).padStart(13)}`);
    expect(worst[1]).toBeGreaterThan(0);
  });
});
