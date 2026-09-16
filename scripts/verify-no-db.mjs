/**
 * The shop window works with no database at all.
 *
 *   npm run verify:nodb        (expects `npm run build` to have run)
 *
 * This is a resilience property, not a curiosity. Neon's free tier suspends a
 * database that has been idle a few minutes, and free tiers have outages. When
 * that happens the quotes and the recipes can wait — but the page a customer
 * found on Instagram cannot, because they will not come back.
 *
 * So the public pages are built to need nothing: the 223 dishes, their
 * allergens, the tier rules and the pricing engine all live in data/ and lib/,
 * in git. The database holds only what a person did — who they are, what they
 * quoted, what they booked, which prices they verified at a stall. lib/copy.ts
 * reads the database for edited wording and falls back to the code when it
 * cannot, which is why the words still appear here.
 *
 * Starts a server with DATABASE_URL deliberately unset and checks the four
 * public pages render real content, that the private ones still redirect, and
 * that nothing 500s.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.NODB_PORT ?? 3399);
const BASE = `http://localhost:${PORT}`;

const failures = [];
const ok = (m) => console.log("  ✓ " + m);
const no = (m) => { failures.push(m); console.log("  ✕ " + m); };

// Unset rather than blanked: db/index.ts treats an absent URL as "no database"
// and falls back to a placeholder so nothing connects.
const env = { ...process.env, PORT: String(PORT), AUTH_URL: BASE, AUTH_SECRET: "verify-no-db" };
delete env.DATABASE_URL;

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  env, stdio: ["ignore", "pipe", "pipe"]
});
let log = "";
server.stdout.on("data", (b) => { log += b; });
server.stderr.on("data", (b) => { log += b; });

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/carta`, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  return false;
}

try {
  if (!(await waitForServer())) {
    console.error("server never came up\n" + log);
    process.exit(1);
  }

  console.log("the shop window, with no DATABASE_URL");

  for (const [path, mustContain] of [
    ["/", "Aye"],
    ["/carta", "Haggis Bonbons"],
    ["/paquetes", "Scran Boxes"],
    ["/eventos", "Aye"]
  ]) {
    const res = await fetch(BASE + path, { redirect: "manual" });
    if (res.status !== 200) { no(`${path} returned ${res.status}`); continue; }
    const html = await res.text();
    html.includes(mustContain)
      ? ok(`${path} renders`)
      : no(`${path} is 200 but empty of content`);
  }

  /*
   * Read the rendered text, not the flight payload.
   *
   * React splits adjacent text nodes with an HTML comment, so the markup says
   * `S/ <!-- -->75`, and the RSC payload escapes its own quotes. The first
   * version of this matched neither and reported two failures of its own on a
   * page that was rendering perfectly.
   */
  const asText = (html) =>
    html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // The prices are computed from lib/pricing.ts, which needs nothing.
  const packages = asText(await (await fetch(`${BASE}/paquetes`)).text());
  const figures = [...packages.matchAll(/S\/ (\d+)/g)].map((m) => Number(m[1]));
  figures.length >= 3 && figures.every((n) => n > 0)
    ? ok(`all three from-prices computed: ${figures.join(", ")}`)
    : no(`from-prices missing or zero: ${figures.join(", ") || "none"}`);

  // The whole menu, not a stub.
  const carta = asText(await (await fetch(`${BASE}/carta`)).text());
  /223 de 223|223 of 223/i.test(carta)
    ? ok("all 223 dishes are there")
    : no("the dish count is wrong or absent");

  for (const path of ["/panel", "/menu", "/quotes", "/admin"]) {
    const res = await fetch(BASE + path, { redirect: "manual" });
    res.status === 307 || res.status === 302
      ? ok(`${path} still redirects`)
      : no(`${path} returned ${res.status} with no database`);
  }

  if (/Error:|unhandledRejection|ECONNREFUSED/.test(log)) {
    no("the server logged an error while serving the public pages");
    console.log(log.split("\n").filter((l) => /Error|ECONN/.test(l)).slice(0, 4).join("\n"));
  } else {
    ok("nothing in the server log tried to reach a database");
  }
} finally {
  server.kill("SIGTERM");
}

console.log(failures.length === 0 ? "\nALL CHECKS PASSED" : `\n${failures.length} FAILED`);
process.exit(failures.length === 0 ? 0 : 1);
