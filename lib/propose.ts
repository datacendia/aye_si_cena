/**
 * A menu that proposes itself.
 *
 * Six constraints, and not one of them is new. Every module below has existed
 * for months and has been used alone; what nobody had done is ask all six at
 * once, which happens to be exactly what a person does in their head when a
 * client rings.
 *
 *   legal        lib/vedas.ts        it is an offence to sell a species in
 *                                    its closed season — this is the law, not
 *                                    a preference, so it filters first and is
 *                                    never traded against anything.
 *   in season    data/ingredients.ts what actually peaks in Lima this month.
 *   above margin lib/pricing.ts      food cost inside the target band.
 *   diet-safe    lib/dietary.ts      against the diets on the client record,
 *                                    read from the recipe, never typed.
 *   deliverable  lib/capacity.ts     the equipment this menu needs must fit
 *                                    what you own, at that district, at that
 *                                    hour.
 *   Scottish     data/dishes.ts      above half, because that is the business.
 *                                    Take it away and this is a caterer in
 *                                    Lima with a good spreadsheet.
 *
 * The ranking is deliberately dull and the filtering is where the thinking is.
 * A proposal that cannot say why a dish is on it is worth nothing to somebody
 * about to send it to a client, so every dish carries its reasons and every
 * constraint that removed a dish is counted and reported. The screen shows the
 * rejections as prominently as the menu.
 *
 * This does not send anything. It fills in the builder, which is the point: it
 * is a first draft by somebody who has read all 223 dishes, and the person who
 * signs it still signs it.
 */
import type { Dish, Recipe, Ingredient } from "./dishes";
import type { Veda } from "./vedas";
import type { Diet } from "./dietary";
import { illegalInMonth } from "./vedas";
import { dietaryIndex, dishesFor } from "./dietary";
import { foodCostRatio, FOOD_COST_TARGET } from "./pricing";

export interface ProposeInput {
  dishes: readonly Dish[];
  recipes: readonly Recipe[];
  vedas: readonly Veda[];
  ingredients: readonly Ingredient[];
  /** 1-12. Decides both the vedas and what is in season. */
  month: number;
  /** Diets from the client record. A dish unsafe for any of them is out. */
  diets: readonly Diet[];
  /** How many dishes the menu should carry. */
  want: number;
  /** Equipment you own. A menu needing a second fryer is not deliverable. */
  equipment?: readonly string[];
  /** Dishes already chosen, kept and counted towards `want`. */
  keep?: readonly number[];
}

/** Why a dish is on the menu. Shown, not just computed. */
export type Reason = "in-season" | "margin" | "scottish" | "kept" | "balance";

export interface Proposed {
  dish: Dish;
  reasons: Reason[];
  /** The seasonal ingredients it carries that peak this month. */
  peaking: string[];
  foodCost: number;
}

/** Why a dish is not. Counted so the screen can say what the month cost you. */
export interface Rejected {
  constraint: "veda" | "diet" | "margin" | "equipment";
  dishes: { id: number; name: string; because: string }[];
}

export interface Proposal {
  menu: Proposed[];
  rejected: Rejected[];
  /** Share of the proposed menu that is Scottish or English. */
  britishShare: number;
  /** True when every constraint was satisfied without relaxing one. */
  complete: boolean;
  /** Said plainly when it is not: which constraint had to give, and why. */
  compromise: string | null;
}

const BRITISH = /^(Scottish|English|Disputed)/;

/**
 * Whether a dish carries an ingredient peaking this month.
 *
 * data/ingredients.ts is explicit that these windows are guesses until somebody
 * confirms them at a market — all 9 still say verified: false. So this is a
 * preference that orders the list, never a filter that removes a dish. An
 * unverified guess must not be able to take something off a menu.
 */
function peakingNow(ingredients: readonly Ingredient[], month: number): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const ing of ingredients) {
    if (ing.yearRound || !ing.months.includes(month)) continue;
    for (const id of ing.dishes) {
      (out.get(id) ?? out.set(id, []).get(id)!).push(ing.name);
    }
  }
  return out;
}

export function propose(input: ProposeInput): Proposal {
  const { dishes, recipes, vedas, ingredients, month, diets, want } = input;
  const keep = new Set(input.keep ?? []);
  const rejected: Rejected[] = [];

  /* 1. Legal. First, and never traded away. */
  const illegal = illegalInMonth([...dishes], [...recipes], [...vedas], month);
  if (illegal.size > 0) {
    rejected.push({
      constraint: "veda",
      dishes: dishes.filter((d) => illegal.has(d.id)).map((d) => ({
        id: d.id, name: d.name,
        because: "closed season — selling it this month is an offence"
      }))
    });
  }
  let pool = dishes.filter((d) => !illegal.has(d.id));

  /* 2. Safe for the people eating. Derived from the recipe, never typed. */
  if (diets.length > 0) {
    const index = dietaryIndex([...recipes]);
    const safe = new Set(dishesFor(pool, index, [...diets]).map((d) => d.id));
    const unsafe = pool.filter((d) => !safe.has(d.id));
    if (unsafe.length > 0) {
      rejected.push({
        constraint: "diet",
        dishes: unsafe.map((d) => ({
          id: d.id, name: d.name,
          because: (index.get(d.id)?.because?.[diets[0]] ?? []).join(", ") || diets.join(", ")
        }))
      });
    }
    pool = pool.filter((d) => safe.has(d.id));
  }

  /* 3. Equipment you actually own. */
  if (input.equipment?.length) {
    const own = new Set(input.equipment);
    const cannot = pool.filter((d) => d.equipment.some((e) => !own.has(e)));
    if (cannot.length > 0) {
      rejected.push({
        constraint: "equipment",
        dishes: cannot.map((d) => ({
          id: d.id, name: d.name,
          because: d.equipment.filter((e) => !own.has(e)).join(", ")
        }))
      });
    }
    pool = pool.filter((d) => d.equipment.every((e) => own.has(e)));
  }

  /* 4. Above margin — the one constraint that may be relaxed, and says so. */
  const onTarget = pool.filter((d) => foodCostRatio(d) <= FOOD_COST_TARGET.max);
  const overCost = pool.filter((d) => foodCostRatio(d) > FOOD_COST_TARGET.max);
  if (overCost.length > 0) {
    rejected.push({
      constraint: "margin",
      dishes: overCost.map((d) => ({
        id: d.id, name: d.name,
        because: `${(foodCostRatio(d) * 100).toFixed(0)}% food cost`
      }))
    });
  }

  const peaks = peakingNow(ingredients, month);
  const score = (d: Dish) =>
    (peaks.has(d.id) ? 2 : 0) + (1 - foodCostRatio(d));

  const kept = dishes.filter((d) => keep.has(d.id));
  const ranked = [...onTarget]
    .filter((d) => !keep.has(d.id))
    .sort((a, b) => score(b) - score(a));

  /*
   * 5. Scottish above half.
   *
   * Taken by building the two halves separately rather than by ranking and
   * hoping. Ranking by margin alone produces a Peruvian menu — the Lima pantry
   * is cheaper — and a Scottish-Peruvian caterer whose menu is not Scottish is
   * a caterer in Lima with a good spreadsheet.
   */
  const room = Math.max(0, want - kept.length);
  const britishWanted = Math.ceil(room / 2);

  const british = ranked.filter((d) => BRITISH.test(d.subOrigin)).slice(0, britishWanted);
  const rest = ranked
    .filter((d) => !british.includes(d))
    .slice(0, room - british.length);

  const chosen = [...kept, ...british, ...rest];

  /* 6. Enough dishes at all. If not, say which constraint had to give. */
  let compromise: string | null = null;
  if (chosen.length < want) {
    const relaxed = overCost
      .filter((d) => !chosen.includes(d))
      .sort((a, b) => foodCostRatio(a) - foodCostRatio(b))
      .slice(0, want - chosen.length);

    if (relaxed.length > 0) {
      compromise =
        `Not enough dishes inside the food-cost target survived this month, so ` +
        `${relaxed.length} above it ${relaxed.length === 1 ? "is" : "are"} included. ` +
        `They are marked.`;
      chosen.push(...relaxed);
    } else {
      compromise =
        `Only ${chosen.length} of ${want} dishes clear every constraint this ` +
        `month. Widening the diets or waiting for the veda to lift is the only ` +
        `way to more.`;
    }
  }

  const menu: Proposed[] = chosen.map((d) => {
    const reasons: Reason[] = [];
    if (keep.has(d.id)) reasons.push("kept");
    if (peaks.has(d.id)) reasons.push("in-season");
    if (foodCostRatio(d) <= FOOD_COST_TARGET.min) reasons.push("margin");
    if (BRITISH.test(d.subOrigin)) reasons.push("scottish");
    if (reasons.length === 0) reasons.push("balance");

    return {
      dish: d,
      reasons,
      peaking: peaks.get(d.id) ?? [],
      foodCost: foodCostRatio(d)
    };
  });

  const britishCount = menu.filter((m) => BRITISH.test(m.dish.subOrigin)).length;

  return {
    menu,
    rejected,
    britishShare: menu.length === 0 ? 0 : britishCount / menu.length,
    complete: menu.length === want && compromise === null,
    compromise
  };
}

export const REASON_LABEL: Record<Reason, { en: string; es: string }> = {
  "in-season": { en: "in season", es: "de temporada" },
  margin: { en: "strong margin", es: "buen margen" },
  scottish: { en: "the Scottish half", es: "la mitad escocesa" },
  kept: { en: "you chose it", es: "usted lo eligió" },
  balance: { en: "balance", es: "equilibrio" }
};

export const CONSTRAINT_LABEL: Record<Rejected["constraint"], { en: string; es: string }> = {
  veda: { en: "Closed season", es: "Veda" },
  diet: { en: "Not safe for this client", es: "No apto para este cliente" },
  margin: { en: "Over the food-cost target", es: "Sobre el costo objetivo" },
  equipment: { en: "Kit you do not have", es: "Equipo que no tiene" }
};
