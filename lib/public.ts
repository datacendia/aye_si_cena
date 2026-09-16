/**
 * What a stranger may see.
 *
 * Everything else in this app is gated by lib/permissions.ts, which strips the
 * owner-only fields off a dish by naming them: `const { cost, source,
 * costVerified, ...rest } = dish`. That is a blacklist, and a blacklist is
 * correct exactly until somebody adds a field to `Dish`. Add `supplierNote`
 * next spring and it flows straight through to every audience, because nothing
 * named it.
 *
 * For a logged-in chef that is a small risk. For a page anybody on the internet
 * can open it is not a risk worth taking, so this module builds the public dish
 * by picking fields rather than by dropping them. A new field on `Dish` appears
 * on no public page until somebody adds it to PUBLIC_DISH_FIELDS below, on
 * purpose, in a commit somebody reviews.
 *
 * The list is the same shape a chef sees minus the recipe: no cost, no margin,
 * no supplier, no menu price. Allergens and diets ARE here, deliberately —
 * they are derived from the recipe by lib/dietary.ts, they are the single most
 * useful thing a guest can know before they ring, and hiding them would mean
 * the first conversation about a nut allergy happens on the phone instead of on
 * the page.
 */
import type { Dish } from "./dishes";
import type { Locale } from "./copy";
import { menu } from "./repo/menu";

/**
 * Every field a public page may render. Adding to this list is the only way a
 * new dish field reaches the internet.
 *
 * `price` is absent on purpose. A per-dish menu price is a negotiating
 * position, and quoting it publicly means every conversation starts from a
 * number set months ago for a different event in a different district. The
 * packages page advertises a per-guest figure instead, which is what a caterer
 * actually sells.
 */
export const PUBLIC_DISH_FIELDS = [
  "id", "name", "origin", "subOrigin", "contested", "fusion",
  "category", "format", "needsLicence", "veg", "keyIngredients",
  "allergens", "equipment", "tiers"
] as const;

export type PublicDish = Pick<Dish, (typeof PUBLIC_DISH_FIELDS)[number]>;

/** Fields that must never appear on a public page, for the test to assert. */
export const NEVER_PUBLIC = ["cost", "source", "costVerified", "price"] as const;

/** Build by picking. Anything not named simply does not exist downstream. */
export function publicDish(dish: Dish): PublicDish {
  const out = {} as Record<string, unknown>;
  for (const field of PUBLIC_DISH_FIELDS) out[field] = dish[field];
  return out as PublicDish;
}

export function publicDishes(dishes: Dish[]): PublicDish[] {
  return dishes.map(publicDish);
}

/**
 * The menu as a customer sees it.
 *
 * Reads through lib/repo/menu.ts like every other page, so an edit made in the
 * admin reaches the shop window too — and then narrows. A dish the owner has
 * renamed is renamed here, in the language the visitor is reading.
 */
export async function publicMenu(locale: Locale = "es"): Promise<PublicDish[]> {
  return publicDishes(await menu(locale));
}

/* ─────────────────────────── what it costs them ─────────────────────────── */

/**
 * A package as a customer sees it.
 *
 * The internal /packages page carries the cost structure — what a waiter shift
 * costs, what a chef shift costs, what the van costs. None of that is here.
 * What is here is what the guest gets and roughly what it comes to per head,
 * which is the only question anybody rings to ask.
 */
export interface PublicPackage {
  id: string;
  name: string;
  /** What the guest actually receives. */
  includes: { en: string; es: string }[];
  minGuests: number;
  bitesPerGuest: number;
  /**
   * Indicative per-guest price including IGV, rounded to a round number.
   *
   * `from` is a realistic entry menu, not the cheapest one that can be
   * assembled. `typical` is the middle of the range. Both matter: a range says
   * "this is a real conversation", a single floor says "this is what it costs"
   * and it is then the number every negotiation starts from.
   */
  fromPerGuest: number;
  typicalPerGuest: number;
  /** Dishes available at this tier. */
  dishes: number;
}

/**
 * What each tier comes to per head, worked out rather than asserted.
 *
 * The first version of this took the cheapest half of the eligible dishes and
 * called the result "from". It was arithmetically correct and commercially
 * wrong: it advertised S/75 for a plated service whose mid-range menu prices at
 * S/177 and whose top end is close to S/500. Nobody would have been quoted S/75
 * and every conversation would have started from it.
 *
 * So two figures, both from real menus run through lib/pricing.ts:
 *
 *   from     the 25th percentile of the eligible dishes by menu value — the
 *            cheapest menu somebody would actually be sent, not the cheapest
 *            that can be assembled.
 *   typical  the median. This is the number that describes the business.
 *
 * Both at twice the tier minimum, in a mid-distance district, off-peak, and
 * gross — a guest asking "how much per person" is not asking for a figure they
 * then add 18% to. `from` rounds DOWN and `typical` rounds UP, to the nearest
 * S/5, so the range printed is never narrower than the range priced.
 *
 * The dish costs used to get there never leave the server. Only the two rounded
 * per-guest numbers are rendered.
 */
export async function publicPackages(locale: Locale = "es"): Promise<PublicPackage[]> {
  const { TIERS, buildQuote, IGV_RATE } = await import("./pricing");
  const { DISTRICTS, VENUE_TYPES } = await import("@/data/venues");
  const { dishesForTier } = await import("./tiers");
  const { RECIPES } = await import("@/data/recipes");
  const all = await menu(locale);

  const district = DISTRICTS.find((d) => d.id === "miraflores");
  const venue = VENUE_TYPES.find((v) => v.id === "house");

  return Object.values(TIERS).map((tier) => {
    const eligible = dishesForTier(all, tier.id, RECIPES);
    const guests = tier.minGuests * 2;
    const byValue = [...eligible].sort((a, b) => a.price - b.price);

    /**
     * A menu shaped the way somebody would actually order it.
     *
     * lib/pricing.ts counts canapés as bites — `bitesPerGuest` pieces spread
     * across whichever canapés are chosen — but every other category as one
     * full portion per guest. So "the six dishes at the 25th percentile" is not
     * a cheap menu, it is six main courses each, and the figure it produced was
     * nonsense in both directions: it made the children's boxes dearer than the
     * adult ones and it put the top tier's median below its own floor.
     *
     * A real menu is canapés plus a plate or two. PLATES below says which, per
     * tier, and both figures are built the same way from different points in
     * the price list — so the range compares like with like.
     */
    const menuAt = (percentile: number) => {
      const from = (pool: typeof byValue, n: number) => {
        const start = Math.min(Math.floor(pool.length * percentile), Math.max(0, pool.length - n));
        return pool.slice(start, start + n);
      };

      const canapes = byValue.filter((d) => d.category === "canape");
      const chosen = [...from(canapes, 3)];

      for (const category of PLATES[tier.id] ?? []) {
        chosen.push(...from(byValue.filter((d) => d.category === category), 1));
      }
      return chosen.length > 0 ? chosen : byValue.slice(0, 1);
    };

    const perGuest = (dishes: typeof byValue) =>
      dishes.length === 0
        ? 0
        : buildQuote({ dishes, guests, tier: tier.id, district, venue, peak: false })
            .netPerGuest * (1 + IGV_RATE);

    const low = perGuest(menuAt(0.25));
    const mid = perGuest(menuAt(0.5));

    return {
      id: tier.id,
      name: tier.name,
      minGuests: tier.minGuests,
      bitesPerGuest: tier.bitesPerGuest,
      // Down for the floor, up for the middle: the printed range is never
      // narrower than the priced one.
      fromPerGuest: low > 0 ? Math.floor(low / 5) * 5 : 0,
      typicalPerGuest: mid > 0 ? Math.ceil(mid / 5) * 5 : 0,
      dishes: eligible.length,
      includes: TIER_INCLUDES[tier.id] ?? []
    };
  });
}

/**
 * What the guest gets, in their words rather than in the pricing engine's.
 *
 * "menajePerGuest: 27.5" is a line in a cost model. "China, glassware and linen,
 * hired and returned" is what somebody is buying. The two are kept apart
 * deliberately — one is a number that moves with a supplier, the other is a
 * promise.
 */
/**
 * What sits on the plate beside the canapés, per tier.
 *
 * Empty for the box tiers: a box is bites, and the engine already counts those
 * as `bitesPerGuest` pieces however many kinds go in it. The served tiers add
 * one full portion per category named here, which is what "a main and a
 * pudding" costs.
 */
const PLATES: Record<string, string[]> = {
  ninos: [],
  scran: [],
  buffet: ["main"],
  plated: ["main", "dessert"],
  ceilidh: ["main", "dessert"]
};

const TIER_INCLUDES: Record<string, { en: string; es: string }[]> = {
  ninos: [
    { en: "Individual boxes, nothing to heat, nothing to plate", es: "Cajas individuales, nada que calentar, nada que servir" },
    { en: "Not one dish contains alcohol", es: "Ningún plato contiene alcohol" },
    { en: "Drawn only from dishes children actually eat", es: "Solo platos que los niños de verdad comen" },
    { en: "Every allergen declared on the box, for the parents", es: "Cada alérgeno declarado en la caja, para los padres" }
  ],
  scran: [
    { en: "Individual boxes, delivered cold or hot", es: "Cajas individuales, entregadas frías o calientes" },
    { en: "No staff, no hired china, no liquor licence needed", es: "Sin personal, sin vajilla alquilada, sin licencia de licores" },
    { en: "Every allergen declared on the box", es: "Cada alérgeno declarado en la caja" },
    { en: "Delivery anywhere in Lima", es: "Entrega en toda Lima" }
  ],
  buffet: [
    { en: "Set up, served and cleared by our crew", es: "Montado, servido y recogido por nuestro equipo" },
    { en: "China, glassware and linen, hired and returned", es: "Vajilla, cristalería y mantelería, alquiladas y devueltas" },
    { en: "One chef on site", es: "Un chef en el local" },
    { en: "One floor server per 25 guests", es: "Un mozo por cada 25 invitados" }
  ],
  ceilidh: [
    { en: "A canapé reception, then courses to the table", es: "Una recepción de canapés y luego tiempos a la mesa" },
    { en: "Ten bites a head — the longest menu we do", es: "Diez bocados por persona — el menú más largo que hacemos" },
    { en: "Two chefs on site, one server per eight guests", es: "Dos chefs en el local, un mozo por cada ocho invitados" },
    { en: "Premium china, glassware and linen, hired and returned", es: "Vajilla, cristalería y mantelería premium, alquiladas y devueltas" },
    { en: "Menu tasting, and the menu written around your date", es: "Degustación, y el menú escrito alrededor de su fecha" }
  ],
  plated: [
    { en: "Courses to the table, timed to the room", es: "Tiempos a la mesa, al ritmo del evento" },
    { en: "China, glassware and linen, hired and returned", es: "Vajilla, cristalería y mantelería, alquiladas y devueltas" },
    { en: "One chef on site, one server per 12 guests", es: "Un chef en el local, un mozo por cada 12 invitados" },
    { en: "Menu tasting before the date", es: "Degustación del menú antes de la fecha" }
  ]
};

/**
 * Which diets each dish suits, for the customer-facing filters.
 *
 * Read off the recipe by lib/dietary.ts — the same engine that prints the
 * kitchen's declaration sheets and answers the client-record clash check. There
 * is no second list and no editable field: a customer filtering for "vegan" on
 * the public page and a chef reading the sheet on the day are being told the
 * same thing by the same code.
 *
 * Sent as a map beside the dishes rather than a field on them, so PUBLIC_DISH_FIELDS
 * stays the single description of what a dish itself carries.
 */
export async function publicDiets(): Promise<Record<number, string[]>> {
  const { dietaryIndex } = await import("./dietary");
  const { RECIPES } = await import("@/data/recipes");

  const out: Record<number, string[]> = {};
  for (const [dishId, entry] of dietaryIndex(RECIPES)) {
    // A dish with an unclassified ingredient claims nothing. Saying "vegan" on
    // a public page because nothing contradicted it is how somebody gets hurt.
    out[dishId] = entry.unknown.length > 0 ? [] : entry.suits;
  }
  return out;
}
