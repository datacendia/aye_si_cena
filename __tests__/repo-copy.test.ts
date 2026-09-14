/**
 * Editing the words, and the rule that keeps them honest.
 *
 * The rule is one line of the repository — a save with an empty Spanish is
 * refused — and it is the whole reason the app is not back at 0% Spanish. It
 * was never that translating is hard; it was that nothing ever made the second
 * column compulsory, and the moment it is optional it is out of date. So the
 * refusal is tested from both ends: the repository rejects it, and nothing
 * reaches the table when it does.
 *
 * `listDishEdits` is covered here too. It had never been executed by anything,
 * which mattered because the admin dish editor now reads it: an override that
 * is written and never read is a change the owner thinks they made.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import { migrate, reset, close, makeUser, fakeViewer, db } from "./helpers/pglite";
import {
  listCopy, saveCopy, revertCopy, saveDishEdit, listDishEdits, revertDish
} from "@/lib/repo/copy";
import { loadCopy, COPY } from "@/lib/copy";
import { siteCopy, dishEdits } from "@/db/schema";
import type { Viewer } from "@/lib/session";

const KEY = "nav.home";
let owner: Viewer;
let chef: Viewer;

beforeAll(migrate);
afterAll(close);
beforeEach(async () => {
  await reset();
  owner = await makeUser("owner");
  chef = await makeUser("chef");
});

describe("the Spanish is compulsory", () => {
  it("refuses a save with an empty Spanish, and says why", async () => {
    await expect(saveCopy(owner, KEY, "Home", "   "))
      .rejects.toThrow(/Spanish cannot be empty/);
    expect(await db.select().from(siteCopy)).toHaveLength(0);
  });

  it("refuses a save with an empty English too", async () => {
    await expect(saveCopy(owner, KEY, "  ", "Inicio")).rejects.toThrow(/English cannot be empty/);
    expect(await db.select().from(siteCopy)).toHaveLength(0);
  });

  it("refuses a phrase that does not exist, rather than inventing a key", async () => {
    await expect(saveCopy(owner, "nav.nowhere", "X", "X")).rejects.toThrow(/No such phrase/);
  });

  it("a renamed dish needs its Spanish name", async () => {
    await expect(saveDishEdit(owner, { dishId: 1, name: "Haggis Bon Bon" }))
      .rejects.toThrow(/needs its Spanish name/);
    expect(await db.select().from(dishEdits)).toHaveLength(0);
  });

  it("a rewritten description needs its Spanish", async () => {
    await expect(saveDishEdit(owner, { dishId: 1, fusion: "Highland meets Andes" }))
      .rejects.toThrow(/needs its Spanish/);
  });

  it("but changing only the price does not — there is no Spanish for 42", async () => {
    await saveDishEdit(owner, { dishId: 1, price: 42 });
    expect((await listDishEdits())[0]).toMatchObject({ dishId: 1, price: 42, name: null });
  });

  it("refuses a menu price of zero or less", async () => {
    await expect(saveDishEdit(owner, { dishId: 1, price: 0 })).rejects.toThrow(/more than zero/);
    await expect(saveDishEdit(owner, { dishId: 1, price: -3 })).rejects.toThrow(/more than zero/);
  });
});

describe("saving and reverting a phrase", () => {
  it("supersedes the default in the code, and says it was edited", async () => {
    await saveCopy(owner, KEY, "Start", "Comienzo");
    const row = (await listCopy(owner)).find((r) => r.key === KEY)!;
    expect(row).toMatchObject({ en: "Start", es: "Comienzo", edited: true });
  });

  it("reaches the pages, in both languages", async () => {
    await saveCopy(owner, KEY, "Start", "Comienzo");
    expect((await loadCopy("en"))(KEY)).toBe("Start");
    expect((await loadCopy("es"))(KEY)).toBe("Comienzo");
  });

  it("saving twice updates the one row rather than adding another", async () => {
    await saveCopy(owner, KEY, "Start", "Comienzo");
    await saveCopy(owner, KEY, "Home again", "Inicio otra vez");
    const rows = await db.select().from(siteCopy);
    expect(rows).toHaveLength(1);
    expect(rows[0].en).toBe("Home again");
  });

  it("trims what it stores", async () => {
    await saveCopy(owner, KEY, "  Start  ", "  Comienzo  ");
    expect((await db.select().from(siteCopy))[0]).toMatchObject({ en: "Start", es: "Comienzo" });
  });

  it("keeps the phrase's section from the code, not from the form", async () => {
    await saveCopy(owner, KEY, "Start", "Comienzo");
    expect((await db.select().from(siteCopy))[0].section).toBe(COPY[KEY].section);
  });

  it("reverting drops back to the English and Spanish in the code", async () => {
    await saveCopy(owner, KEY, "Start", "Comienzo");
    await revertCopy(owner, KEY);

    const row = (await listCopy(owner)).find((r) => r.key === KEY)!;
    expect(row).toMatchObject({ en: COPY[KEY].en, es: COPY[KEY].es, edited: false });
    expect((await loadCopy("es"))(KEY)).toBe(COPY[KEY].es);
  });
});

describe("listing the words", () => {
  it("lists every phrase in the code, edited or not", async () => {
    expect(await listCopy(owner)).toHaveLength(Object.keys(COPY).length);
  });

  it("groups by section, then by key, so the admin screen is navigable", async () => {
    const rows = await listCopy(owner);
    const sorted = [...rows].sort(
      (a, b) => a.section.localeCompare(b.section) || a.key.localeCompare(b.key)
    );
    expect(rows.map((r) => r.key)).toEqual(sorted.map((r) => r.key));
  });

  it("only an owner may read or write the words", async () => {
    await expect(listCopy(chef)).rejects.toThrow(/Not permitted/);
    await expect(saveCopy(chef, KEY, "a", "b")).rejects.toThrow(/Not permitted/);
    await expect(revertCopy(chef, KEY)).rejects.toThrow(/Not permitted/);
    await expect(saveDishEdit(fakeViewer("client"), { dishId: 1, price: 42 }))
      .rejects.toThrow(/Not permitted/);
    await expect(revertDish(chef, 1)).rejects.toThrow(/Not permitted/);
  });
});

describe("dish edits", () => {
  it("stores both languages together when a dish is renamed", async () => {
    await saveDishEdit(owner, {
      dishId: 7, name: "Haggis Bon Bon", nameEs: "Bombón de Haggis",
      fusion: "Highland meets Andes", fusionEs: "Tierras Altas y los Andes"
    });
    expect((await listDishEdits())[0]).toMatchObject({
      dishId: 7, name: "Haggis Bon Bon", nameEs: "Bombón de Haggis",
      fusionEs: "Tierras Altas y los Andes"
    });
  });

  it("editing the same dish twice updates the one row", async () => {
    await saveDishEdit(owner, { dishId: 7, price: 40 });
    await saveDishEdit(owner, { dishId: 7, price: 44 });
    const rows = await listDishEdits();
    expect(rows).toHaveLength(1);
    expect(rows[0].price).toBe(44);
  });

  it("reverting removes the override entirely", async () => {
    await saveDishEdit(owner, { dishId: 7, price: 40 });
    await revertDish(owner, 7);
    expect(await listDishEdits()).toEqual([]);
  });

  it("has no column for allergens or the vegetarian flag, and never will", () => {
    // Those are derived from the recipe by lib/dietary.ts. A hand-editable
    // allergen field is what this repository already shipped once: it disagreed
    // with its own recipe on 165 of 223 dishes.
    const columns = Object.keys(dishEdits);
    expect(columns.filter((c) => /allerg|vegetarian|vegan|gluten/i.test(c))).toEqual([]);
  });
});

describe("loadCopy without a database", () => {
  it("falls back to the code rather than rendering nothing", async () => {
    expect((await loadCopy("es"))(KEY)).toBe(COPY[KEY].es);
  });

  it("renders a missing key visibly wrong rather than blank", async () => {
    expect((await loadCopy("en"))("nav.nowhere")).toBe("⟨nav.nowhere⟩");
  });
});
