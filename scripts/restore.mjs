/**
 * Put a backup back.
 *
 *   npm run restore -- backups/ayesicena-20260914T0412Z.json
 *
 * Refuses to run against a database that already has rows in it. A restore is
 * something you reach for at the worst possible moment, and the failure worth
 * designing against is not "it did not work" — it is "it ran against the live
 * database and overwrote what was still there". Empty the target deliberately,
 * with --force, or restore into a fresh one.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
const force = process.argv.includes("--force");

if (!file) {
  console.error("usage: restore.mjs <backup.json> [--force]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, "utf8"));
const schema = await import("../db/schema.ts");
const { db } = await import("../db/index.ts");

const TABLES = [
  ["clients", schema.clients],
  ["users", schema.users],
  ["quotes", schema.quotes],
  ["quote_dishes", schema.quoteDishes],
  ["bookings", schema.bookings],
  ["price_overrides", schema.priceOverrides],
  ["site_copy", schema.siteCopy],
  ["dish_edits", schema.dishEdits]
];

// Count first, everywhere, before anything is written.
let existing = 0;
for (const [, table] of TABLES) existing += (await db.select().from(table)).length;

if (existing > 0 && !force) {
  console.error(
    `That database already holds ${existing} rows. Restoring would write on top ` +
    `of them.\nIf you are sure, run again with --force. If you are not, point ` +
    `DATABASE_URL at an empty database instead.`
  );
  process.exit(1);
}

console.log(`from ${file}, taken ${backup.takenAt}`);

let total = 0;
for (const [name, table] of TABLES) {
  const rows = backup.tables?.[name] ?? [];
  if (rows.length === 0) { console.log(`  ${name.padEnd(16)}     0`); continue; }

  // Dates come back from JSON as strings; Drizzle wants Date objects for
  // timestamp columns. Converting anything that parses as an ISO instant is
  // enough here and avoids naming all forty-odd columns.
  const shaped = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [
      k,
      typeof v === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(v) ? new Date(v) : v
    ]))
  );

  await db.insert(table).values(shaped);
  total += rows.length;
  console.log(`  ${name.padEnd(16)} ${String(rows.length).padStart(5)}`);
}

console.log(`\n${total} rows restored.`);
