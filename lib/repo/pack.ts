/**
 * One booking, on one link, for the person who is paying.
 *
 * The eleven WhatsApp messages before every event are the same eleven
 * questions: what is the menu, what time, how many, what about the nut allergy,
 * what do we owe. This is a page that answers them and a link that opens it
 * without an account — the bride's mother is not getting a login.
 *
 * Same shape as the password reset, for the same reason: only the SHA-256 is
 * stored, so a leaked backup carries nothing anybody can open. Two differences,
 * both deliberate. It is long-lived, because it is meant to be read twenty
 * times over three months. And it is revocable, because a link that outlives
 * the relationship is a menu somebody can still read.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, desc } from "drizzle-orm";
import { db, bookingShares, bookings, quotes, clients } from "@/db";
import { CAN, assertCan } from "@/lib/permissions";
import type { Viewer } from "@/lib/session";

/** Ninety days. Long enough for a wedding booked in advance to keep working. */
export const SHARE_DAYS = 90;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export interface IssuedShare {
  token: string;
  expires: Date;
}

export async function issueShare(me: Viewer, bookingId: string): Promise<IssuedShare> {
  assertCan(CAN.writeBookings, me.role, "share a booking with a client");

  const [booking] = await db.select({ id: bookings.id }).from(bookings)
    .where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new Error("No such booking.");

  /*
   * Any live link for this booking is revoked first.
   *
   * Two working links means the older one — the one more likely to have been
   * forwarded into a family group chat — still opens the menu after somebody
   * has been told it would not.
   */
  await db.update(bookingShares)
    .set({ revokedAt: new Date() })
    .where(and(eq(bookingShares.bookingId, bookingId), isNull(bookingShares.revokedAt)));

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SHARE_DAYS * 86_400_000);

  await db.insert(bookingShares).values({
    tokenHash: hash(token), bookingId, expires, issuedBy: me.id
  });

  return { token, expires };
}

export async function revokeShare(me: Viewer, bookingId: string): Promise<void> {
  assertCan(CAN.writeBookings, me.role, "revoke a client link");
  await db.update(bookingShares)
    .set({ revokedAt: new Date() })
    .where(and(eq(bookingShares.bookingId, bookingId), isNull(bookingShares.revokedAt)));
}

/** Whether this booking currently has a live link, for the admin screen. */
export async function shareState(me: Viewer, bookingId: string) {
  assertCan(CAN.writeBookings, me.role, "see whether a booking is shared");
  const [row] = await db.select({ issuedAt: bookingShares.issuedAt, expires: bookingShares.expires })
    .from(bookingShares)
    .where(and(
      eq(bookingShares.bookingId, bookingId),
      isNull(bookingShares.revokedAt),
      gt(bookingShares.expires, new Date())
    ))
    .orderBy(desc(bookingShares.issuedAt))
    .limit(1);
  return row ?? null;
}

export interface PackBooking {
  bookingId: string;
  eventDate: Date;
  serviceMinutes: number;
  guests: number;
  tier: string;
  district: string | null;
  venue: string | null;
  dishIds: number[];
  clientName: string | null;
  clientDiets: string[];
  quoteName: string | null;
  /** What the client agreed to pay, IGV included. Null if there was no quote. */
  grossTotal: number | null;
}

/**
 * The booking behind a link, or null.
 *
 * Null covers expired, revoked and invented alike — telling them apart tells
 * somebody holding a guessed token that they guessed nearly right.
 *
 * No viewer, on purpose: the token is the authority. It is the only read in
 * this app that works without a session, and it is narrow — one booking, and
 * only the fields below.
 */
export async function packFor(token: string): Promise<PackBooking | null> {
  if (!token) return null;

  const [row] = await db
    .select({ b: bookings, q: quotes, c: clients })
    .from(bookingShares)
    .innerJoin(bookings, eq(bookings.id, bookingShares.bookingId))
    .leftJoin(quotes, eq(quotes.id, bookings.quoteId))
    .leftJoin(clients, eq(clients.id, bookings.clientId))
    .where(and(
      eq(bookingShares.tokenHash, hash(token)),
      isNull(bookingShares.revokedAt),
      gt(bookingShares.expires, new Date())
    ))
    .limit(1);

  if (!row) return null;

  return {
    bookingId: row.b.id,
    eventDate: row.b.eventDate,
    serviceMinutes: row.b.serviceMinutes,
    guests: row.b.guests,
    tier: row.b.tier,
    district: row.b.district,
    venue: row.b.venue,
    dishIds: row.b.dishIds,
    clientName: row.c?.name ?? null,
    clientDiets: row.c?.diets ?? [],
    quoteName: row.q?.name ?? null,
    grossTotal: row.q?.grossTotal ?? null
  };
}
