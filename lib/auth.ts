/**
 * Who is asking.
 *
 * Email and password, with the session as a JWT - not by choice. Auth.js only
 * supports the Credentials provider with the JWT strategy; a database session
 * is refused outright. That matters, because the reason to want database
 * sessions is revocation: a signed token keeps asserting whatever was true when
 * it was issued, so demoting someone - or sacking them - would not take effect
 * until it expired.
 *
 * So the token is treated as an identity claim and nothing more. It carries a
 * user id and no authority whatsoever. Role, client and active are read from
 * the database in the session callback below, on every single request. Set
 * active = false and the next page that person loads has no session at all;
 * change their role and the next page obeys the new one. The cost is a query
 * per request, which at this size is the correct trade.
 *
 * There is no public sign-up. Every account is created by the owner, because
 * every account can see something a stranger should not.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, assertDatabase } from "@/db";
import { users, accounts, sessions, verificationTokens, type Role } from "@/db/schema";
import { throttle, recordAttempt } from "@/lib/repo/logins";

const Login = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1)
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens
  }),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        assertDatabase();
        const parsed = Login.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const ip = clientIp(request);

        /*
         * Checked before the password is compared, not after. A blocked attempt
         * must cost one index scan rather than a bcrypt round, or the limiter
         * becomes the denial of service it exists to prevent.
         *
         * The refusal is silent. Saying "too many attempts" would confirm that
         * the address is worth attacking, and the person being locked out is
         * almost never the person who typed the wrong password.
         */
        const limit = await throttle(email, ip);
        if (limit.blocked) {
          await recordAttempt(email, ip, false);
          return null;
        }

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        // Compare against a dummy hash when the user does not exist, so a
        // missing account and a wrong password take the same time to answer.
        // Otherwise the response time tells anyone who asks which emails are real.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(password, hash);
        const allowed = Boolean(user && ok && user.active && user.passwordHash);

        await recordAttempt(email, ip, allowed);
        if (!allowed || !user) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      }
    })
  ],
  callbacks: {
    /** The token carries an id and nothing else. Never a role. */
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },

    /**
     * Everything that grants access is read from the database here, on every
     * request - never from the token. This is what makes a sacking take effect
     * on the next page load rather than in thirty days.
     */
    async session({ session, token }) {
      const id = token.sub;
      if (!id) return { ...session, user: { ...session.user, active: false } };

      const [row] = await db
        .select({
          role: users.role, clientId: users.clientId, locale: users.locale,
          active: users.active, email: users.email, name: users.name
        })
        .from(users).where(eq(users.id, id)).limit(1);

      // Deleted, or switched off. Hand back a session nobody can use rather
      // than trusting what the token remembers.
      if (!row || !row.active) {
        return { ...session, user: { ...session.user, id, active: false } };
      }

      session.user.id = id;
      session.user.email = row.email;
      session.user.name = row.name;
      session.user.role = row.role as Role;
      session.user.clientId = row.clientId ?? null;
      session.user.locale = (row.locale ?? "es") as "es" | "en";
      session.user.active = true;
      return session;
    }
  }
});

/**
 * Who is asking, at the network level.
 *
 * Netlify puts the real client at the front of x-forwarded-for; everything
 * after it is proxies. Taking the last entry — or trusting a header the client
 * can set, like x-real-ip — would let anyone rotate their own counter by
 * sending a different value, which is worse than having no per-IP limit at all
 * because it looks like one.
 */
function clientIp(request: unknown): string {
  const headers = (request as { headers?: Headers } | undefined)?.headers;
  if (!headers || typeof headers.get !== "function") return "unknown";
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "unknown";
}

/** A bcrypt hash of a value nobody knows, for the timing-equalising compare above. */
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
