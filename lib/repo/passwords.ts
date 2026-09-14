/**
 * Resetting a password without an email service.
 *
 * There is no SMTP account here and there is not going to be one: this app runs
 * at S/0 a month on Neon's and Netlify's free tiers, and a transactional email
 * provider is the first line item that would change that. Sending mail is also
 * the part of "forgot password" that actually breaks — a link in a spam folder
 * on a Saturday afternoon is not a recovery path.
 *
 * So the owner issues the link and sends it over WhatsApp, which is how this
 * business already reaches everybody it works with. That is not a workaround.
 * There are three accounts, every one of them was created by the owner by hand,
 * and a reset arriving through the same channel as the original password is a
 * shorter chain of trust than email ever was.
 *
 * Only sha256(token) is stored. A leaked backup then contains nothing anybody
 * can sign in with, which is the entire reason not to store the token itself.
 */
import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, passwordResets, users } from "@/db";
import { CAN, assertCan } from "@/lib/permissions";
import type { Viewer } from "@/lib/session";

/** An hour. Long enough to find the message, short enough to be worth little. */
export const RESET_MINUTES = 60;

/** Twelve characters, because this account can see the whole cost base. */
export const MIN_PASSWORD = 12;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface IssuedReset {
  /** Shown once, at the moment of issuing. Never stored, never recoverable. */
  token: string;
  expires: Date;
}

/**
 * Issue a reset for somebody's account.
 *
 * Any live reset for that user is burned first. Two valid links at once means
 * the older one — the one more likely to have been forwarded, screenshotted or
 * left in a chat — still works.
 */
export async function issueReset(me: Viewer, userId: string): Promise<IssuedReset> {
  assertCan(CAN.manageClients, me.role, "reset somebody's password");

  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("No such account.");

  await db.delete(passwordResets).where(
    and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt))
  );

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + RESET_MINUTES * 60_000);

  await db.insert(passwordResets).values({
    tokenHash: hashToken(token), userId, expires, issuedBy: me.id
  });

  return { token, expires };
}

export interface ResetTarget {
  userId: string;
  email: string;
  name: string | null;
}

/** Who this link is for, or null if it is expired, spent or invented. */
export async function resetTarget(token: string): Promise<ResetTarget | null> {
  if (!token) return null;

  const [row] = await db
    .select({ userId: users.id, email: users.email, name: users.name })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(and(
      eq(passwordResets.tokenHash, hashToken(token)),
      isNull(passwordResets.usedAt),
      gt(passwordResets.expires, new Date())
    ))
    .limit(1);

  return row ?? null;
}

/**
 * Spend the link and set the password.
 *
 * Marked used before the hash is written, so a reset that fails halfway leaves
 * a dead link and an unchanged password rather than a live link and a changed
 * one.
 */
export async function redeemReset(token: string, password: string): Promise<void> {
  const target = await resetTarget(token);
  if (!target) {
    throw new Error("That link has expired or has already been used. Ask for another.");
  }
  assertPasswordIsLongEnough(password);

  await db.update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.tokenHash, hashToken(token)));

  await db.update(users)
    .set({ passwordHash: await bcrypt.hash(password, 12), active: true })
    .where(eq(users.id, target.userId));
}

/**
 * Change your own password, knowing the current one.
 *
 * Separate from the reset path on purpose: this one needs no owner and no link,
 * and it is what somebody who simply wants a better password should use.
 */
export async function changeOwnPassword(
  me: Viewer, current: string, next: string
): Promise<void> {
  const [user] = await db.select({ hash: users.passwordHash }).from(users)
    .where(eq(users.id, me.id)).limit(1);

  if (!user?.hash || !(await bcrypt.compare(current, user.hash))) {
    throw new Error("That is not your current password.");
  }
  assertPasswordIsLongEnough(next);
  if (await bcrypt.compare(next, user.hash)) {
    throw new Error("That is the password you already have.");
  }

  await db.update(users)
    .set({ passwordHash: await bcrypt.hash(next, 12) })
    .where(eq(users.id, me.id));
}

export function assertPasswordIsLongEnough(password: string): void {
  if (password.length < MIN_PASSWORD) {
    throw new Error(
      `At least ${MIN_PASSWORD} characters. This account can see what every ` +
      `dish costs and who supplies it.`
    );
  }
}

/** Every login, for the admin screen that issues resets. */
export async function listLogins(me: Viewer) {
  assertCan(CAN.manageClients, me.role, "see the logins");
  return db.select({
    id: users.id, email: users.email, name: users.name,
    role: users.role, active: users.active, clientId: users.clientId,
    hasPassword: users.passwordHash, createdAt: users.createdAt
  }).from(users).orderBy(users.email);
}

/** Switch an account off. The session callback reads this on every request. */
export async function setActive(me: Viewer, userId: string, active: boolean): Promise<void> {
  assertCan(CAN.manageClients, me.role, "switch an account on or off");
  if (userId === me.id && !active) {
    throw new Error("You cannot switch off your own account — nobody could switch it back.");
  }
  await db.update(users).set({ active }).where(eq(users.id, userId));
}
