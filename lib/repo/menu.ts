/**
 * The menu as it actually stands: the shipped dishes, with the owner's edits
 * laid over them, in the language the reader reads.
 *
 * This module exists because of a hole worth naming. The admin screen could
 * write a dish edit — a new name, a new price, a rewritten description, in both
 * languages, and it insisted on the Spanish — and nothing in the entire app
 * ever read one back. An owner could rename a dish, see "Saved", and find the
 * old name still on every page. A change that is stored and never applied is
 * worse than a feature that does not exist, because the person believes they
 * have made it.
 *
 * Resolving the language here rather than in each component is what makes the
 * Spanish worth collecting. There are dozens of places that render a dish name;
 * a `locale === "es" ? d.nameEs : d.name` at each of them is a rule that holds
 * until somebody adds the next one. Resolved once, at the point the list is
 * loaded, every page is right without knowing why.
 *
 * What an edit may change is deliberately narrow: name, description, menu
 * price, category, tiers and whether it needs a licence. Business decisions,
 * all of them. What it may never change is cost, allergens or the vegetarian
 * flag — cost is derived from the recipe by lib/costing.ts and the allergens
 * by lib/dietary.ts, and this repository has already shipped hand-typed
 * allergens once. They disagreed with their own recipes on 165 of 223 dishes.
 */
import { DISHES } from "@/data/dishes";
import type { Dish } from "@/lib/dishes";
import type { Locale } from "@/lib/copy";
import { listDishEdits } from "./copy";

export type DishEdit = Awaited<ReturnType<typeof listDishEdits>>[number];

/**
 * Apply edits to a dish list. Pure, so it is tested without a database.
 *
 * A null column means "not edited", which is why every fallback is `??` rather
 * than `||`: an edit row is mostly nulls, and `e.price || d.price` would
 * quietly ignore an edited price of zero. Zero is refused in lib/repo/copy.ts,
 * but relying on that here is how two rules drift apart.
 */
export function applyDishEdits(
  dishes: Dish[], edits: DishEdit[], locale: Locale = "en"
): Dish[] {
  if (edits.length === 0) return dishes;
  const by = new Map(edits.map((e) => [e.dishId, e]));

  return dishes.map((d) => {
    const e = by.get(d.id);
    if (!e) return d;

    // The Spanish is only used when it exists; an edit that changed nothing but
    // the price carries none, and falling through to the English is correct.
    const name = (locale === "es" ? e.nameEs : e.name) ?? e.name ?? d.name;
    const fusion = (locale === "es" ? e.fusionEs : e.fusion) ?? e.fusion ?? d.fusion;

    return {
      ...d,
      name,
      fusion,
      price: e.price ?? d.price,
      category: (e.category ?? d.category) as Dish["category"],
      needsLicence: e.needsLicence ?? d.needsLicence,
      tiers: (e.tiers ?? d.tiers) as Dish["tiers"]
    };
  });
}

/**
 * The menu, edits applied, for a page to render.
 *
 * Falls back to the shipped list when there is no database. A page showing the
 * unedited menu is wrong in a small way; a page showing nothing at all is wrong
 * in a large one, and the database being asleep is a normal event on a free
 * tier.
 */
export async function menu(locale: Locale = "en"): Promise<Dish[]> {
  try {
    return applyDishEdits(DISHES, await listDishEdits(), locale);
  } catch {
    return DISHES;
  }
}
