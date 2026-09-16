/**
 * What the label said, and when.
 *
 * The QR resolves to a page generated live from the recipe — right for a guest
 * holding a box, wrong six months later when somebody asks what the label said
 * on the fourteenth of March, because the live page answers for today.
 *
 * That gap is the difference between a feature and a record. These tests are
 * about the properties a record needs: it is never edited, never deleted, and
 * an identical declaration does not create a second row.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import { migrate, reset, close, makeUser, fakeViewer, db } from "./helpers/pglite";
import {
  fingerprint, noteDeclaration, historyFor, declaredOn, changed
} from "@/lib/repo/declarations";
import { declarations } from "@/db/schema";
import type { Viewer } from "@/lib/session";

let owner: Viewer;
let chef: Viewer;

beforeAll(migrate);
afterAll(close);
beforeEach(async () => {
  await reset();
  owner = await makeUser("owner");
  chef = await makeUser("chef");
});

const decl = (over = {}) => ({
  dishId: 1, name: "Haggis Bonbons",
  allergens: ["gluten", "eggs"], suits: ["no-alcohol"], ...over
});

describe("the fingerprint", () => {
  it("is the same for the same content", () => {
    expect(fingerprint(decl())).toBe(fingerprint(decl()));
  });

  it("ignores the order the arrays arrive in", () => {
    expect(fingerprint(decl({ allergens: ["eggs", "gluten"] })))
      .toBe(fingerprint(decl({ allergens: ["gluten", "eggs"] })));
  });

  it("changes when an allergen is added or removed", () => {
    expect(fingerprint(decl({ allergens: ["gluten"] }))).not.toBe(fingerprint(decl()));
    expect(fingerprint(decl({ allergens: ["gluten", "eggs", "milk"] })))
      .not.toBe(fingerprint(decl()));
  });

  it("changes when the dish is renamed — a renamed dish is a different label", () => {
    expect(fingerprint(decl({ name: "Bombón de Haggis" }))).not.toBe(fingerprint(decl()));
  });

  it("is a different record for a different dish carrying the same allergens", () => {
    expect(fingerprint(decl({ dishId: 2 }))).not.toBe(fingerprint(decl()));
  });
});

describe("writing it down", () => {
  it("records what was served", async () => {
    await noteDeclaration(decl());
    const [row] = await db.select().from(declarations);
    expect(row).toMatchObject({
      dishId: 1, name: "Haggis Bonbons", allergens: ["eggs", "gluten"]
    });
  });

  it("does not write a second row for an identical declaration", async () => {
    await noteDeclaration(decl());
    await noteDeclaration(decl());
    await noteDeclaration(decl());
    expect(await db.select().from(declarations)).toHaveLength(1);
  });

  it("touches lastSeen when the same thing is declared again", async () => {
    await noteDeclaration(decl());
    const before = (await db.select().from(declarations))[0];
    await new Promise((r) => setTimeout(r, 10));
    await noteDeclaration(decl());
    const after = (await db.select().from(declarations))[0];

    expect(after.lastSeen.getTime()).toBeGreaterThan(before.lastSeen.getTime());
    expect(after.firstSeen.getTime()).toBe(before.firstSeen.getTime());
  });

  it("writes a new row when the allergens change, and leaves the old one standing", async () => {
    await noteDeclaration(decl());
    await noteDeclaration(decl({ allergens: ["gluten", "eggs", "milk"] }));

    const rows = await db.select().from(declarations);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.allergens.length).sort()).toEqual([2, 3]);
  });

  it("never fails the page it is called from", async () => {
    // It runs on a page a guest is looking at with a box in their hand. Losing
    // an audit row is bad; a blank page for somebody checking for nuts is worse.
    await expect(
      noteDeclaration({ dishId: 1, name: "x", allergens: null as never, suits: [] })
    ).resolves.toBeUndefined();
  });
});

describe("reading it back", () => {
  it("gives the whole history for a dish, oldest first", async () => {
    await noteDeclaration(decl({ allergens: ["gluten"] }));
    await new Promise((r) => setTimeout(r, 5));
    await noteDeclaration(decl({ allergens: ["gluten", "milk"] }));

    const history = await historyFor(owner, 1);
    expect(history).toHaveLength(2);
    expect(history[0].allergens).toEqual(["gluten"]);
  });

  it("answers what a dish declared on a given date", async () => {
    await noteDeclaration(decl({ allergens: ["gluten"] }));
    const [first] = await db.select().from(declarations);

    // Backdate the first row and add a later one, the way six months would.
    await db.update(declarations)
      .set({ firstSeen: new Date(2026, 2, 1) })
      .where(eqId(first.id));
    await noteDeclaration(decl({ allergens: ["gluten", "milk"] }));

    const inMarch = await declaredOn(owner, 1, new Date(2026, 2, 14));
    expect(inMarch?.allergens).toEqual(["gluten"]);

    const now = await declaredOn(owner, 1, new Date());
    expect(now?.allergens).toEqual(["gluten", "milk"]);
  });

  it("returns null for a date before anything was declared", async () => {
    await noteDeclaration(decl());
    expect(await declaredOn(owner, 1, new Date(2020, 0, 1))).toBeNull();
  });

  it("returns null for a dish that has never been declared", async () => {
    expect(await declaredOn(owner, 999, new Date())).toBeNull();
    expect(await historyFor(owner, 999)).toEqual([]);
  });

  it("lists the dishes whose declaration has changed", async () => {
    await noteDeclaration(decl({ dishId: 1, allergens: ["gluten"] }));
    await noteDeclaration(decl({ dishId: 1, allergens: ["gluten", "milk"] }));
    await noteDeclaration(decl({ dishId: 2, allergens: ["fish"] }));

    const moved = await changed(owner);
    expect(new Set(moved.map((r) => r.dishId))).toEqual(new Set([1]));
  });

  it("a chef may read it — they are the one packing the box", async () => {
    await noteDeclaration(decl());
    expect(await historyFor(chef, 1)).toHaveLength(1);
  });

  it("a client may not", async () => {
    await expect(historyFor(fakeViewer("client"), 1)).rejects.toThrow(/Not permitted/);
    await expect(declaredOn(fakeViewer("client"), 1, new Date())).rejects.toThrow(/Not permitted/);
  });
});

/** Tiny helper so the update above reads cleanly. */
function eqId(id: string) {
  const { eq } = require("drizzle-orm");
  return eq(declarations.id, id);
}
