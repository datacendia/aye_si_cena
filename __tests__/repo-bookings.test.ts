/**
 * The calendar, against a real Postgres.
 *
 * Two functions in lib/repo/bookings.ts had never been executed by anything:
 * `bookingsOn` and `couldTake`. `couldTake` is the one that answers the only
 * question a caterer asks on the phone — "can you do the 14th?" — so it is
 * covered here first and wired to a screen in app/day/.
 *
 * The day-boundary tests are the reason this needs a real database rather than
 * a mock. `bookingsOn` builds a half-open range in local time and hands it to
 * Postgres as a timestamp comparison; whether 23:59 on the 13th falls inside
 * the 14th is a question only Postgres can actually answer.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import { db, migrate, reset, close, makeUser, makeClient, fakeViewer } from "./helpers/pglite";
import {
  createBooking, listBookings, bookingsOn, bookFromQuote, deleteBooking,
  confirmBooking, dayVerdict, couldTake, toCapacity, type BookingRow
} from "@/lib/repo/bookings";
import { createQuote } from "@/lib/repo/quotes";
import { bookings } from "@/db/schema";
import { DISHES } from "@/data/dishes";
import type { Viewer } from "@/lib/session";

const at = (h: number) => h * 60;
const DAY = new Date(2026, 4, 14);
const DISH_IDS = DISHES.slice(0, 3).map((d) => d.id);

let owner: Viewer;
let chef: Viewer;

beforeAll(migrate);
afterAll(close);
beforeEach(async () => {
  await reset();
  owner = await makeUser("owner");
  chef = await makeUser("chef");
});

const job = (over: Partial<Parameters<typeof createBooking>[1]> = {}) => ({
  eventDate: DAY,
  serviceMinutes: at(19),
  durationMinutes: 180,
  guests: 60,
  tier: "plated" as const,
  district: "san-isidro",
  venue: "hotel",
  dishIds: DISH_IDS,
  ...over
});

describe("what is on the books", () => {
  it("lists soonest first, then earliest service", async () => {
    await createBooking(owner, job({ eventDate: new Date(2026, 4, 20), serviceMinutes: at(13) }));
    await createBooking(owner, job({ eventDate: DAY, serviceMinutes: at(20) }));
    await createBooking(owner, job({ eventDate: DAY, serviceMinutes: at(12) }));

    const list = await listBookings(owner);
    expect(list.map((b) => [b.eventDate.getDate(), b.serviceMinutes]))
      .toEqual([[14, at(12)], [14, at(20)], [20, at(13)]]);
  });

  it("a client cannot see the calendar at all", async () => {
    await expect(listBookings(fakeViewer("client"))).rejects.toThrow(/Not permitted/);
    await expect(bookingsOn(fakeViewer("client"), DAY)).rejects.toThrow(/Not permitted/);
  });

  it("a chef may see it — they have to cook it", async () => {
    await createBooking(owner, job());
    expect(await listBookings(chef)).toHaveLength(1);
  });

  it("only an owner writes to it", async () => {
    await expect(createBooking(chef, job())).rejects.toThrow(/Not permitted/);
    expect(await db.select().from(bookings)).toHaveLength(0);
  });
});

describe("bookingsOn — the day boundary", () => {
  beforeEach(async () => {
    await createBooking(owner, job({ eventDate: new Date(2026, 4, 13, 23, 59), serviceMinutes: at(23) }));
    await createBooking(owner, job({ eventDate: new Date(2026, 4, 14, 0, 1), serviceMinutes: at(0) }));
    await createBooking(owner, job({ eventDate: new Date(2026, 4, 14, 23, 59), serviceMinutes: at(23) }));
    await createBooking(owner, job({ eventDate: new Date(2026, 4, 15, 0, 1), serviceMinutes: at(0) }));
  });

  it("takes the whole day and neither midnight either side", async () => {
    const on = await bookingsOn(owner, DAY);
    expect(on).toHaveLength(2);
    expect(on.every((b) => b.eventDate.getDate() === 14)).toBe(true);
  });

  it("answers the same whatever time of day you ask about", async () => {
    const morning = await bookingsOn(owner, new Date(2026, 4, 14, 6, 0));
    const midnight = await bookingsOn(owner, new Date(2026, 4, 14, 0, 0));
    expect(morning.map((b) => b.id)).toEqual(midnight.map((b) => b.id));
  });

  it("an empty day is empty, not an error", async () => {
    expect(await bookingsOn(owner, new Date(2026, 6, 1))).toEqual([]);
  });
});

describe("a won quote becomes a booking", () => {
  const draft = () => ({
    name: "Ferguson wedding", guests: 120, tier: "plated" as const,
    district: "miraflores", venue: "hotel", dishIds: DISH_IDS
  });

  it("copies everything the calendar needs rather than asking for it again", async () => {
    const clientId = await makeClient("Ferguson");
    const quoteId = await createQuote(owner, { ...draft(), clientId });
    const { id, alreadyBooked } = await bookFromQuote(owner, quoteId,
      { eventDate: DAY, serviceMinutes: at(19) });

    expect(alreadyBooked).toBe(false);
    const [b] = await bookingsOn(owner, DAY);
    expect(b.id).toBe(id);
    expect(b.guests).toBe(120);
    expect(b.district).toBe("miraflores");
    expect(b.dishIds.sort()).toEqual([...DISH_IDS].sort());
    expect(b.clientId).toBe(clientId);
    expect(b.quoteId).toBe(quoteId);
    expect(b.notes).toMatch(/Ferguson wedding/);
  });

  it("booking the same quote twice returns the first booking, not a second", async () => {
    const quoteId = await createQuote(owner, draft());
    const first = await bookFromQuote(owner, quoteId, { eventDate: DAY, serviceMinutes: at(19) });
    const again = await bookFromQuote(owner, quoteId, { eventDate: DAY, serviceMinutes: at(21) });

    expect(again).toEqual({ id: first.id, alreadyBooked: true });
    expect(await db.select().from(bookings)).toHaveLength(1);
  });

  it("refuses a quote that is gone", async () => {
    await expect(bookFromQuote(owner, "no-such-quote", { eventDate: DAY, serviceMinutes: at(19) }))
      .rejects.toThrow(/gone, or it was never yours/);
  });

  it("carries the quote's name through the join", async () => {
    const quoteId = await createQuote(owner, draft());
    await bookFromQuote(owner, quoteId, { eventDate: DAY, serviceMinutes: at(19) });
    expect((await listBookings(owner))[0].quoteName).toBe("Ferguson wedding");
  });
});

describe("confirming and removing", () => {
  it("a booking starts unconfirmed and can be confirmed and unconfirmed", async () => {
    const id = await createBooking(owner, job());
    expect((await listBookings(owner))[0].confirmed).toBe(false);
    await confirmBooking(owner, id, true);
    expect((await listBookings(owner))[0].confirmed).toBe(true);
    await confirmBooking(owner, id, false);
    expect((await listBookings(owner))[0].confirmed).toBe(false);
  });

  it("a chef may not confirm or delete", async () => {
    const id = await createBooking(owner, job());
    await expect(confirmBooking(chef, id, true)).rejects.toThrow(/Not permitted/);
    await expect(deleteBooking(chef, id)).rejects.toThrow(/Not permitted/);
    expect(await listBookings(owner)).toHaveLength(1);
  });

  it("deleting leaves the day empty", async () => {
    const id = await createBooking(owner, job());
    await deleteBooking(owner, id);
    expect(await bookingsOn(owner, DAY)).toEqual([]);
  });
});

describe("toCapacity", () => {
  const row = (over: Partial<BookingRow> = {}): BookingRow => ({
    id: "b1", quoteId: null, clientId: null, clientName: null, quoteName: null,
    eventDate: DAY, serviceMinutes: at(19), durationMinutes: 180, guests: 60,
    tier: "plated", district: "san-isidro", venue: "hotel", dishIds: DISH_IDS,
    confirmed: false, notes: null, ...over
  });

  it("resolves the district and venue the travel maths needs", () => {
    const c = toCapacity(row())!;
    expect(c.district.id).toBe("san-isidro");
    expect(c.venue.id).toBe("hotel");
    expect(c.dishes).toHaveLength(DISH_IDS.length);
  });

  it("returns null rather than defaulting to somewhere", () => {
    expect(toCapacity(row({ district: null }))).toBeNull();
    expect(toCapacity(row({ venue: null }))).toBeNull();
    expect(toCapacity(row({ district: "narnia" }))).toBeNull();
  });
});

describe("dayVerdict", () => {
  it("names the bookings it cannot judge, and why", async () => {
    await createBooking(owner, job());
    await createBooking(owner, job({ district: null, serviceMinutes: at(13) }));
    await createBooking(owner, job({ venue: null, serviceMinutes: at(15) }));

    const v = await dayVerdict(owner, DAY);
    expect(v.bookings).toHaveLength(3);
    expect(v.unjudgeable).toHaveLength(2);
    expect(v.unjudgeable.map((u) => u.reason).sort())
      .toEqual(["no district, so the travel time is unknown", "no venue type"]);
  });

  it("finds the clash when two plated jobs sit on top of each other", async () => {
    await createBooking(owner, job({ serviceMinutes: at(19) }));
    await createBooking(owner, job({ serviceMinutes: at(20) }));
    expect((await dayVerdict(owner, DAY)).clashes.length).toBeGreaterThan(0);
  });

  it("a quiet day has no clashes", async () => {
    await createBooking(owner, job({ guests: 20 }));
    expect((await dayVerdict(owner, DAY)).clashes).toEqual([]);
  });
});

describe("couldTake — 'can you do the 14th?'", () => {
  it("says yes when the day is empty", async () => {
    const r = await couldTake(owner, job({ guests: 20 }));
    expect(r).toMatchObject({ ok: true, against: 0 });
  });

  it("says no when it collides with what is already sold", async () => {
    await createBooking(owner, job({ serviceMinutes: at(19) }));
    const r = await couldTake(owner, job({ serviceMinutes: at(20) }));
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.against).toBe(1);
      expect(r.clashes.length).toBeGreaterThan(0);
    }
  });

  it("judges against that day only, not the whole calendar", async () => {
    await createBooking(owner, job({ eventDate: new Date(2026, 4, 20), serviceMinutes: at(19) }));
    const r = await couldTake(owner, job({ serviceMinutes: at(19) }));
    expect(r).toMatchObject({ ok: true, against: 0 });
  });

  it("excludes the booking being edited, so moving a job does not clash with itself", async () => {
    const id = await createBooking(owner, job({ serviceMinutes: at(19), guests: 20 }));
    const r = await couldTake(owner, { ...job({ serviceMinutes: at(19), guests: 20 }), id });
    expect(r).toMatchObject({ ok: true, against: 0 });
  });

  it("declines to guess when the district or venue is missing", async () => {
    const r = await couldTake(owner, job({ district: null }));
    expect(r.ok).toBeNull();
    if (r.ok === null) expect(r.why).toMatch(/district and a venue/);
  });

  it("a bigger kit can take what the default kit cannot", async () => {
    await createBooking(owner, job({ serviceMinutes: at(19) }));
    const tight = await couldTake(owner, job({ serviceMinutes: at(20) }));
    const roomy = await couldTake(owner, job({ serviceMinutes: at(20) }),
      { planchas: 4, fryers: 4, ovens: 4, vans: 4, crew: 20, maxShiftMinutes: 16 * 60 });

    expect(tight.ok).toBe(false);
    expect(roomy.ok).toBe(true);
  });

  it("a client cannot ask", async () => {
    await expect(couldTake(fakeViewer("client"), job())).rejects.toThrow(/Not permitted/);
  });

  it("a chef may ask — it is their day too", async () => {
    expect((await couldTake(chef, job({ guests: 20 }))).ok).toBe(true);
  });
});
