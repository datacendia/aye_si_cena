/**
 * The menu as it actually stands, against a real Postgres.
 *
 * This exists because of a hole worth naming plainly: the admin screen could
 * write a dish edit — and it insisted on a Spanish name to do it — and nothing
 * in the entire app ever read one back. An owner could rename a dish, see
 * "Saved", and find the old name on every page. Stored and never applied is
 * worse than absent, because the person believes they have made the change.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import { migrate, reset, close, makeUser } from "./helpers/pglite";
import { applyDishEdits, menu } from "@/lib/repo/menu";
import { saveDishEdit } from "@/lib/repo/copy";
import { DISHES } from "@/data/dishes";
import type { Viewer } from "@/lib/session";

let owner: Viewer;
const D = DISHES[0];

beforeAll(migrate);
afterAll(close);
beforeEach(async () => {
  await reset();
  owner = await makeUser("owner");
});

const edit = (over: Record<string, unknown> = {}) => [{
  dishId: D.id, name: null, nameEs: null, fusion: null, fusionEs: null,
  price: null, category: null, needsLicence: null, tiers: null,
  updatedBy: null, updatedAt: new Date(), ...over
}] as Parameters<typeof applyDishEdits>[1];

describe("applying an edit", () => {
  it("changes nothing when there are no edits, and returns the same array", () => {
    expect(applyDishEdits(DISHES, [])).toBe(DISHES);
  });

  it("leaves every dish that was not edited alone", () => {
    const out = applyDishEdits(DISHES, edit({ name: "Renamed" }));
    expect(out.filter((d) => d.id !== D.id))
      .toEqual(DISHES.filter((d) => d.id !== D.id));
  });

  it("takes the new name, price, category and licence", () => {
    const [d] = applyDishEdits([D], edit({
      name: "Haggis Bon Bon", price: 44, category: "canape", needsLicence: true
    }));
    expect(d).toMatchObject({
      name: "Haggis Bon Bon", price: 44, category: "canape", needsLicence: true
    });
  });

  it("keeps the shipped value for every column the edit left null", () => {
    const [d] = applyDishEdits([D], edit({ price: 44 }));
    expect(d.name).toBe(D.name);
    expect(d.fusion).toBe(D.fusion);
    expect(d.category).toBe(D.category);
    expect(d.needsLicence).toBe(D.needsLicence);
  });

  it("never touches cost, allergens or the vegetarian flag", () => {
    // Those are derived from the recipe. This repository shipped hand-typed
    // allergens once; they disagreed with their own recipes on 165 of 223.
    const [d] = applyDishEdits([D], edit({
      name: "Renamed", price: 44,
      // Even if a row somehow carried them, they are not read.
      cost: 999, allergens: ["gluten"], veg: !D.veg
    }));
    expect(d.cost).toBe(D.cost);
    expect(d.allergens).toEqual(D.allergens);
    expect(d.veg).toBe(D.veg);
  });

  it("uses ?? not ||, so an edited price of zero is not silently ignored", () => {
    // Zero is refused by lib/repo/copy.ts. Relying on that here is how two
    // rules drift apart, so this reads the column rather than its truthiness.
    const [d] = applyDishEdits([D], edit({ price: 0 }));
    expect(d.price).toBe(0);
  });
});

describe("the language it renders in", () => {
  it("shows the Spanish name to a Spanish reader", () => {
    const [d] = applyDishEdits([D], edit({
      name: "Haggis Bon Bon", nameEs: "Bombón de Haggis",
      fusion: "Highland meets Andes", fusionEs: "Las Tierras Altas y los Andes"
    }), "es");
    expect(d.name).toBe("Bombón de Haggis");
    expect(d.fusion).toBe("Las Tierras Altas y los Andes");
  });

  it("shows the English to an English reader", () => {
    const [d] = applyDishEdits([D], edit({
      name: "Haggis Bon Bon", nameEs: "Bombón de Haggis"
    }), "en");
    expect(d.name).toBe("Haggis Bon Bon");
  });

  it("falls back to the English when an edit carries no Spanish", () => {
    // An edit that changed only the price carries neither, and an edit made
    // before the Spanish was compulsory may carry only the English.
    const [d] = applyDishEdits([D], edit({ name: "Haggis Bon Bon" }), "es");
    expect(d.name).toBe("Haggis Bon Bon");
  });

  it("falls back to the shipped name when the edit touched neither", () => {
    const [d] = applyDishEdits([D], edit({ price: 44 }), "es");
    expect(d.name).toBe(D.name);
  });
});

describe("reading it back out of the database", () => {
  it("an edit saved in the admin reaches the menu", async () => {
    await saveDishEdit(owner, {
      dishId: D.id, name: "Haggis Bon Bon", nameEs: "Bombón de Haggis", price: 44
    });

    const en = await menu("en");
    const es = await menu("es");

    expect(en.find((d) => d.id === D.id)!.name).toBe("Haggis Bon Bon");
    expect(es.find((d) => d.id === D.id)!.name).toBe("Bombón de Haggis");
    expect(en.find((d) => d.id === D.id)!.price).toBe(44);
  });

  it("reverting puts the shipped dish back", async () => {
    await saveDishEdit(owner, { dishId: D.id, price: 44 });
    expect((await menu()).find((d) => d.id === D.id)!.price).toBe(44);

    const { revertDish } = await import("@/lib/repo/copy");
    await revertDish(owner, D.id);
    expect((await menu()).find((d) => d.id === D.id)!.price).toBe(D.price);
  });

  it("is the whole menu with nothing edited", async () => {
    expect(await menu()).toEqual(DISHES);
  });

  it("keeps every dish, so an edit can never shorten the menu", async () => {
    await saveDishEdit(owner, { dishId: D.id, price: 44 });
    expect(await menu()).toHaveLength(DISHES.length);
  });

  it("ignores an edit for a dish id that is not on the menu", async () => {
    await saveDishEdit(owner, { dishId: 99999, price: 44 });
    expect(await menu()).toHaveLength(DISHES.length);
  });
});
