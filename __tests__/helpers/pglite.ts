/**
 * A real Postgres, in this process, for the repository tests.
 *
 * lib/repo/ was the least covered code in the app and the most dangerous: it is
 * the layer that decides which client's quote you are looking at. The reason it
 * went untested was that testing it appeared to need a database, and a test
 * suite that needs a server running is a test suite nobody runs.
 *
 * PGlite is Postgres compiled to WebAssembly. It is not a mock and not SQLite
 * pretending: it is the same query planner, the same `jsonb`, the same partial
 * unique index, the same `count(distinct …)::int`. So these tests exercise the
 * actual SQL Drizzle emits, and a scoping bug in a WHERE clause fails here
 * rather than in front of a client.
 *
 * The schema is built by replaying db/migrations/*.sql in journal order — the
 * same files that run against Neon. A migration that does not apply cleanly
 * therefore breaks the test run, which is the earliest anyone could find out.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "@/db/schema";
import type { Viewer } from "@/lib/session";
import type { Role } from "@/db/schema";

const MIGRATIONS = join(__dirname, "..", "..", "db", "migrations");

export const client = new PGlite();
export const db = drizzle(client, { schema });

/** Every table the app writes to, for the reset between tests. */
const TABLES = [
  "quote_dishes", "quotes", "bookings", "price_overrides",
  "site_copy", "dish_edits", "accounts", "sessions",
  "verification_tokens", "login_attempts", "password_resets",
  "users", "clients"
];

export async function migrate(): Promise<void> {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS, "meta", "_journal.json"), "utf8")
  ) as { entries: { tag: string }[] };

  for (const entry of journal.entries) {
    const file = readFileSync(join(MIGRATIONS, `${entry.tag}.sql`), "utf8");
    for (const statement of file.split("--> statement-breakpoint")) {
      const sql = statement.trim();
      if (sql) await client.exec(sql);
    }
  }
}

/**
 * Empty every table. Cheaper than a fresh database and just as isolated.
 *
 * A table missing from that list does not fail loudly — it leaks rows into the
 * next test, and the symptom is a suite that passes alone and fails in order.
 * The check below is what turns that into a failure at the point of the
 * mistake instead.
 */
export async function reset(): Promise<void> {
  await client.exec(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE;`);
}

/**
 * Every table the migrations create is in TABLES.
 *
 * Called once by the repository suites. Adding a table to db/schema.ts and
 * forgetting it here is the kind of mistake that shows up three suites later as
 * a count that is wrong by exactly the number of rows some earlier test wrote.
 */
export async function assertResetCoversEveryTable(): Promise<void> {
  const { rows } = await client.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public'`
  );
  const missing = rows
    .map((r) => r.tablename)
    .filter((t) => t !== "__drizzle_migrations" && !TABLES.includes(t));

  if (missing.length) {
    throw new Error(
      `__tests__/helpers/pglite.ts does not truncate: ${missing.join(", ")}. ` +
      `Rows there will leak into the next test.`
    );
  }
}

/**
 * What `jest.mock("@/db", …)` should return.
 *
 * The real module picks a driver from DATABASE_URL and would reach for a
 * socket; this one hands back the in-process database and the same schema
 * re-exports, so nothing in lib/repo/ knows the difference.
 */
export function mockModule() {
  return { db, databaseConfigured: true, assertDatabase() {}, ...schema };
}

/* ───────────────────────────── fixtures ───────────────────────────── */

let seq = 0;

/** A signed-in person. Inserted, because the repositories store `createdBy`. */
export async function makeUser(
  role: Role, opts: { clientId?: string | null; name?: string } = {}
): Promise<Viewer> {
  const email = `${role}-${++seq}@ayesicena.pe`;
  const [row] = await db.insert(schema.users).values({
    email,
    name: opts.name ?? role,
    role,
    clientId: opts.clientId ?? null
  }).returning({ id: schema.users.id });

  return {
    id: row.id, email, name: opts.name ?? role, role,
    clientId: opts.clientId ?? null, locale: "en"
  };
}

/** A viewer who was never inserted — for permission tests that never write. */
export function fakeViewer(role: Role, clientId: string | null = null): Viewer {
  return { id: `fake-${role}`, email: `${role}@x.pe`, name: role, role, clientId, locale: "en" };
}

export async function makeClient(name: string, diets: string[] = []): Promise<string> {
  const [row] = await db.insert(schema.clients).values({ name, diets })
    .returning({ id: schema.clients.id });
  return row.id;
}

/** Let Jest exit: the WASM database holds a handle until it is told not to. */
export async function close(): Promise<void> {
  await client.close();
}
