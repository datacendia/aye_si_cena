/**
 * Making a guess expensive.
 *
 * The login accepted unlimited attempts at unlimited speed. bcrypt at cost 12
 * buys about 250ms a guess, which sounds like a lot and is not: a fortnight of
 * quiet, patient requests is tens of millions of tries against an account that
 * can see the whole cost base, every supplier and every margin.
 *
 * Two counters, because they catch different things. The per-email one catches
 * somebody working on one account. The per-IP one catches somebody working
 * through a list of addresses — which the per-email counter never sees, because
 * each address is only tried once or twice.
 *
 * The numbers are generous on purpose. There are three logins here and no
 * sign-up page, so ten wrong passwords in a quarter of an hour is already far
 * past "I have forgotten it" and nowhere near inconveniencing anyone real.
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, loginAttempts } from "@/db";

/** How far back the counters look. */
export const WINDOW_MINUTES = 15;
/** Wrong passwords for one address before that address stops being answered. */
export const MAX_PER_EMAIL = 10;
/** Failures from one address on the network before it stops being answered. */
export const MAX_PER_IP = 30;
/** Attempts older than this are no use to anybody and are swept away. */
const KEEP_HOURS = 48;

export interface Throttle {
  blocked: boolean;
  /** "email" or "ip" — which counter tripped. Never shown to the person. */
  reason: "email" | "ip" | null;
  /** Roughly how long until they may try again. */
  retryAfterMinutes: number;
}

const since = (minutes: number) => new Date(Date.now() - minutes * 60_000);

/**
 * Whether to answer this attempt at all.
 *
 * Called before the password is compared, so a blocked attempt costs one index
 * scan rather than a bcrypt round — which matters, because otherwise the
 * limiter becomes the denial of service it is there to prevent.
 */
export async function throttle(email: string, ip: string): Promise<Throttle> {
  const from = since(WINDOW_MINUTES);

  const [row] = await db
    .select({
      byEmail: sql<number>`count(*) filter (where ${loginAttempts.email} = ${email})::int`,
      byIp: sql<number>`count(*) filter (where ${loginAttempts.ip} = ${ip})::int`,
      oldest: sql<Date | null>`min(${loginAttempts.at})`
    })
    .from(loginAttempts)
    .where(and(
      eq(loginAttempts.ok, false),
      gte(loginAttempts.at, from),
      sql`(${loginAttempts.email} = ${email} or ${loginAttempts.ip} = ${ip})`
    ));

  const byEmail = row?.byEmail ?? 0;
  const byIp = row?.byIp ?? 0;
  const reason = byEmail >= MAX_PER_EMAIL ? "email" : byIp >= MAX_PER_IP ? "ip" : null;

  if (!reason) return { blocked: false, reason: null, retryAfterMinutes: 0 };

  // The window is rolling, so they are free again when the oldest failure in it
  // ages out — not a fixed fifteen minutes from now.
  const oldest = row?.oldest ? new Date(row.oldest) : from;
  const minutes = Math.max(
    1,
    Math.ceil((oldest.getTime() + WINDOW_MINUTES * 60_000 - Date.now()) / 60_000)
  );
  return { blocked: true, reason, retryAfterMinutes: minutes };
}

/**
 * Write down what happened.
 *
 * Successes are recorded as well as failures — partly because "signed in from
 * an address you have never used" is only answerable if the successes are
 * there, and partly because a success is what clears the counter.
 */
export async function recordAttempt(email: string, ip: string, ok: boolean): Promise<void> {
  await db.insert(loginAttempts).values({ email, ip, ok });

  if (ok) {
    // Getting it right clears the slate for that address. Otherwise somebody
    // who fumbles nine times and then succeeds is one typo from being locked
    // out of their own account.
    await db.delete(loginAttempts).where(
      and(eq(loginAttempts.email, email), eq(loginAttempts.ok, false))
    );
  }

  // Swept here rather than on a schedule: there is no cron on the free tier,
  // and this table is only ever written on the one path that can grow it.
  await db.delete(loginAttempts).where(lt(loginAttempts.at, since(KEEP_HOURS * 60)));
}

/** Recent attempts for one address, newest first. For the admin screen. */
export async function recentAttempts(email: string, limit = 20) {
  return db.select().from(loginAttempts)
    .where(eq(loginAttempts.email, email))
    .orderBy(sql`${loginAttempts.at} desc`)
    .limit(limit);
}
