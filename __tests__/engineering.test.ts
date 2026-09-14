/**
 * What sells, against what it earns.
 *
 * The four-box matrix is sixty years old and in every catering textbook. Almost
 * nobody builds one, because it needs two numbers that live in two systems that
 * have never spoken: how often a dish is chosen, and what it costs to make.
 * Here they are in one database, so the tests below can be about whether the
 * reasoning is sound rather than about whether the data can be got at.
 *
 * The distinction the tests protect hardest is between a dog and a dish nobody
 * has ever offered. Those are two completely different sentences — the market
 * rejected it, versus nobody put it in front of anyone — and a menu decision
 * taken on the wrong one deletes a dish that never had a chance.
 */
import { engineer, bleeding, BOX_LABEL, BOX_ADVICE, type Sold } from "@/lib/engineering";
import type { Dish } from "@/lib/dishes";
import { DISHES } from "@/data/dishes";
import { FOOD_COST_TARGET } from "@/lib/pricing";

const dish = (id: number, cost: number, price: number): Dish => ({
  ...DISHES[0], id, name: `Dish ${id}`, cost, price
});

const sold = (dishId: number, covers: number, quotes = 1, averagePrice?: number): Sold => ({
  dishId, covers, quotes, averagePrice: averagePrice ?? 0
});

describe("the four boxes", () => {
  /*
   * Four dishes, built so each lands in one box. Popularity is relative to an
   * even share of covers; margin is relative to the median.
   */
  const dishes = [
    dish(1, 10, 60),  // high margin
    dish(2, 45, 60),  // low margin
    dish(3, 10, 60),  // high margin
    dish(4, 45, 60)   // low margin
  ];
  const matrix = engineer(dishes, [
    sold(1, 400), // popular + earns  → star
    sold(2, 400), // popular + thin   → ploughhorse
    sold(3, 10),  // rare + earns     → puzzle
    sold(4, 10)   // rare + thin      → dog
  ]);

  const boxOf = (id: number) => matrix.rows.find((r) => r.dish.id === id)!.box;

  it("puts a dish that sells and earns in stars", () => expect(boxOf(1)).toBe("star"));
  it("puts a dish that sells and does not earn in ploughhorses",
    () => expect(boxOf(2)).toBe("ploughhorse"));
  it("puts a dish that earns and does not sell in puzzles",
    () => expect(boxOf(3)).toBe("puzzle"));
  it("puts a dish that does neither in dogs", () => expect(boxOf(4)).toBe("dog"));

  it("gives every box a label and a sentence of advice, in both languages", () => {
    for (const box of ["star", "ploughhorse", "puzzle", "dog"] as const) {
      expect(BOX_LABEL[box].en.trim()).not.toBe("");
      expect(BOX_LABEL[box].es.trim()).not.toBe("");
      expect(BOX_ADVICE[box].en.trim()).not.toBe("");
      expect(BOX_ADVICE[box].es.trim()).not.toBe("");
      expect(BOX_ADVICE[box].en).not.toBe(BOX_ADVICE[box].es);
    }
  });
});

describe("a dog and a dish nobody offered are different things", () => {
  const dishes = [dish(1, 10, 60), dish(2, 10, 60), dish(3, 10, 60)];

  it("sets a never-quoted dish aside rather than filing it as a dog", () => {
    const m = engineer(dishes, [sold(1, 100), sold(2, 5)]);
    expect(m.neverQuoted.map((d) => d.id)).toEqual([3]);
    expect(m.rows.find((r) => r.dish.id === 3)).toBeUndefined();
  });

  it("treats a dish quoted with zero covers as never quoted", () => {
    const m = engineer(dishes, [sold(1, 100), sold(2, 5), sold(3, 0, 1)]);
    expect(m.neverQuoted.map((d) => d.id)).toEqual([3]);
  });

  it("returns every dish as never-quoted when nothing has been won", () => {
    const m = engineer(dishes, []);
    expect(m.rows).toEqual([]);
    expect(m.neverQuoted).toHaveLength(3);
    expect(m.totalCovers).toBe(0);
  });
});

describe("the numbers", () => {
  it("uses the price as quoted, not the menu price as it stands today", () => {
    // Repricing the menu must not rewrite what last March actually earned.
    const [row] = engineer([dish(1, 20, 100)], [sold(1, 10, 1, 60)]).rows;
    expect(row.margin).toBe(40);
    expect(row.contribution).toBe(400);
  });

  it("falls back to the menu price when no average was recorded", () => {
    const [row] = engineer([dish(1, 20, 100)], [sold(1, 10)]).rows;
    expect(row.margin).toBe(80);
  });

  it("orders by what a dish actually earned, not by its percentage", () => {
    // 82% on four covers is interesting. 31% on nine hundred is the business.
    const dishes = [dish(1, 2, 11), dish(2, 40, 58)];
    const m = engineer(dishes, [sold(1, 4), sold(2, 900)]);
    expect(m.rows.map((r) => r.dish.id)).toEqual([2, 1]);
  });

  it("reports popularity as a share of covers, summing to one", () => {
    const m = engineer([dish(1, 10, 60), dish(2, 10, 60)], [sold(1, 300), sold(2, 100)]);
    const total = m.rows.reduce((n, r) => n + r.popularity, 0);
    expect(total).toBeCloseTo(1, 8);
    expect(m.rows.find((r) => r.dish.id === 1)!.popularity).toBeCloseTo(0.75, 8);
  });

  it("counts covers, not quotes — one wedding for 200 is not one canapé", () => {
    const m = engineer([dish(1, 10, 60), dish(2, 10, 60)], [
      sold(1, 200, 1),  // one big job
      sold(2, 20, 8)    // eight small ones
    ]);
    expect(m.rows.find((r) => r.dish.id === 1)!.box).toBe("star");
    expect(m.rows.find((r) => r.dish.id === 2)!.quotes).toBe(8);
  });

  it("puts the popularity line at 70% of an even share by default", () => {
    const m = engineer([dish(1, 10, 60), dish(2, 10, 60)], [sold(1, 50), sold(2, 50)]);
    expect(m.popularityLine).toBeCloseTo(0.35, 8);
  });

  it("takes a different line when the screen asks for one", () => {
    const m = engineer([dish(1, 10, 60), dish(2, 10, 60)], [sold(1, 50), sold(2, 50)],
      { popularityWeight: 1 });
    expect(m.popularityLine).toBeCloseTo(0.5, 8);
  });

  it("says how far above or below the line each dish is", () => {
    const m = engineer([dish(1, 10, 60), dish(2, 10, 60)], [sold(1, 70), sold(2, 30)]);
    const top = m.rows.find((r) => r.dish.id === 1)!;
    expect(top.relativePopularity).toBeCloseTo(0.7 / m.popularityLine, 6);
    expect(top.relativePopularity).toBeGreaterThan(1);
  });

  it("takes the median margin, not the mean, so one outlier does not move the line", () => {
    const dishes = [dish(1, 50, 60), dish(2, 50, 60), dish(3, 50, 60), dish(4, 1, 900)];
    const m = engineer(dishes, [sold(1, 10), sold(2, 10), sold(3, 10), sold(4, 10)]);
    expect(m.marginLine).toBe(10);
  });
});

describe("selling well and costing too much", () => {
  it("finds the popular dish that is over the food-cost target", () => {
    const over = dish(1, 40, 60);   // 67% food cost
    const fine = dish(2, 15, 60);   // 25%
    const m = engineer([over, fine], [sold(1, 500), sold(2, 500)]);

    expect(bleeding(m).map((r) => r.dish.id)).toEqual([1]);
    expect(over.cost / over.price).toBeGreaterThan(FOOD_COST_TARGET.max);
  });

  it("ignores an over-cost dish nobody orders — it is not costing you anything", () => {
    const m = engineer([dish(1, 40, 60), dish(2, 15, 60)], [sold(1, 2), sold(2, 800)]);
    expect(bleeding(m)).toEqual([]);
  });

  it("puts the highest volume first — that is where the money goes", () => {
    // Both over the target and both above the popularity line, so volume is
    // the only thing separating them.
    const m = engineer([dish(1, 40, 60), dish(2, 41, 60)], [sold(1, 500), sold(2, 700)]);
    expect(bleeding(m).map((r) => r.dish.id)).toEqual([2, 1]);
  });

  it("is empty when nothing has sold", () => {
    expect(bleeding(engineer([dish(1, 40, 60)], []))).toEqual([]);
  });
});

describe("against the real menu", () => {
  it("files every quoted dish in exactly one box, and loses none", () => {
    const s = DISHES.slice(0, 60).map((d, i) => sold(d.id, (i % 7) + 1, 1));
    const m = engineer(DISHES, s);

    expect(m.rows).toHaveLength(60);
    expect(m.rows.length + m.neverQuoted.length).toBe(DISHES.length);
    for (const r of m.rows) {
      expect(["star", "ploughhorse", "puzzle", "dog"]).toContain(r.box);
    }
  });

  it("never reports a food cost it did not get from the dish", () => {
    const s = DISHES.slice(0, 20).map((d) => sold(d.id, 10));
    for (const r of engineer(DISHES, s).rows) {
      expect(r.foodCost).toBeCloseTo(r.dish.cost / r.dish.price, 8);
    }
  });
});
