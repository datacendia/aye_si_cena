/**
 * What the event really cost, and the link you send the client.
 *
 * Two features, one file, because both are about a booking after it has been
 * sold and both are tested against the same fixtures.
 *
 * The post-mortem's whole value is that it compares against what was QUOTED,
 * not against what the recipe would cost today. Re-deriving would compare March
 * spending to September prices and call the difference margin. costAtQuote
 * exists precisely so it does not.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import {
  migrate, reset, close, db, makeUser, makeClient, fakeViewer
} from "./helpers/pglite";
import { recordActuals, postMortems } from "@/lib/repo/actuals";
import { issueShare, revokeShare, shareState, packFor, SHARE_DAYS } from "@/lib/repo/pack";
import { createQuote, setQuoteStatus } from "@/lib/repo/quotes";
import { bookFromQuote, createBooking } from "@/lib/repo/bookings";
import { bookingShares, eventActuals } from "@/db/schema";
import { DISHES } from "@/data/dishes";
import { eq } from "drizzle-orm";
import type { Viewer } from "@/lib/session";

const PAST = new Date(2026, 0, 10);
const IDS = DISHES.slice(0, 4).map((d) => d.id);

let owner: Viewer;
let chef: Viewer;

beforeAll(migrate);
afterAll(close);
beforeEach(async () => {
  await reset();
  owner = await makeUser("owner");
  chef = await makeUser("chef");
});

/** A won quote, booked, on a date in the past. */
async function soldEvent(guests = 40, name = "Ferguson wedding") {
  const clientId = await makeClient("Ferguson", ["gluten-free"]);
  const quoteId = await createQuote(owner, {
    name, clientId, guests, tier: "plated",
    district: "miraflores", venue: "house", dishIds: IDS
  });
  await setQuoteStatus(owner, quoteId, "won");
  const { id } = await bookFromQuote(owner, quoteId, {
    eventDate: PAST, serviceMinutes: 19 * 60
  });
  return { bookingId: id, quoteId, clientId };
}

describe("recording what it cost", () => {
  it("lists a past booking as not yet recorded — that is the work list", async () => {
    await soldEvent();
    const [row] = await postMortems(owner);
    expect(row.recorded).toBe(false);
    expect(row.spentTotal).toBeNull();
    expect(row.contribution).toBeNull();
  });

  it("records a spend and works out what was left", async () => {
    const { bookingId } = await soldEvent();
    await recordActuals(owner, {
      bookingId, foodSpend: 1200, staffSpend: 400, transportSpend: 150
    });

    const [row] = await postMortems(owner);
    expect(row.recorded).toBe(true);
    expect(row.spentTotal).toBe(1750);
    expect(row.contribution).toBeCloseTo(row.quotedNet! - 1750, 4);
  });

  it("compares against what was quoted, not against today's prices", async () => {
    const { bookingId } = await soldEvent();
    await recordActuals(owner, { bookingId, foodSpend: 1000 });

    const [row] = await postMortems(owner);
    expect(row.quotedFoodCost).toBeGreaterThan(0);
    expect(row.quotedFoodCostRatio).toBeGreaterThan(0);
    expect(row.foodCostGap).toBeCloseTo(
      row.actualFoodCostRatio! - row.quotedFoodCostRatio!, 8
    );
  });

  it("says nothing rather than zero when nothing is recorded", async () => {
    const { bookingId } = await soldEvent();
    await recordActuals(owner, { bookingId, note: "receipts still in the van" });

    const [row] = await postMortems(owner);
    expect(row.recorded).toBe(true);
    expect(row.spentTotal).toBeNull();
    expect(row.actualFoodCostRatio).toBeNull();
  });

  it("records the head count that actually turned up", async () => {
    const { bookingId } = await soldEvent(40);
    await recordActuals(owner, { bookingId, guestsServed: 34, foodSpend: 900 });

    const [row] = await postMortems(owner);
    expect(row.guestsQuoted).toBe(40);
    expect(row.guestsServed).toBe(34);
  });

  it("updates in place rather than adding a second row", async () => {
    const { bookingId } = await soldEvent();
    await recordActuals(owner, { bookingId, foodSpend: 900 });
    await recordActuals(owner, { bookingId, foodSpend: 1100 });

    expect(await db.select().from(eventActuals)).toHaveLength(1);
    expect((await postMortems(owner))[0].spentFood).toBe(1100);
  });

  it("refuses a negative spend", async () => {
    const { bookingId } = await soldEvent();
    await expect(recordActuals(owner, { bookingId, foodSpend: -50 }))
      .rejects.toThrow(/cannot be negative/);
  });

  it("lists newest first", async () => {
    await soldEvent(20, "Older");
    await createBooking(owner, {
      eventDate: new Date(2026, 5, 1), serviceMinutes: 19 * 60,
      guests: 30, tier: "buffet", district: "surco", venue: "house", notes: "Newer"
    });
    const rows = await postMortems(owner, new Date(2026, 8, 1));
    expect(rows[0].eventDate.getTime()).toBeGreaterThan(rows[1].eventDate.getTime());
  });

  it("leaves out events that have not happened yet", async () => {
    await createBooking(owner, {
      eventDate: new Date(2030, 0, 1), serviceMinutes: 19 * 60,
      guests: 30, tier: "buffet", district: "surco", venue: "house"
    });
    expect(await postMortems(owner)).toEqual([]);
  });

  it("only an owner may see or record it", async () => {
    const { bookingId } = await soldEvent();
    await expect(postMortems(chef)).rejects.toThrow(/Not permitted/);
    await expect(recordActuals(chef, { bookingId, foodSpend: 1 })).rejects.toThrow(/Not permitted/);
    await expect(postMortems(fakeViewer("client"))).rejects.toThrow(/Not permitted/);
  });
});

describe("the link you send a client", () => {
  it("opens the booking without any account at all", async () => {
    const { bookingId } = await soldEvent();
    const { token } = await issueShare(owner, bookingId);

    const pack = await packFor(token);
    expect(pack).toMatchObject({ bookingId, guests: 40, clientName: "Ferguson" });
    expect(pack!.dishIds.sort()).toEqual([...IDS].sort());
  });

  it("carries the diets the client told you about, for the clash check", async () => {
    const { bookingId } = await soldEvent();
    const { token } = await issueShare(owner, bookingId);
    expect((await packFor(token))!.clientDiets).toEqual(["gluten-free"]);
  });

  it("stores only the hash — a leaked backup opens nothing", async () => {
    const { bookingId } = await soldEvent();
    const { token } = await issueShare(owner, bookingId);

    const [row] = await db.select().from(bookingShares);
    expect(row.tokenHash).not.toBe(token);
    expect(JSON.stringify(row)).not.toContain(token);
    // And the stored hash is not itself a key.
    expect(await packFor(row.tokenHash)).toBeNull();
  });

  it("lasts ninety days — it is read twenty times over three months", async () => {
    const { bookingId } = await soldEvent();
    const { expires } = await issueShare(owner, bookingId);
    const days = (expires.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(SHARE_DAYS - 1);
    expect(days).toBeLessThanOrEqual(SHARE_DAYS);
  });

  it("revokes any live link when a new one is issued", async () => {
    const { bookingId } = await soldEvent();
    const first = await issueShare(owner, bookingId);
    const second = await issueShare(owner, bookingId);

    expect(await packFor(first.token)).toBeNull();
    expect(await packFor(second.token)).not.toBeNull();
  });

  it("revokes on request, and stays revoked", async () => {
    const { bookingId } = await soldEvent();
    const { token } = await issueShare(owner, bookingId);
    await revokeShare(owner, bookingId);

    expect(await packFor(token)).toBeNull();
    expect(await shareState(owner, bookingId)).toBeNull();
  });

  it("stops working once it has expired", async () => {
    const { bookingId } = await soldEvent();
    const { token } = await issueShare(owner, bookingId);
    const [row] = await db.select().from(bookingShares);

    await db.update(bookingShares)
      .set({ expires: new Date(Date.now() - 1000) })
      .where(eq(bookingShares.tokenHash, row.tokenHash));

    expect(await packFor(token)).toBeNull();
  });

  it("gives the same answer for expired, revoked and invented", async () => {
    // Telling them apart tells somebody holding a guessed token that they
    // guessed nearly right.
    expect(await packFor("never-existed")).toBeNull();
    expect(await packFor("")).toBeNull();
  });

  it("says whether a booking currently has a live link", async () => {
    const { bookingId } = await soldEvent();
    expect(await shareState(owner, bookingId)).toBeNull();
    await issueShare(owner, bookingId);
    expect(await shareState(owner, bookingId)).not.toBeNull();
  });

  it("refuses a booking that does not exist", async () => {
    await expect(issueShare(owner, "nope")).rejects.toThrow(/No such booking/);
  });

  it("only an owner may issue or revoke one", async () => {
    const { bookingId } = await soldEvent();
    await expect(issueShare(chef, bookingId)).rejects.toThrow(/Not permitted/);
    await expect(revokeShare(chef, bookingId)).rejects.toThrow(/Not permitted/);
  });
});
