/**
 * Verified market prices, against a real Postgres.
 *
 * The rule this table exists to keep is that a price is never edited in place:
 * recording a new one marks the last not-current and inserts a fresh row, so
 * what you paid for butter in March is still answerable in September. Two
 * things enforce it — the repository, and a partial unique index that allows
 * exactly one current row per key. The index is the reason this needs a real
 * Postgres: `unique … where current` is not something a mock has an opinion
 * about, and it is the last line of defence if the update ever stops running.
 *
 * The typo guard is here because it shipped broken once. The first version
 * compared the input to its own canonical form, so "buttter" canonicalises to
 * "buttter" and passed in silence — a price written down that could never reach
 * a dish. Membership of the price book is the question worth asking.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import { migrate, reset, close, makeUser, fakeViewer, client, db } from "./helpers/pglite";
import {
  listVerifiedPrices, priceBook, recordPrice, forgetPrice, priceHistory
} from "@/lib/repo/prices";
import { priceOverrides } from "@/db/schema";
import { ESTIMATES } from "@/lib/costing";
import type { Viewer } from "@/lib/session";

let owner: Viewer;
let chef: Viewer;

beforeAll(migrate);
afterAll(close);
beforeEach(async () => {
  await reset();
  owner = await makeUser("owner", { name: "Stu" });
  chef = await makeUser("chef", { name: "Ana" });
});

describe("recording what was actually paid", () => {
  it("supersedes rather than overwrites, keeping the old price answerable", async () => {
    await recordPrice(owner, { ingredientKey: "butter", soles: 30, per: "kg", source: "Surquillo N.1" });
    await recordPrice(owner, { ingredientKey: "butter", soles: 38, per: "kg", source: "Surquillo N.1" });

    const all = await db.select().from(priceOverrides);
    expect(all).toHaveLength(2);
    expect(all.filter((r) => r.current)).toHaveLength(1);

    const history = await priceHistory("butter");
    expect(history.map((r) => r.soles)).toEqual([38, 30]);
  });

  it("the database itself refuses a second current row for one key", async () => {
    await recordPrice(owner, { ingredientKey: "butter", soles: 30, per: "kg" });
    // Bypassing the repository entirely: the partial unique index has to hold.
    await expect(
      client.exec(
        `INSERT INTO price_overrides (id, ingredient_key, soles, per, current)
         VALUES ('forced', 'butter', 99, 'kg', true);`
      )
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it("canonicalises the key on the way in", async () => {
    await recordPrice(owner, { ingredientKey: "  BUTTER  ", soles: 30, per: "kg" });
    expect((await listVerifiedPrices())[0].ingredientKey).toBe("butter");
  });

  it("refuses a key the recipes never name, and suggests what was meant", async () => {
    await expect(recordPrice(owner, { ingredientKey: "buttter", soles: 30, per: "kg" }))
      .rejects.toThrow(/is not an ingredient the recipes name/);
    await expect(recordPrice(owner, { ingredientKey: "buttter", soles: 30, per: "kg" }))
      .rejects.toThrow(/Did you mean/);
    expect(await db.select().from(priceOverrides)).toHaveLength(0);
  });

  it("refuses a price of zero or less", async () => {
    await expect(recordPrice(owner, { ingredientKey: "butter", soles: 0, per: "kg" }))
      .rejects.toThrow(/more than zero/);
    await expect(recordPrice(owner, { ingredientKey: "butter", soles: -5, per: "kg" }))
      .rejects.toThrow(/more than zero/);
  });

  it("a chef may record one — a chef buys too", async () => {
    await recordPrice(chef, { ingredientKey: "butter", soles: 31, per: "kg" });
    expect((await listVerifiedPrices())[0].verifiedByName).toBe("Ana");
  });

  it("a client may not", async () => {
    await expect(recordPrice(fakeViewer("client"), { ingredientKey: "butter", soles: 31, per: "kg" }))
      .rejects.toThrow(/Not permitted/);
  });
});

describe("listing", () => {
  it("shows the shipped estimate beside what was paid", async () => {
    await recordPrice(owner, { ingredientKey: "butter", soles: 38, per: "kg" });
    const [row] = await listVerifiedPrices();
    expect(row.soles).toBe(38);
    expect(row.estimate).toBe(ESTIMATES.food["butter"].soles);
    expect(row.verifiedByName).toBe("Stu");
  });

  it("shows only the current row per key, newest first", async () => {
    await recordPrice(owner, { ingredientKey: "butter", soles: 30, per: "kg" });
    await new Promise((r) => setTimeout(r, 5));
    await recordPrice(owner, { ingredientKey: "egg", soles: 0.7, per: "each" });
    await new Promise((r) => setTimeout(r, 5));
    await recordPrice(owner, { ingredientKey: "butter", soles: 38, per: "kg" });

    expect((await listVerifiedPrices()).map((r) => [r.ingredientKey, r.soles]))
      .toEqual([["butter", 38], ["egg", 0.7]]);
  });
});

describe("the price book handed to the costing", () => {
  it("is the shipped estimates when nothing has been verified", async () => {
    expect(await priceBook()).toBe(ESTIMATES);
  });

  it("lays a verified price over the estimate without touching the rest", async () => {
    await recordPrice(owner, { ingredientKey: "butter", soles: 38, per: "kg", note: "up again" });
    const book = await priceBook();

    expect(book.food["butter"]).toMatchObject({ soles: 38, per: "kg", note: "up again" });
    expect(book.food["egg"]).toEqual(ESTIMATES.food["egg"]);
    // The originals are untouched — this is a copy, not a mutation.
    expect(ESTIMATES.food["butter"].soles).not.toBe(38);
    expect(book.sub).toBe(ESTIMATES.sub);
  });

  it("carries unitGrams through when one is given", async () => {
    await recordPrice(owner, { ingredientKey: "egg white", soles: 0.6, per: "each", unitGrams: 35 });
    expect((await priceBook()).food["egg white"]).toMatchObject({ unitGrams: 35 });
  });
});

describe("forgetting", () => {
  it("drops back to the shipped estimate", async () => {
    await recordPrice(owner, { ingredientKey: "butter", soles: 38, per: "kg" });
    await forgetPrice(owner, "butter");

    expect(await listVerifiedPrices()).toEqual([]);
    expect((await priceBook()).food["butter"]).toEqual(ESTIMATES.food["butter"]);
  });

  it("keeps the history — forgetting is not deleting", async () => {
    await recordPrice(owner, { ingredientKey: "butter", soles: 38, per: "kg" });
    await forgetPrice(owner, "butter");
    expect(await priceHistory("butter")).toHaveLength(1);
  });

  it("lets a later price be recorded again afterwards", async () => {
    await recordPrice(owner, { ingredientKey: "butter", soles: 38, per: "kg" });
    await forgetPrice(owner, "butter");
    await recordPrice(owner, { ingredientKey: "butter", soles: 41, per: "kg" });
    expect((await listVerifiedPrices())[0].soles).toBe(41);
  });

  it("a client may not forget one", async () => {
    await expect(forgetPrice(fakeViewer("client"), "butter")).rejects.toThrow(/Not permitted/);
  });
});

describe("priceHistory", () => {
  it("is empty for a key nobody has bought", async () => {
    expect(await priceHistory("butter")).toEqual([]);
  });

  it("is every row for that key and no other, newest first", async () => {
    await recordPrice(owner, { ingredientKey: "butter", soles: 30, per: "kg" });
    await new Promise((r) => setTimeout(r, 5));
    await recordPrice(owner, { ingredientKey: "butter", soles: 34, per: "kg" });
    await recordPrice(owner, { ingredientKey: "egg", soles: 0.7, per: "each" });

    const h = await priceHistory("butter");
    expect(h.map((r) => r.soles)).toEqual([34, 30]);
    expect(h.every((r) => r.ingredientKey === "butter")).toBe(true);
  });
});
