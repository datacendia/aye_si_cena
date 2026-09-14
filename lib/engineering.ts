/**
 * Menu engineering: what sells, against what it earns.
 *
 * The classic four-box matrix — stars, ploughhorses, puzzles and dogs — is
 * sixty years old and every catering textbook has it. Almost nobody can
 * actually build it, because it needs two numbers that normally live in two
 * systems that have never spoken: how often a dish is chosen, which is in the
 * sales system, and what it costs to make, which is in the recipe file or in
 * somebody's head.
 *
 * Here they are in one Postgres. Popularity comes from quote_dishes — the
 * dishes on quotes you actually won — and cost comes from the recipe, through
 * lib/costing.ts, priced with whatever has been verified at the market. So the
 * matrix is not an estimate of an estimate. It is the two things you know.
 *
 * What each box means, in the only terms that matter at this size:
 *
 *   star        sells, earns.        Protect it. Do not touch the price.
 *   ploughhorse sells, thin.         Everybody orders it and it pays for
 *                                    little. Reprice it, or shrink the portion,
 *                                    or find a cheaper line in the recipe.
 *   puzzle      earns, rarely sold.  The money is there and nobody is choosing
 *                                    it. Move it up the menu, rename it,
 *                                    suggest it — cheaper than reinventing it.
 *   dog         neither.             It is on the menu out of habit.
 *
 * The thresholds are relative, not absolute, and deliberately so. "Popular"
 * means more often than an even share of the dishes actually quoted — which for
 * 223 dishes is a very low bar, and is the honest one: a dish that beats the
 * average is doing better than the dish beside it, whatever the volume.
 */
import type { Dish } from "./dishes";
import { foodCostRatio, FOOD_COST_TARGET } from "./pricing";

export type Box = "star" | "ploughhorse" | "puzzle" | "dog";

export interface Sold {
  dishId: number;
  /** Quotes this dish appeared on. */
  quotes: number;
  /** Guests across those quotes — one wedding for 200 is not one canapé. */
  covers: number;
  /** What it was priced at when quoted, averaged. Not today's menu price. */
  averagePrice: number;
}

export interface Engineered {
  dish: Dish;
  box: Box;
  quotes: number;
  covers: number;
  /** Share of all covers quoted. */
  popularity: number;
  /** Contribution per cover, in soles: price minus food cost. */
  margin: number;
  foodCost: number;
  /** How far above or below the popularity line, as a multiple. 1 is on it. */
  relativePopularity: number;
  /**
   * What the dish earned across every won quote it appeared on. This is the
   * number that reorders the list away from what a percentage suggests.
   */
  contribution: number;
}

export interface Matrix {
  rows: Engineered[];
  /** The popularity line: an even share of covers across the dishes quoted. */
  popularityLine: number;
  /** The margin line: the median contribution per cover. */
  marginLine: number;
  /** Dishes never quoted at all. Not in a box — there is nothing to judge. */
  neverQuoted: Dish[];
  totalCovers: number;
}

/**
 * Build the matrix.
 *
 * A dish that has never been quoted is set aside rather than filed under "dog".
 * Those are two completely different statements — one says the market rejected
 * it, the other says nobody has offered it — and a menu decision taken on the
 * wrong one removes a dish that was never given a chance.
 */
export function engineer(
  dishes: Dish[], sold: Sold[], opts: { popularityWeight?: number } = {}
): Matrix {
  const by = new Map(sold.map((s) => [s.dishId, s]));
  const quoted = dishes.filter((d) => (by.get(d.id)?.covers ?? 0) > 0);

  if (quoted.length === 0) {
    return {
      rows: [], popularityLine: 0, marginLine: 0,
      neverQuoted: dishes, totalCovers: 0
    };
  }

  const totalCovers = quoted.reduce((n, d) => n + (by.get(d.id)?.covers ?? 0), 0);

  /*
   * The classic line is 70% of an even share, on the argument that a dish need
   * only be near the average to be worth keeping. Kept as a parameter because
   * it is a judgement, not a fact, and the screen should be able to move it.
   */
  const weight = opts.popularityWeight ?? 0.7;
  const popularityLine = (1 / quoted.length) * weight;

  const margins = quoted
    .map((d) => marginOf(d, by.get(d.id)))
    .sort((a, b) => a - b);
  const marginLine = median(margins);

  const rows: Engineered[] = quoted.map((d) => {
    const s = by.get(d.id)!;
    const popularity = s.covers / totalCovers;
    const margin = marginOf(d, s);
    const popular = popularity >= popularityLine;
    const earns = margin >= marginLine;

    return {
      dish: d,
      box: popular ? (earns ? "star" : "ploughhorse") : (earns ? "puzzle" : "dog"),
      quotes: s.quotes,
      covers: s.covers,
      popularity,
      margin,
      foodCost: foodCostRatio(d),
      relativePopularity: popularity / popularityLine,
      contribution: margin * s.covers
    };
  });

  // Biggest earner first. A dish at 82% margin on four covers is interesting;
  // a dish at 31% on nine hundred is the business.
  rows.sort((a, b) => b.contribution - a.contribution);

  return {
    rows,
    popularityLine,
    marginLine,
    neverQuoted: dishes.filter((d) => !(by.get(d.id)?.covers)),
    totalCovers
  };
}

/**
 * Contribution per cover: what the guest paid, less what the food cost.
 *
 * The price is what it was quoted at, not what the menu says today — that is
 * the number the client was actually charged, and repricing the menu must not
 * rewrite last March's margin. Falls back to the menu price for a dish with no
 * recorded average, which only happens when it has never been quoted.
 */
function marginOf(dish: Dish, sold?: Sold): number {
  const price = sold?.averagePrice && sold.averagePrice > 0 ? sold.averagePrice : dish.price;
  return price - dish.cost;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** What to do about it, in one sentence, in the box's own terms. */
export const BOX_ADVICE: Record<Box, { en: string; es: string }> = {
  star: {
    en: "Sells and earns. Leave the price alone and keep it on every menu you send.",
    es: "Se vende y deja. No toque el precio y póngalo en cada menú que envíe."
  },
  ploughhorse: {
    en: "Everybody picks it and it pays for little. Reprice it, shrink it, or find a cheaper line in the recipe.",
    es: "Todos lo eligen y deja poco. Suba el precio, reduzca la porción, o busque una línea más barata en la receta."
  },
  puzzle: {
    en: "The money is there and nobody chooses it. Move it up the menu or suggest it — far cheaper than reinventing it.",
    es: "El dinero está y nadie lo elige. Súbalo en el menú o recomiéndelo — mucho más barato que reinventarlo."
  },
  dog: {
    en: "Neither sells nor earns. It is on the menu out of habit.",
    es: "Ni se vende ni deja. Está en el menú por costumbre."
  }
};

export const BOX_LABEL: Record<Box, { en: string; es: string }> = {
  star: { en: "Stars", es: "Estrellas" },
  ploughhorse: { en: "Ploughhorses", es: "Caballos de tiro" },
  puzzle: { en: "Puzzles", es: "Enigmas" },
  dog: { en: "Dogs", es: "Perros" }
};

/**
 * A dish that is popular AND over the food-cost target is the sharpest single
 * finding this page can produce: every extra one you sell makes the problem
 * bigger. Separate from the boxes because it cuts across them.
 */
export function bleeding(matrix: Matrix): Engineered[] {
  return matrix.rows
    .filter((r) => r.popularity >= matrix.popularityLine)
    .filter((r) => r.foodCost > FOOD_COST_TARGET.max)
    .sort((a, b) => b.covers - a.covers);
}
