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
  /** Indicative per-guest price including IGV, rounded up to a round number. */
  fromPerGuest: number;
  /** Dishes available at this tier. */
  dishes: number;
}

/**
 * What each tier comes to per head, worked out rather than asserted.
 *
 * The figure is built by running lib/pricing.ts over a real, plausible event —
 * the cheaper half of the dishes eligible at that tier, at twice the tier
 * minimum, delivered to a mid-distance district off-peak — and then rounded UP
 * to the nearest S/5. Rounding up matters: a "from" price a caterer then has to
 * exceed on every single quote is worse than no price at all.
 *
 * It is gross, because a guest asking "how much per person" is not asking for a
 * figure they then have to add 18% to.
 *
 * The dish costs used to get there never leave the server. Only the rounded
 * per-guest number is rendered.
 */
export async function publicPackages(locale: Locale = "es"): Promise<PublicPackage[]> {
  const { TIERS, buildQuote, IGV_RATE } = await import("./pricing");
  const { DISTRICTS, VENUE_TYPES } = await import("@/data/venues");
  const all = await menu(locale);

  const district = DISTRICTS.find((d) => d.id === "miraflores");
  const venue = VENUE_TYPES.find((v) => v.id === "house");

  return Object.values(TIERS).map((tier) => {
    const eligible = all.filter((d) => d.tiers.includes(tier.id));
    const guests = tier.minGuests * 2;

    // The cheaper half, so the "from" is a price somebody can actually be
    // quoted rather than the cheapest dish on the menu repeated six times.
    const byValue = [...eligible].sort((a, b) => a.price - b.price);
    const chosen = byValue.slice(0, Math.max(1, Math.ceil(byValue.length / 2)))
      .slice(0, tier.bitesPerGuest);

    let fromPerGuest = 0;
    if (chosen.length > 0) {
      const quote = buildQuote({ dishes: chosen, guests, tier: tier.id, district, venue, peak: false });
      fromPerGuest = Math.ceil((quote.netPerGuest * (1 + IGV_RATE)) / 5) * 5;
    }

    return {
      id: tier.id,
      name: tier.name,
      minGuests: tier.minGuests,
      bitesPerGuest: tier.bitesPerGuest,
      fromPerGuest,
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
const TIER_INCLUDES: Record<string, { en: string; es: string }[]> = {
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
