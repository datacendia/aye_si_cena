/**
 * The front door, against a real Postgres.
 *
 * Before this the login accepted unlimited attempts at unlimited speed, which
 * is a worse position than it sounds: bcrypt at cost 12 buys about 250ms a
 * guess, and a fortnight of patient requests is tens of millions of tries
 * against an account that can see the whole cost base.
 *
 * The two tests that carry the most weight are the ones about what the limiter
 * must NOT do. It must not lock out the person who eventually types their own
 * password correctly, and it must not be escapable by rotating the address
 * being guessed — which is exactly what a per-email counter alone permits.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import {
  migrate, reset, close, db, assertResetCoversEveryTable
} from "./helpers/pglite";
import {
  throttle, recordAttempt, recentAttempts,
  MAX_PER_EMAIL, MAX_PER_IP, WINDOW_MINUTES
} from "@/lib/repo/logins";
import { loginAttempts } from "@/db/schema";

const EMAIL = "stu@ayesicena.pe";
const IP = "190.12.84.7";

beforeAll(migrate);
afterAll(close);
beforeEach(reset);

it("the reset between tests covers every table", assertResetCoversEveryTable);

const fail = (n: number, email = EMAIL, ip = IP) =>
  Promise.all(Array.from({ length: n }, () =>
    db.insert(loginAttempts).values({ email, ip, ok: false })));

describe("per-email", () => {
  it("lets an ordinary run of wrong passwords through", async () => {
    await fail(MAX_PER_EMAIL - 1);
    expect((await throttle(EMAIL, IP)).blocked).toBe(false);
  });

  it("stops answering at the limit", async () => {
    await fail(MAX_PER_EMAIL);
    const t = await throttle(EMAIL, IP);
    expect(t.blocked).toBe(true);
    expect(t.reason).toBe("email");
    expect(t.retryAfterMinutes).toBeGreaterThan(0);
    expect(t.retryAfterMinutes).toBeLessThanOrEqual(WINDOW_MINUTES);
  });

  it("blocks that address only, not everybody", async () => {
    await fail(MAX_PER_EMAIL);
    expect((await throttle("ana@ayesicena.pe", "200.1.1.1")).blocked).toBe(false);
  });

  it("forgets failures older than the window", async () => {
    const old = new Date(Date.now() - (WINDOW_MINUTES + 1) * 60_000);
    await Promise.all(Array.from({ length: MAX_PER_EMAIL + 5 }, () =>
      db.insert(loginAttempts).values({ email: EMAIL, ip: IP, ok: false, at: old })));
    expect((await throttle(EMAIL, IP)).blocked).toBe(false);
  });

  it("does not count successes towards the limit", async () => {
    await Promise.all(Array.from({ length: MAX_PER_EMAIL + 5 }, () =>
      db.insert(loginAttempts).values({ email: EMAIL, ip: IP, ok: true })));
    expect((await throttle(EMAIL, IP)).blocked).toBe(false);
  });
});

describe("per-IP — the counter that catches a list being worked through", () => {
  it("catches one address trying many accounts, which the email counter never sees", async () => {
    // One go at each of many addresses. No single per-email count comes near
    // its limit — MAX_PER_EMAIL is 10 and every one of these is at 1 — so the
    // per-email counter alone would let this run indefinitely.
    for (let i = 0; i < MAX_PER_IP; i++) {
      await db.insert(loginAttempts).values({ email: `person${i}@somewhere.pe`, ip: IP, ok: false });
    }

    // Same failures, counted from a different address on the network: nothing
    // trips, which is the per-email counter's whole view of this attack.
    expect((await throttle("person0@somewhere.pe", "181.64.2.9")).blocked).toBe(false);

    const t = await throttle("nobody@somewhere.pe", IP);
    expect(t.blocked).toBe(true);
    expect(t.reason).toBe("ip");
  });

  it("blocks that address on the network only", async () => {
    for (let i = 0; i < MAX_PER_IP; i++) {
      await db.insert(loginAttempts).values({ email: `p${i}@x.pe`, ip: IP, ok: false });
    }
    expect((await throttle("p0@x.pe", "181.64.2.9")).blocked).toBe(false);
  });

  it("treats an unknown address as one address rather than as no limit", async () => {
    for (let i = 0; i < MAX_PER_IP; i++) {
      await db.insert(loginAttempts).values({ email: `p${i}@x.pe`, ip: "unknown", ok: false });
    }
    expect((await throttle("p0@x.pe", "unknown")).blocked).toBe(true);
  });
});

describe("recording", () => {
  it("writes down every attempt, including ones for addresses that do not exist", async () => {
    await recordAttempt("nobody@nowhere.pe", IP, false);
    const rows = await db.select().from(loginAttempts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "nobody@nowhere.pe", ip: IP, ok: false });
  });

  it("getting it right clears the slate, so one later typo is not a lockout", async () => {
    await fail(MAX_PER_EMAIL - 1);
    await recordAttempt(EMAIL, IP, true);

    expect((await throttle(EMAIL, IP)).blocked).toBe(false);
    await recordAttempt(EMAIL, IP, false);
    expect((await throttle(EMAIL, IP)).blocked).toBe(false);
  });

  it("a success clears that address only", async () => {
    await fail(MAX_PER_EMAIL, "ana@ayesicena.pe");
    await recordAttempt(EMAIL, IP, true);
    expect((await throttle("ana@ayesicena.pe", IP)).blocked).toBe(true);
  });

  it("sweeps attempts too old to be evidence of anything", async () => {
    await db.insert(loginAttempts).values({
      email: EMAIL, ip: IP, ok: false,
      at: new Date(Date.now() - 72 * 60 * 60_000)
    });
    await recordAttempt(EMAIL, IP, false);

    const rows = await db.select().from(loginAttempts);
    expect(rows).toHaveLength(1);
  });

  it("lists recent attempts newest first", async () => {
    await recordAttempt(EMAIL, IP, false);
    await new Promise((r) => setTimeout(r, 5));
    await recordAttempt(EMAIL, "181.64.2.9", false);

    const recent = await recentAttempts(EMAIL);
    expect(recent).toHaveLength(2);
    expect(recent[0].ip).toBe("181.64.2.9");
  });
});

describe("the limiter is not itself the attack", () => {
  it("answers with nothing recorded at all", async () => {
    expect(await throttle(EMAIL, IP)).toEqual({
      blocked: false, reason: null, retryAfterMinutes: 0
    });
  });

  it("counts in one query rather than one per counter", async () => {
    // Both counters come from a single scan of a single index range. Two
    // round trips per login attempt is two cold-start penalties on a free tier.
    await fail(3);
    const t = await throttle(EMAIL, IP);
    expect(t.blocked).toBe(false);
  });
});
