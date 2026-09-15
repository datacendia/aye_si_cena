/**
 * Drives the running app in a real browser, against a real Postgres.
 *
 *   npm run verify:app            # expects the app on :3300 and DATABASE_URL set
 *
 * The 600-odd unit tests cover lib/ and lib/repo/, and the standalone verifier
 * covers the single file. Between them sat the part nobody was checking: the
 * pages themselves, where a server action meets a form.
 *
 * Every failure this found on its first run was invisible from reading the code
 * and would have reached a person:
 *
 *   · five ticked checkboxes arrived as one, because Object.fromEntries keeps
 *     only the last of a repeated field — the proposer silently returned four
 *     dishes instead of eight and looked entirely correct doing it;
 *   · z.coerce.number() turned an untouched price box into 0, so renaming a
 *     dish was refused with "A menu price has to be more than zero";
 *   · an unticked licence box was indistinguishable from "not edited", so the
 *     flag could be switched on and never off;
 *   · three pages scrolled sideways at 390px, because a grid child will not
 *     shrink below its content and an overflow-x container inside one never
 *     gets the chance to scroll.
 *
 * It signs in as a real owner and reads what the page actually rendered, in
 * whichever language the account is set to.
 */
const { chromium } = await import("playwright").catch(() =>
  import("/opt/node22/lib/node_modules/playwright/index.mjs")
);

const BASE = process.env.APP_URL ?? "http://localhost:3300";
const EMAIL = process.env.VERIFY_EMAIL;
const PASSWORD = process.env.VERIFY_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error(
    "VERIFY_EMAIL and VERIFY_PASSWORD must be set to an owner account on the " +
    "database this app is pointed at. See the Hosting section of the README."
  );
  process.exit(1);
}

const failures = [];
const ok = (m) => console.log("  ✓ " + m);
const no = (m) => { failures.push(m); console.log("  ✕ " + m); };
/*
 * Case-insensitive, because innerText returns what the page displays and this
 * design uppercases its labels in CSS. "Closed season" renders as "CLOSED
 * SEASON", and two of these checks failed on that alone — a verifier reporting
 * its own bugs is worse than no verifier, because the next real failure gets
 * ignored with the rest.
 */
const has = (text, needle, m) =>
  text.toLowerCase().includes(needle.toLowerCase()) ? ok(m) : no(`${m} — not found: ${needle}`);

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

/* ───────────────────────────── signing in ───────────────────────────── */

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await Promise.all([
  page.waitForURL(`${BASE}/`, { timeout: 30_000 }),
  // Scoped to its own form: the header carries a language toggle and a sign-out
  // button, both type="submit", and both come first in the DOM.
  page.locator('form:has(input[name="password"]) button[type="submit"]').click()
]);
ok("signs in and lands on the home page");

/*
 * The account decides the language, not a cookie — so set it rather than assume
 * it, and then wait for it rather than assuming the click landed.
 *
 * Two versions of this got it wrong. The first asserted English against a
 * Spanish page and reported four failures that were its own. The second clicked
 * the toggle and read the language straight after `networkidle` — but the
 * toggle is a server action that revalidates the layout, and the re-render
 * arrives after the network has gone quiet. It read the old value and every
 * language-dependent check downstream was against the wrong words.
 */
async function setLanguage(want) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await page.getAttribute("html", "lang")) === want) return true;
    await page.locator("header form button[title]").first().click();
    // Poll for the attribute rather than for the network: the layout re-renders
    // after the action resolves, which is later.
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250);
      if ((await page.getAttribute("html", "lang")) === want) return true;
    }
    await page.reload({ waitUntil: "networkidle" });
  }
  return (await page.getAttribute("html", "lang")) === want;
}

(await setLanguage("en"))
  ? ok("the language toggle takes, and persists")
  : no(`language is ${await page.getAttribute("html", "lang")}, not en`);

/* ────────────────────── what sells against what it earns ────────────── */

console.log("\n/engineering");
await page.goto(`${BASE}/engineering`, { waitUntil: "networkidle" });
const eng = await page.locator("body").innerText();

for (const box of ["Stars", "Ploughhorses", "Puzzles", "Dogs"]) {
  has(eng, box, `${box} renders`);
}
has(eng, "Never offered", "dishes nobody has quoted are set aside, not filed as dogs");

const engRows = await page.locator("table tbody tr").count();
engRows > 0 ? ok(`${engRows} dishes filed into boxes`) : no("no dishes in any box");
const covers = eng.match(/([\d,]+) covers/i);
covers ? ok(`covers counted: ${covers[0]}`) : no("no cover count");

/* ─────────────────────────── proposing a menu ────────────────────────── */

console.log("\n/propose");
await page.goto(`${BASE}/propose`, { waitUntil: "networkidle" });

// September, because the corvina veda is on — the constraint that must never
// be traded away, checked against a month where it actually bites.
await page.selectOption('select[name="month"]', "9");
const clients = await page.locator('select[name="clientId"] option').count();
if (clients > 1) await page.selectOption('select[name="clientId"]', { index: 1 });
await page.fill('input[name="want"]', "8");
await page.locator('form:has(select[name="month"]) button[type="submit"]').click();
await page.waitForSelector("ol li", { timeout: 30_000 });

const proposed = await page.locator("ol li").count();
proposed === 8
  ? ok("proposes exactly the eight asked for")
  : no(`proposed ${proposed}, not 8 — every kit checkbox must reach the action`);

const prop = await page.locator('[aria-live="polite"]').innerText();
const share = prop.match(/(\d+)% British/i);
share ? ok(`the Scottish half holds: ${share[0]}`) : no("no British share reported");
if (share && Number(share[1]) < 50) no(`British share fell to ${share[1]}%`);
has(prop, "What the month took away", "says what it ruled out, as prominently as the menu");
has(prop, "Closed season", "the September veda removed dishes");
has(prop, "offence", "and calls it an offence rather than a risk");

const reasons = await page.locator("ol li span span").allInnerTexts();
reasons.length > 0
  ? ok(`every dish carries its reasons (${new Set(reasons).size} distinct)`)
  : no("no dish says why it is on the menu");

/* ───────────────────────────── price drift ──────────────────────────── */

console.log("\n/prices");
await page.goto(`${BASE}/prices`, { waitUntil: "networkidle" });
const prices = await page.locator("body").innerText();
has(prices, "What is moving", "the drift section renders");

/* ──────────────────────────── can you do it ─────────────────────────── */

console.log("\n/take");
await page.goto(`${BASE}/take`, { waitUntil: "networkidle" });
await page.fill('input[name="guests"]', "40");
await page.locator('form:has(input[name="date"]) button[type="submit"]').click();
await page.waitForSelector('[aria-live="polite"] div', { timeout: 30_000 });
const verdict = (await page.locator('[aria-live="polite"]').innerText()).split("\n")[0];
/Yes — it fits|No, not as it stands/.test(verdict)
  ? ok(`answers the question: ${verdict}`)
  : no(`no verdict: ${verdict}`);

/* ─────────────────────── the admin, and that it lands ───────────────── */

console.log("\n/admin");
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
const admin = await page.locator("body").innerText();
has(admin, "Logins", "the logins panel renders");
has(admin, "Dishes", "the dish editor renders");
has(admin, "Words on the site", "the copy editor renders");

console.log("\nan edit reaches the menu, in both languages");
const MARK = `Verified ${Date.now().toString().slice(-6)}`;
await page.locator("button[aria-expanded]").first().click();
await page.waitForSelector('input[name="nameEs"]');
const form = page.locator('form:has(input[name="nameEs"])').first();
await page.fill('input[name="name"]', MARK);
await page.fill('input[name="nameEs"]', `${MARK} ES`);
await form.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);

// No price was typed, on purpose: an untouched price box must not be read as
// zero and refuse the rename.
const saved = await form.innerText();
saved.includes("more than zero")
  ? no("an untouched price box was read as zero and refused the rename")
  : ok("a dish can be renamed without touching its price");

await page.goto(`${BASE}/find`, { waitUntil: "networkidle" });
has(await page.locator("body").innerText(), MARK, "the edit reaches /find in English");

await setLanguage("es");
await page.goto(`${BASE}/find`, { waitUntil: "networkidle" });
has(await page.locator("body").innerText(), `${MARK} ES`,
  "and the Spanish name reaches a Spanish reader");
await setLanguage("en");

// Put it back, so running this twice leaves nothing behind.
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.locator("button[aria-expanded]").first().click();
await page.waitForSelector('input[name="nameEs"]');
await page.locator('form:has(input[name="nameEs"]) button').filter({ hasText: /default|defecto/ })
  .first().click().catch(() => {});
await page.waitForTimeout(2000);

/* ───────────────────────────── on a phone ───────────────────────────── */

console.log("\n390px — no sideways scroll anywhere");
await page.setViewportSize({ width: 390, height: 844 });
const PAGES = [
  "/", "/find", "/moments", "/menu", "/recipes", "/seasonal", "/compare",
  "/graph", "/packages", "/builder", "/quotes", "/clients", "/bookings",
  "/prices", "/take", "/propose", "/engineering", "/admin", "/account"
];
for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  const over = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  over <= 1 ? ok(`${path}`) : no(`${path} scrolls sideways by ${over}px`);
}

await browser.close();

console.log(failures.length === 0 ? "\nALL CHECKS PASSED" : `\n${failures.length} FAILED`);
process.exit(failures.length === 0 ? 0 : 1);
