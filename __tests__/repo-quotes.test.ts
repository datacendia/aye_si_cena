/**
 * The quote repository, against a real Postgres.
 *
 * This file exists because of one number in an audit: lib/repo/quotes.ts was at
 * 0% function and 0% branch coverage while lib/ around it sat at 94%. The
 * untested half was not the half that calculates — it was the half that decides
 * whose quote you are reading. A costing bug shows up as a wrong figure on a
 * screen. A scoping bug shows up as one client reading another client's event,
 * and nothing anywhere says so.
 *
 * So the tests that matter most here are the negative ones: the client who asks
 * for a quote that is not theirs, by its exact id, and is told it does not
 * exist.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import { db, migrate, reset, close, makeUser, makeClient, fakeViewer } from "./helpers/pglite";
import {
  createQuote, updateQuote, getQuote, listQuotes, setQuoteStatus, deleteQuote
} from "@/lib/repo/quotes";
import { quotes, quoteDishes } from "@/db/schema";
import { DISHES } from "@/data/dishes";
import type { Viewer } from "@/lib/session";

const DISH_IDS = DISHES.slice(0, 4).map((d) => d.id);

let owner: Viewer;
let chef: Viewer;

beforeAll(migrate);
afterAll(close);
beforeEach(async () => {
  await reset();
  owner = await makeUser("owner");
  chef = await makeUser("chef");
});

const draft = (over: Partial<Parameters<typeof createQuote>[1]> = {}) => ({
  name: "Ferguson wedding",
  guests: 60,
  tier: "plated" as const,
  district: "san-isidro",
  venue: "hotel",
  month: 6,
  peak: true,
  dishIds: DISH_IDS,
  ...over
});

describe("writing a quote", () => {
  it("prices the selection itself rather than trusting the caller", async () => {
    const id = await createQuote(owner, draft());
    const saved = await getQuote(owner, id);

    expect(saved).not.toBeNull();
    expect(saved!.netTotal).toBeGreaterThan(0);
    expect(saved!.grossTotal).toBeGreaterThan(saved!.netTotal);
    // IGV is 18%, and it is added to the net — not carved out of the gross.
    expect(saved!.grossTotal).toBeCloseTo(saved!.netTotal * 1.18, 2);
  });

  it("stores dish ids, never dish rows", async () => {
    const id = await createQuote(owner, draft());
    const links = await db.select().from(quoteDishes);
    expect(links.map((l) => l.dishId).sort()).toEqual([...DISH_IDS].sort());
    expect(await getQuote(owner, id).then((q) => q!.dishIds.sort()))
      .toEqual([...DISH_IDS].sort());
  });

  it("writes down the price and cost each dish carried at the time", async () => {
    await createQuote(owner, draft({ dishIds: [DISHES[0].id] }));
    const [link] = await db.select().from(quoteDishes);
    expect(link.priceAtQuote).toBeCloseTo(DISHES[0].price, 4);
    expect(link.costAtQuote).toBeCloseTo(DISHES[0].cost, 4);
  });

  it("refuses a quote with no dishes on it", async () => {
    await expect(createQuote(owner, draft({ dishIds: [] })))
      .rejects.toThrow(/at least one dish/i);
  });

  it("names an untitled quote rather than storing an empty string", async () => {
    const id = await createQuote(owner, draft({ name: "   " }));
    expect((await getQuote(owner, id))!.name).toBe("Untitled quote");
  });

  it("replaces the dish list on edit instead of leaving a stale row", async () => {
    const id = await createQuote(owner, draft());
    await updateQuote(owner, id, draft({ dishIds: [DISHES[7].id], guests: 90 }));

    const after = await getQuote(owner, id);
    expect(after!.dishIds).toEqual([DISHES[7].id]);
    expect(after!.guests).toBe(90);
    expect(await db.select().from(quoteDishes)).toHaveLength(1);
  });

  it("reprices on edit — more guests is a different total", async () => {
    const id = await createQuote(owner, draft({ guests: 20 }));
    const before = (await getQuote(owner, id))!.netTotal;
    await updateQuote(owner, id, draft({ guests: 200 }));
    expect((await getQuote(owner, id))!.netTotal).toBeGreaterThan(before);
  });

  it("takes the quote's own district and venue into the price", async () => {
    const near = await createQuote(owner, draft({ district: "magdalena" }));
    const far = await createQuote(owner, draft({ district: "asia" }));
    expect((await getQuote(owner, far))!.netTotal)
      .toBeGreaterThan((await getQuote(owner, near))!.netTotal);
  });

  it("moves a quote through its statuses", async () => {
    const id = await createQuote(owner, draft());
    expect((await getQuote(owner, id))!.status).toBe("draft");
    await setQuoteStatus(owner, id, "sent");
    await setQuoteStatus(owner, id, "won");
    expect((await getQuote(owner, id))!.status).toBe("won");
  });

  it("takes the dish rows with the quote when it is deleted", async () => {
    const id = await createQuote(owner, draft());
    await deleteQuote(owner, id);
    expect(await getQuote(owner, id)).toBeNull();
    expect(await db.select().from(quoteDishes)).toHaveLength(0);
  });
});

describe("who may write", () => {
  it.each(["chef", "client"] as const)("a %s cannot create a quote", async (role) => {
    await expect(createQuote(fakeViewer(role), draft())).rejects.toThrow(/Not permitted/);
  });

  it("a chef cannot change a status or delete", async () => {
    const id = await createQuote(owner, draft());
    await expect(setQuoteStatus(chef, id, "won")).rejects.toThrow(/Not permitted/);
    await expect(deleteQuote(chef, id)).rejects.toThrow(/Not permitted/);
    await expect(updateQuote(chef, id, draft())).rejects.toThrow(/Not permitted/);
    expect(await getQuote(owner, id)).not.toBeNull();
  });

  it("refuses before it writes, not after", async () => {
    await expect(createQuote(fakeViewer("chef"), draft())).rejects.toThrow();
    expect(await db.select().from(quotes)).toHaveLength(0);
  });
});

describe("who may read — the part that leaks if it is wrong", () => {
  it("a client sees their own quotes and no others", async () => {
    const mine = await makeClient("Ferguson");
    const theirs = await makeClient("Banco de Crédito");
    const meId = await createQuote(owner, draft({ clientId: mine, name: "Mine" }));
    await createQuote(owner, draft({ clientId: theirs, name: "Theirs" }));
    await createQuote(owner, draft({ clientId: null, name: "Unassigned" }));

    const me = await makeUser("client", { clientId: mine });
    const list = await listQuotes(me);

    expect(list.map((q) => q.name)).toEqual(["Mine"]);
    expect(list[0].id).toBe(meId);
  });

  it("a client asking for another client's quote by id is told it does not exist", async () => {
    const mine = await makeClient("Ferguson");
    const theirs = await makeClient("Banco de Crédito");
    const secret = await createQuote(owner, draft({ clientId: theirs }));

    const me = await makeUser("client", { clientId: mine });
    expect(await getQuote(me, secret)).toBeNull();
  });

  it("an unattached client login sees nothing at all", async () => {
    const someone = await makeClient("Ferguson");
    const id = await createQuote(owner, draft({ clientId: someone }));
    const orphan = await makeUser("client", { clientId: null });

    expect(await listQuotes(orphan)).toEqual([]);
    expect(await getQuote(orphan, id)).toBeNull();
  });

  it("'not yours' and 'no such quote' are the same answer", async () => {
    const mine = await makeClient("Ferguson");
    const theirs = await makeClient("Banco de Crédito");
    const real = await createQuote(owner, draft({ clientId: theirs }));
    const me = await makeUser("client", { clientId: mine });

    expect(await getQuote(me, real)).toBeNull();
    expect(await getQuote(me, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("owner and chef see every quote, including unassigned ones", async () => {
    const a = await makeClient("Ferguson");
    await createQuote(owner, draft({ clientId: a, name: "A" }));
    await createQuote(owner, draft({ clientId: null, name: "B" }));

    expect(await listQuotes(owner)).toHaveLength(2);
    expect(await listQuotes(chef)).toHaveLength(2);
  });

  it("carries the client's name through the join", async () => {
    const a = await makeClient("Ferguson");
    await createQuote(owner, draft({ clientId: a }));
    await createQuote(owner, draft({ clientId: null }));

    const names = (await listQuotes(owner)).map((q) => q.clientName);
    expect(new Set(names)).toEqual(new Set(["Ferguson", null]));
  });

  it("lists newest first", async () => {
    const first = await createQuote(owner, draft({ name: "First" }));
    await new Promise((r) => setTimeout(r, 5));
    await createQuote(owner, draft({ name: "Second" }));
    await updateQuote(owner, first, draft({ name: "First, edited" }));

    expect((await listQuotes(owner))[0].name).toBe("First, edited");
  });

  it("returns an empty list rather than throwing when there is nothing", async () => {
    expect(await listQuotes(owner)).toEqual([]);
    expect(await getQuote(owner, "nope")).toBeNull();
  });
});
