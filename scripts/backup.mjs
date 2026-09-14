/**
 * Everything a person did, in one file.
 *
 *   npm run backup            → backups/ayesicena-2026-09-14T0412Z.json
 *   npm run backup -- --out /media/usb
 *
 * Neon's free tier has no point-in-time recovery, and there is no pg_dump in a
 * Netlify function. So this runs from a laptop, over the same connection the
 * app uses, and writes plain JSON.
 *
 * It deliberately does not back up the menu. The 223 dishes, their recipes and
 * their costs are in data/, generated from the spreadsheet and held in git —
 * they are already backed up, by something better than this. What is here is
 * the part that exists nowhere else: who your clients are, what you quoted them,
 * what you booked, what you actually paid at the market, and the words you
 * rewrote on the site.
 *
 * Password hashes are included, because a restore that leaves everybody unable
 * to sign in is not a restore. That makes this file as sensitive as the
 * database. Keep it somewhere you would keep the database.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = argValue("--out") ?? "backups";
const pretty = !process.argv.includes("--compact");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const schema = await import("../db/schema.ts");
const { db } = await import("../db/index.ts");

/**
 * The order is the order a restore has to insert in: a quote cannot reference a
 * client that is not there yet. Kept explicit rather than derived, because
 * getting it wrong is only discovered on the day you actually need this.
 */
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

const backup = {
  takenAt: new Date().toISOString(),
  /* Which migration the database was on. A restore into a different shape is
   * the failure mode worth catching, and it is silent otherwise. */
  schemaVersion: "0002",
  tables: {}
};

let total = 0;
for (const [name, table] of TABLES) {
  const rows = await db.select().from(table);
  backup.tables[name] = rows;
  total += rows.length;
  console.log(`  ${name.padEnd(16)} ${String(rows.length).padStart(5)}`);
}

mkdirSync(outDir, { recursive: true });
const stamp = backup.takenAt.replace(/[:-]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "T");
const file = join(outDir, `ayesicena-${stamp}.json`);
writeFileSync(file, JSON.stringify(backup, null, pretty ? 2 : 0));

console.log(`\n${total} rows → ${file}`);

if (total === 0) {
  console.log(
    "\nNothing in the database yet. That is a real backup of an empty database, " +
    "not a failure — but check DATABASE_URL points where you think it does."
  );
}

/*
 * Restoring, because a backup nobody has restored is a hope:
 *
 *   npm run restore -- backups/ayesicena-….json
 *
 * scripts/restore.mjs refuses to run against a database that already has rows,
 * so this cannot be the command that destroys the thing it was meant to save.
 */
