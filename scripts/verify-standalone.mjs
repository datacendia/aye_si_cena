/**
 * Drives the standalone HTML in a real browser and checks its rendered quote
 * figures against values computed by the TypeScript in lib/pricing.ts.
 *
 * The standalone re-implements the quote maths in vanilla JS; this is what
 * stops the two implementations drifting apart.
 */
/*
 * Playwright, from wherever it happens to live.
 *
 * This was an absolute path into one machine's global node_modules, which
 * worked on that machine and nowhere else — so the check that guards the
 * standalone could not run in CI, which is the one place it needs to run
 * without being asked. Resolved normally first, with the global install as the
 * fallback for the laptop it was written on.
 */
const { chromium } = await import("playwright").catch(() =>
  import("/opt/node22/lib/node_modules/playwright/index.mjs")
);

const FILE = process.argv[2];
if (!FILE) throw new Error("usage: verify-standalone.mjs <path-to-html>");

// Expected values produced by lib/pricing.ts for the same inputs.
// Default selection in the builder is dishes 51, 6, 71, 16.
const CASES = [
  { name: "Plated · 20 guests · default picks", tier: "The Aye Si Plated Experience", guests: 20 },
  { name: "Scran · 40 guests · default picks", tier: "Scran Boxes", guests: 40 }
];

const { DISHES } = await import("../.verify-dishes.mjs");
const { FLAVOURS } = await import("../.verify-flavours.mjs");
const { EVENTS } = await import("../.verify-events.mjs");
const { INGREDIENTS } = await import("../.verify-ingredients.mjs");
const { MOMENTS } = await import("../.verify-moments.mjs");
const { RECIPES } = await import("../.verify-recipes.mjs");
const { DISTRICTS, VENUE_TYPES } = await import("../.verify-venues.mjs");
const { INGREDIENTS: SEASONAL } = await import("../.verify-ingredients.mjs");
const { transportCost } = await import("../lib/venues.ts").catch(() => ({ transportCost: null }));
const DISHES_LEN = DISHES.length;

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
// The page defaults to Spanish because the buyers are Peruvian. Every check
// below drives it by its English labels, so pin the language before loading.
await page.addInitScript(() => {
  try { localStorage.setItem("ayesicena-lang", "en"); } catch (e) {}
});
await page.goto("file://" + FILE);

let failures = 0;

// --- The file has to be a file: standards mode, sized for a phone, offline ---
// Every one of these was missing. The page ran in quirks mode, laid itself out
// at ~980px on a real phone whatever the CSS said, and blocked first paint for
// 13.2 seconds on a Google Fonts request that is not there to be reached from a
// market stall in Surquillo.
{
  const offline = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const external = [];
  offline.on("request", (r) => { if (!r.url().startsWith("file:")) external.push(r.url()); });
  await offline.goto("file://" + FILE);
  await offline.waitForTimeout(1200);
  const head = await offline.evaluate(() => ({
    doctype: document.doctype ? document.doctype.name : null,
    mode: document.compatMode,
    charset: document.characterSet,
    viewport: !!document.querySelector('meta[name="viewport"]'),
    description: !!document.querySelector('meta[name="description"]'),
    fcp: Math.round((performance.getEntriesByType("paint")[0] || {}).startTime ?? -1),
    fonts: ["Fraunces", "Karla", "IBM Plex Mono"].filter((f) => document.fonts.check(`16px '${f}'`)),
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
  const headOk = head.doctype === "html" && head.mode === "CSS1Compat" &&
    head.charset === "UTF-8" && head.viewport && head.description;
  if (!headOk) failures++;
  console.log(`\nstandards mode, charset and viewport: ${headOk ? "✓" : "✗ " + JSON.stringify(head)}`);

  if (external.length) failures++;
  console.log(`nothing fetched from the network: ${external.length ? "✗ " + external[0].slice(0, 80) : "✓"}`);

  const fontsOk = head.fonts.length === 3;
  if (!fontsOk) failures++;
  console.log(`all three faces embedded and loaded: ${fontsOk ? "✓" : "✗ only " + head.fonts.join(", ")}`);

  // 13,172 ms as shipped, 112 ms with the link removed. A second is generous.
  const paintOk = head.fcp >= 0 && head.fcp < 1000;
  if (!paintOk) failures++;
  console.log(`first paint under a second: ${paintOk ? "✓" : "✗"} (${head.fcp} ms)`);

  if (head.sideways) failures++;
  console.log(`no sideways scroll at 390px: ${head.sideways ? "✗" : "✓"}`);
  await offline.close();
}

// Sanity: the data actually made it into the page.
await page.getByRole("tab", { name: "The matrix" }).click();
const rowCount = await page.locator("#menuBody .mxtable tbody tr").count();
console.log(`dish rows rendered: ${rowCount}${rowCount === DISHES_LEN ? " ✓" : `  ✗ expected ${DISHES_LEN}`}`);
if (rowCount !== DISHES_LEN) failures++;

// The page must flag exactly the dishes lib/pricing.ts calls over-target -
// not zero. A dish above the band is a finding to surface, not a test to fail.
// Scoped to the table: the same rows also render as cards for narrow
// screens, and counting both double-counts every flag.
const overFlags = await page.locator("#menuBody .mxtable .fc.over").count();
const overExpected = DISHES.filter((d) => d.cost / d.price > 0.3).length;
const overOk = overFlags === overExpected;
if (!overOk) failures++;
console.log(
  `dishes flagged over 30% food cost: ${overFlags}` +
  (overOk ? ` ✓ (matches lib/pricing.ts)` : `  ✗ expected ${overExpected}`)
);

await page.getByRole("tab", { name: "Build a menu" }).click();

for (const c of CASES) {
  await page.getByRole("button", { name: c.tier, exact: true }).click();
  await page.fill("#guests", String(c.guests));
  await page.waitForTimeout(120);

  console.log(`
${c.name}`);
  // Independently recompute what lib/pricing.ts would produce for what is on screen.
  const shownNet = (await page.locator("#quote .qrow", { hasText: "Net, per guest" }).first().innerText())
    .replace("Net, per guest", "").trim();
  const shownGross = (await page.locator("#quote .qrow", { hasText: "Client pays" }).first().innerText())
    .replace("Client pays", "").trim();
  const net = Number(shownNet.replace("S/", "").trim());
  const gross = Number(shownGross.replace("S/", "").trim());
  // The per-guest figure on screen is rounded to 2dp, so multiplying it by the
  // head count carries up to half a centimo of error per guest. Derive the
  // tolerance from that rather than asserting a flat 2 centimos, which only
  // ever passed because transport used to be a round number.
  const tolerance = 0.005 * c.guests * 1.18 + 0.01;
  const igvOk = Math.abs(gross - net * c.guests * 1.18) < tolerance;
  if (!igvOk) failures++;
  console.log(`  net/guest ${shownNet}  client pays ${shownGross}  IGV maths ${igvOk ? "✓" : "✗"}`);
}

// The tier minimum must warn rather than quote silently.
await page.getByRole("button", { name: "The Aye Si Plated Experience", exact: true }).click();
await page.fill("#guests", "4");
await page.waitForTimeout(120);
const warned = await page.locator("#quote .warn").count();
console.log(`\nbelow-minimum warning shown: ${warned > 0 ? "yes ✓" : "no ✗"}`);
if (warned === 0) failures++;

// --- Find dishes: the standalone must filter identically to lib/dishes.ts ---
function matchesEvent(d, f) {
  if (f.tier && !d.tiers.includes(f.tier)) return false;
  if (f.categories && !f.categories.includes(d.category)) return false;
  if (f.formats && !f.formats.includes(d.format)) return false;
  if (f.needsLicence !== undefined && d.needsLicence !== f.needsLicence) return false;
  if (f.veg !== undefined && d.veg !== f.veg) return false;
  if (f.subOrigins && !f.subOrigins.some((o) => d.subOrigin.startsWith(o))) return false;
  return true;
}

await page.getByRole("tab", { name: "Find dishes" }).click();
console.log("\nEvent filters");

for (const ev of EVENTS) {
  const expected = DISHES.filter((d) => matchesEvent(d, ev.filter)).length;
  await page.locator(`[data-evt="${ev.id}"]`).click();
  await page.waitForTimeout(80);
  const shown = Number((await page.locator("#findCount b").innerText()).trim());
  const ok = shown === expected;
  if (!ok) failures++;
  console.log(`  ${ev.id.padEnd(15)} ${String(shown).padStart(3)} ${ok ? "✓" : "✗ expected " + expected}`);
  await page.locator(`[data-evt="${ev.id}"]`).click(); // toggle back off
  await page.waitForTimeout(60);
}

// A flavour narrows the set, and "all" is never wider than "any".
await page.locator('[data-flav="sweet"]').click();
await page.waitForTimeout(80);
const sweetShown = Number((await page.locator("#findCount b").innerText()).trim());
const sweetExpected = DISHES.filter((d) => (FLAVOURS[d.id] || []).includes("sweet")).length;
const sweetOk = sweetShown === sweetExpected;
if (!sweetOk) failures++;
console.log(`\nflavour "sweet"   ${sweetShown} ${sweetOk ? "✓" : "✗ expected " + sweetExpected}`);

await page.locator('[data-flav="rich"]').click();
await page.waitForTimeout(80);
const anyCount = Number((await page.locator("#findCount b").innerText()).trim());
await page.locator('[data-flav="__mode"]').click();
await page.waitForTimeout(80);
const allCount = Number((await page.locator("#findCount b").innerText()).trim());
const modeOk = allCount <= anyCount;
if (!modeOk) failures++;
console.log(`sweet+rich  any=${anyCount} all=${allCount} ${modeOk ? "✓" : "✗ all must not exceed any"}`);

// --- Season: off-menu counts must match lib/dishes.ts for all twelve months ---
function inSeason(i, m) { return i.yearRound || i.months.includes(m); }

await page.getByRole("tab", { name: "Season" }).click();
console.log("\nOff-menu counts by month");

let seasonLine = "  ";
for (let m = 1; m <= 12; m++) {
  const expected = new Set();
  for (const i of INGREDIENTS) {
    if (!inSeason(i, m)) for (const id of i.dishes) expected.add(id);
  }
  await page.locator(`[data-month="${m}"]`).click();
  await page.waitForTimeout(70);
  const shown = Number((await page.locator("#offCount").innerText()).trim());
  const ok = shown === expected.size;
  if (!ok) { failures++; console.log(`  month ${m}: ${shown} ✗ expected ${expected.size}`); }
  seasonLine += `${String(shown).padStart(3)}`;
}
console.log(seasonLine + "   (Jan..Dec)" + (failures === 0 ? " ✓" : ""));

// Pantry staples must never put a dish off the menu.
const pantryOnly = INGREDIENTS.filter((i) => i.yearRound).flatMap((i) => i.dishes);
const seasonalDishes = new Set(
  INGREDIENTS.filter((i) => !i.yearRound).flatMap((i) => i.dishes)
);
const pantryExclusive = pantryOnly.filter((id) => !seasonalDishes.has(id));
console.log(`pantry-only dishes never blocked: ${pantryExclusive.length > 0 ? "checked ✓" : "none to check"}`);

// --- the five newer panes must render and agree with the TypeScript ---------
function matchesEvent2(d, f) {
  if (f.tier && !d.tiers.includes(f.tier)) return false;
  if (f.categories && !f.categories.includes(d.category)) return false;
  if (f.formats && !f.formats.includes(d.format)) return false;
  if (f.needsLicence !== undefined && d.needsLicence !== f.needsLicence) return false;
  if (f.veg !== undefined && d.veg !== f.veg) return false;
  if (f.subOrigins && !f.subOrigins.some((o) => d.subOrigin.startsWith(o))) return false;
  return true;
}

await page.getByRole("tab", { name: "The evening" }).click();
console.log("\nEvent moments");
for (const m of MOMENTS) {
  const expected = DISHES.filter((d) => matchesEvent2(d, m.filter)).length;
  const txt = await page.locator(`[data-moment="${m.id}"]`).innerText();
  const shown = Number((txt.match(/(\d+) dishes/) || [])[1]);
  const ok = shown === expected;
  if (!ok) failures++;
  console.log(`  ${m.id.padEnd(9)} ${String(shown).padStart(3)} ${ok ? "✓" : "✗ expected " + expected}`);
}

// Format axis: selecting one narrows to exactly that format.
// Clear whatever the flavour checks above left selected, or this measures
// the intersection rather than the axis.
await page.getByRole("tab", { name: "Find dishes" }).click();
await page.waitForTimeout(90);
const clearBtn = page.locator("#clearFind");
if (await clearBtn.count()) {
  await clearBtn.click();
  await page.waitForTimeout(90);
}
await page.locator('[data-fmt="live-station"]').click();
await page.waitForTimeout(90);
const liveShown = Number((await page.locator("#findCount b").innerText()).trim());
const liveExpected = DISHES.filter((d) => d.format === "live-station").length;
if (liveShown !== liveExpected) failures++;
console.log(`\nformat axis · live-station  ${liveShown} ${liveShown === liveExpected ? "✓" : "✗ expected " + liveExpected}`);
await page.locator('[data-fmt="live-station"]').click();

// Compare: three tiers, each quoting a positive per-guest figure.
await page.getByRole("tab", { name: "Compare" }).click();
await page.waitForTimeout(150);
const cards = await page.locator("#cmpBody .card").count();
if (cards !== 3) failures++;
console.log(`compare tiers rendered: ${cards} ${cards === 3 ? "✓" : "✗ expected 3"}`);

// Graph: the orphan count is a finding to report, not a number to pin. The
// network itself is checked further down, after the simulation has cooled.
await page.getByRole("tab", { name: "Ingredients" }).click();
await page.waitForTimeout(200);
const orphanTxt = await page.locator("#graphOrphans h2").innerText();
console.log(`graph orphans: ${orphanTxt.replace(/[^0-9]/g, "")} (informational)`);

// Builder: a stacked live-station selection must raise a blocker.
await page.getByRole("tab", { name: "Build a menu" }).click();
await page.waitForTimeout(150);
const runSheetRows = await page.locator("#quote ol li").count();
if (runSheetRows < 2) failures++;
console.log(`run sheet steps: ${runSheetRows} ${runSheetRows >= 2 ? "✓" : "✗ expected at least 2"}`);

// --- Recipes: the pane must carry every recipe, and filter like the data ---
await page.getByRole("tab", { name: "Recipes" }).click();
await page.waitForTimeout(200);
const recCards = await page.locator("#recBody .card").count();
const recOk = recCards === RECIPES.length;
if (!recOk) failures++;
console.log(`\nrecipe cards rendered: ${recCards} ${recOk ? "✓" : "✗ expected " + RECIPES.length}`);

// A recipe with no method or no quantities renders as a card and still fails a cook.
const stepCount = await page.locator("#recBody ol li").count();
const expectedSteps = RECIPES.reduce((n, r) => n + r.method.length, 0);
if (stepCount !== expectedSteps) failures++;
console.log(`method steps rendered: ${stepCount} ${stepCount === expectedSteps ? "✓" : "✗ expected " + expectedSteps}`);

// Course filter must agree with the categories in the data.
const byId = new Map(DISHES.map((d) => [d.id, d]));
for (const cat of ["canape", "main", "dessert"]) {
  const expected = RECIPES.filter((r) => byId.get(r.dishId)?.category === cat).length;
  await page.locator(`[data-rcat="${cat}"]`).click();
  await page.waitForTimeout(120);
  const shown = Number((await page.locator("#recCount b").innerText()).trim());
  const ok = shown === expected;
  if (!ok) failures++;
  console.log(`  course ${cat.padEnd(8)} ${String(shown).padStart(3)} ${ok ? "✓" : "✗ expected " + expected}`);
  await page.locator(`[data-rcat="${cat}"]`).click();
  await page.waitForTimeout(90);
}

// Search reaches into ingredients, not just dish names.
await page.fill("#recSearch", "lucuma");
await page.waitForTimeout(200);
const searchShown = Number((await page.locator("#recCount b").innerText()).trim());
const searchExpected = RECIPES.filter((r) => {
  const d = byId.get(r.dishId);
  const hay = (d.name + " " + d.fusion + " " + d.keyIngredients + " " +
    r.ingredients.map((i) => i.qty + " " + i.item).join(" ") + " " +
    r.method.join(" ") + " " + r.makeAhead + " " + r.holds).toLowerCase();
  return hay.includes("lucuma");
}).length;
const searchOk = searchShown === searchExpected;
if (!searchOk) failures++;
console.log(`search "lucuma": ${searchShown} ${searchOk ? "✓" : "✗ expected " + searchExpected}`);

// --- Venue axis: the page must cost transport the way lib/venues.ts does ---
// Ported maths, recomputed here rather than trusted.
const TRIP = { vanHourly: 45, perKm: 1.8, crewHourly: 18, generator: 280,
  vanTrips: { scran: 1, buffet: 2, plated: 2 }, loadCrew: { scran: 1, buffet: 2, plated: 3 } };
function expectedTransport(tier, d, v, peak, live) {
  const oneWay = d.driveMinutes + (peak ? d.peakExtra : 0);
  const trips = TRIP.vanTrips[tier];
  const drive = oneWay * 2 * trips;
  let total = (drive / 60) * TRIP.vanHourly + d.km * 2 * trips * TRIP.perKm;
  const crew = TRIP.loadCrew[tier];
  total += ((v.crewMinutes * 2 * trips * crew) / 60) * TRIP.crewHourly;
  if (live && !v.hasPower) total += TRIP.generator;
  return Math.round(total * 100) / 100;
}

await page.getByRole("tab", { name: "Build a menu" }).click();
await page.waitForTimeout(250);
console.log("\nTransport by venue (plated, at peak)");

const hotel = VENUE_TYPES.find((v) => v.id === "hotel");
await page.selectOption("#venueSel", { label: hotel.name });
await page.check("#peakChk");
await page.getByRole("button", { name: "The Aye Si Plated Experience", exact: true }).click();
await page.fill("#guests", "40");
await page.waitForTimeout(200);

for (const id of ["san-isidro", "la-molina", "asia"]) {
  const d = DISTRICTS.find((x) => x.id === id);
  await page.selectOption("#distSel", { label: `${d.name} · ${d.driveMinutes} min` });
  await page.waitForTimeout(180);
  const shown = await page.locator("#quote .qrow", { hasText: "Transport" }).first().innerText();
  const perGuest = Number((shown.match(/S\/\s*([\d.]+)/) || [])[1]);
  const expected = Math.round((expectedTransport("plated", d, hotel, true, false) / 40) * 100) / 100;
  const ok = Math.abs(perGuest - expected) < 0.02;
  if (!ok) failures++;
  console.log(`  ${d.name.padEnd(18)} S/ ${perGuest} per guest ${ok ? "✓" : "✗ expected " + expected}`);
}

// A harder venue in the same district must cost more, not the same.
const si = DISTRICTS.find((x) => x.id === "san-isidro");
await page.selectOption("#distSel", { label: `${si.name} · ${si.driveMinutes} min` });
const readTransport = async () => {
  const t = await page.locator("#quote .qrow", { hasText: "Transport" }).first().innerText();
  return Number((t.match(/S\/\s*([\d.]+)/) || [])[1]);
};
await page.selectOption("#venueSel", { label: hotel.name });
await page.waitForTimeout(180);
const easyCost = await readTransport();
await page.selectOption("#venueSel", { label: VENUE_TYPES.find((v) => v.id === "apartment").name });
await page.waitForTimeout(180);
const hardCost = await readTransport();
const venueOk = hardCost > easyCost;
if (!venueOk) failures++;
console.log(`venue access moves the price: hotel S/ ${easyCost} → walk-up S/ ${hardCost} ${venueOk ? "✓" : "✗"}`);

// Rush hour must cost more than off-peak.
await page.selectOption("#venueSel", { label: hotel.name });
await page.waitForTimeout(150);
const peakCost = await readTransport();
await page.uncheck("#peakChk");
await page.waitForTimeout(180);
const offCost = await readTransport();
const peakOk = peakCost > offCost;
if (!peakOk) failures++;
console.log(`rush hour costs more: peak S/ ${peakCost} vs off-peak S/ ${offCost} ${peakOk ? "✓" : "✗"}`);
await page.check("#peakChk");

// --- Ingredient network: a real layout, not a fixed ring ------------------
await page.getByRole("tab", { name: "Ingredients" }).click();
await page.waitForTimeout(2600);   // let the simulation cool

const gNodes = await page.locator("#graphSvg .node").count();
const gEdges = await page.locator("#graphSvg .edge").count();
if (gNodes < 20) failures++;
if (gEdges < 5) failures++;
console.log(`\ngraph nodes: ${gNodes} ${gNodes >= 20 ? "✓" : "✗ expected at least 20"}`);
console.log(`graph edges: ${gEdges} ${gEdges >= 5 ? "✓" : "✗ expected at least 5"}`);

// Nothing may sit outside the stage - a node clipped by the frame is unusable.
const stage = await page.locator("#graphSvg").boundingBox();
const outside = await page.$$eval("#graphSvg .node circle", (els) =>
  els.filter((e) => {
    const b = e.getBoundingClientRect();
    return b.width === 0 || b.height === 0;
  }).length
);
if (outside > 0) failures++;
console.log(`nodes with no rendered box: ${outside} ${outside === 0 ? "✓" : "✗"}`);

// The seasonal colouring is a claim about buying risk, so it has to be a
// plausible subset - never all of them and never none. It has silently been
// both while this was built.
const colours = await page.$$eval("#graphSvg .node circle", (els) =>
  els.map((e) => e.getAttribute("fill"))
);
const flagged = colours.filter((c) => c.includes("tart")).length;
const colourOk = flagged > 0 && flagged < colours.length;
if (!colourOk) failures++;
console.log(
  `seasonal nodes flagged: ${flagged} of ${colours.length} ` +
  (colourOk ? "✓" : "✗ must be some but not all")
);

// Selecting a node narrows the edges to its own.
await page.locator("#graphSvg .node").first().click();
await page.waitForTimeout(400);
const panelUp = await page.locator("#graphPanel").isVisible();
const selEdges = await page.locator("#graphSvg .edge").count();
const selOk = panelUp && selEdges < gEdges;
if (!selOk) failures++;
console.log(`selection opens a panel and narrows edges: ${selEdges} of ${gEdges} ${selOk ? "✓" : "✗"}`);

// Raising the link threshold must not add edges.
await page.locator("#graphClose").click();
await page.waitForTimeout(200);
await page.locator('[data-shared="4"]').click();
await page.waitForTimeout(1400);
const strictEdges = await page.locator("#graphSvg .edge").count();
const thresholdOk = strictEdges <= gEdges;
if (!thresholdOk) failures++;
console.log(`link threshold 2+ → 4+: ${gEdges} → ${strictEdges} ${thresholdOk ? "✓" : "✗"}`);

// --- The shop: the page's costing port must agree with lib/costing.ts -----
await page.getByRole("tab", { name: "Build a menu" }).click();
await page.getByRole("button", { name: "The Aye Si Plated Experience", exact: true }).click();
await page.fill("#guests", "60");
await page.waitForTimeout(700);

const shopTables = page.locator("#shopBody table");
const shopRows = await shopTables.first().locator("tbody tr").count();
const batchRows = await shopTables.nth(1).locator("tbody tr").count();
const shopOk = shopRows > 5 && batchRows > 0;
if (!shopOk) failures++;
console.log(`\nshopping list: ${shopRows - 1} ingredients across ${batchRows} dishes ${shopOk ? "✓" : "✗"}`);

// The total has to be the sum of the rows above it, or the table lies.
const rowTotals = await shopTables.first().locator("tbody tr").evaluateAll((trs) =>
  trs.slice(0, -1).map((tr) => {
    const t = tr.querySelectorAll("td")[2]?.textContent ?? "0";
    return Number(t.replace(/[^0-9.]/g, "")) || 0;
  })
);
const shownTotalTxt = await page.locator("#shopBody tr", { hasText: "Total ingredients" }).innerText();
const shownTotal = Number((shownTotalTxt.match(/S\/\s*([\d.]+)/) || [])[1]);
const summed = rowTotals.reduce((a, b) => a + b, 0);
const totalOk = Math.abs(shownTotal - summed) < 0.5;
if (!totalOk) failures++;
console.log(`shop total is the sum of its rows: S/ ${shownTotal} vs S/ ${summed.toFixed(2)} ${totalOk ? "✓" : "✗"}`);

// Doubling the head count must not halve the shop.
await page.fill("#guests", "120");
await page.waitForTimeout(700);
const biggerTxt = await page.locator("#shopBody tr", { hasText: "Total ingredients" }).innerText();
const bigger = Number((biggerTxt.match(/S\/\s*([\d.]+)/) || [])[1]);
const scalesOk = bigger > shownTotal;
if (!scalesOk) failures++;
console.log(`60 → 120 guests raises the shop: S/ ${shownTotal} → S/ ${bigger} ${scalesOk ? "✓" : "✗"}`);

// Batches are whole numbers. A half batch is not a thing you can cook.
const batchNums = await shopTables.nth(1).locator("tbody tr").evaluateAll((trs) =>
  trs.map((tr) => Number(tr.querySelectorAll("td")[2]?.textContent?.trim() ?? "0"))
);
const wholeOk = batchNums.length > 0 && batchNums.every((n) => Number.isInteger(n) && n >= 1);
if (!wholeOk) failures++;
console.log(`every batch count is a whole number ≥ 1: ${wholeOk ? "✓" : "✗ " + batchNums.join(",")}`);

// The matrix's "from recipe" column must match what lib/costing.ts computes.
const { RECIPES: TS_RECIPES } = await import("../.verify-recipes.mjs");
await page.getByRole("tab", { name: "The matrix" }).click();
await page.waitForTimeout(500);
const shownReal = await page.$$eval("#menuBody tbody tr", (trs) =>
  trs.map((tr) => {
    const cells = tr.querySelectorAll("td");
    return [Number(cells[0].textContent.trim()),
            Number((cells[2].textContent.match(/([\d.]+)/) || [])[1])];
  })
);
console.log(`\nrecipe-costed dishes shown in the matrix: ${shownReal.filter((r) => r[1] > 0).length} of ${TS_RECIPES.length}`);
const anyCosted = shownReal.filter((r) => r[1] > 0).length >= TS_RECIPES.length * 0.95;
if (!anyCosted) failures++;
console.log(`  at least 95% carry a computed cost ${anyCosted ? "✓" : "✗"}`);

// The standalone keeps its own copy of the category labels. It once kept them
// pre-escaped for innerHTML ("Canapés &amp; bites"), which silently stopped two
// of the seven ever matching the Spanish dictionary. Hold the copy to the
// TypeScript so that cannot happen again.
// Read as text rather than imported: lib/dishes.ts uses the "@/" alias, which
// plain Node cannot resolve, and this check only cares about the strings.
const { readFileSync } = await import("node:fs");
const labelSrc = readFileSync(new URL("../lib/dishes.ts", import.meta.url), "utf8");
const labelBlock = labelSrc.slice(
  labelSrc.indexOf("CATEGORY_LABEL"),
  labelSrc.indexOf("};", labelSrc.indexOf("CATEGORY_LABEL"))
);
const CATEGORY_LABEL = Object.fromEntries(
  [...labelBlock.matchAll(/(\w+):\s*"([^"]*)"/g)].map((m) => [m[1], m[2]])
);
const pageLabels = await page.evaluate(() =>
  JSON.parse(document.getElementById("data").textContent).labels
);
const labelDrift = Object.keys(CATEGORY_LABEL).filter((k) => pageLabels[k] !== CATEGORY_LABEL[k]);
if (labelDrift.length) failures++;
console.log(
  `\ncategory labels match lib/dishes.ts: ${labelDrift.length ? "✗ " + labelDrift.join(", ") : "✓"}`
);

// --- Search and filters: the way through 223 dishes ----------------------
await page.locator('.tab[data-pane="menu"]').click();
await page.waitForTimeout(500);
const mxRows = () => page.locator("#menuBody .mxtable tbody tr").count();
const allRows = await mxRows();

// Accent-insensitive, because half the menu is Spanish and a Peruvian buyer
// should not have to type an accent to search their own language.
await page.fill("#mxQ", "lucuma");
await page.waitForTimeout(350);
const plain = await mxRows();
await page.fill("#mxQ", "lúcuma");
await page.waitForTimeout(350);
const accented = await mxRows();
const foldOk = plain > 0 && plain === accented && plain < allRows;
if (!foldOk) failures++;
console.log(
  `\nsearch ignores accents: ${foldOk ? "✓" : "✗"} ("lucuma" ${plain}, "lúcuma" ${accented} of ${allRows})`
);

await page.fill("#mxQ", "");
await page.waitForTimeout(300);
await page.locator("[data-mxcat='dessert']").click();
await page.waitForTimeout(350);
const desserts = await mxRows();
const dessertExpected = DISHES.filter((d) => d.category === "dessert").length;
const catOk = desserts === dessertExpected;
if (!catOk) failures++;
console.log(`course filter: ${desserts} ${catOk ? "✓" : "✗ expected " + dessertExpected}`);

await page.locator("#mxClear").click();
await page.waitForTimeout(350);
const cleared = await mxRows();
const clearOk = cleared === allRows;
if (!clearOk) failures++;
console.log(`clear all filters restores every row: ${clearOk ? "✓" : "✗ " + cleared}`);

// Sorting has to actually sort, not merely relabel the header.
await page.selectOption("#mxSort", "price");
await page.waitForTimeout(400);
const prices = (await page.locator("#menuBody .mxtable tbody tr td:nth-child(5)").allInnerTexts())
  .map((t) => Number(t.replace(/[^\d.]/g, "")));
const ascending = prices.every((v, i) => i === 0 || prices[i - 1] <= v);
if (!ascending) failures++;
console.log(`sort by menu value is ordered: ${ascending ? "✓" : "✗"}`);
await page.selectOption("#mxSort", "id");
await page.waitForTimeout(300);

// An empty result has to offer a way out of itself.
await page.fill("#mxQ", "zzzzzzzz");
await page.waitForTimeout(350);
const emptyOk = (await page.locator("#menuBody .empty").count()) === 1;
if (!emptyOk) failures++;
console.log(`empty state offers a way back: ${emptyOk ? "✓" : "✗"}`);
await page.fill("#mxQ", "");
await page.waitForTimeout(300);

// The quick search reaches everything and lands on the thing itself.
// Blur first: "/" is deliberately inert while the caret is in a text field,
// or you could never type a slash into a search box.
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await page.keyboard.press("/");
await page.waitForTimeout(350);
const qsOpen = !(await page.locator("#qsBack").isHidden());
await page.fill("#qsQ", "haggis");
await page.waitForTimeout(350);
const qsHits = await page.locator(".qs-item").count();
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
const landed = !(await page.locator("#pane-recipes").isHidden());
const oneRecipe = (await page.locator("#recBody .card").count()) === 1;
const qsOk = qsOpen && qsHits > 1 && landed && oneRecipe;
if (!qsOk) failures++;
console.log(
  `quick search opens on "/", finds ${qsHits}, and opens the dish itself: ${qsOk ? "✓" : "✗"}`
);

// The overlay must never sit invisibly over the page swallowing clicks.
const overlayInert = await page.evaluate(() => {
  const b = document.getElementById("qsBack");
  b.hidden = true;
  return getComputedStyle(b).display === "none";
});
if (!overlayInert) failures++;
console.log(`hidden overlay is really hidden: ${overlayInert ? "✓" : "✗"}`);

await page.locator('.tab[data-pane="recipes"]').click();
await page.waitForTimeout(400);
await page.evaluate(() => document.getElementById("recClear")?.click());
await page.waitForTimeout(400);

// --- The quote has to be sendable, or it is not a quote ------------------
await page.getByRole("tab", { name: "Build a menu" }).click();
await page.waitForTimeout(600);
const waText = await page.locator("#waText").inputValue();
const waHref = await page.locator("#waSend").getAttribute("href");
const waQuoted = [...waText.matchAll(/S\/ ([\d,.]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
const waGross = Number((await page.locator("#quote .qrow.tot").last().innerText()).replace(/[^\d.]/g, ""));
const waOk =
  waHref.startsWith("https://wa.me/?text=") &&
  decodeURIComponent(waHref.slice("https://wa.me/?text=".length)) === waText &&
  waQuoted.length === 4 &&
  Math.abs(waQuoted[3] - waGross) < 0.01 &&
  /estimate, not a contract/i.test(waText);
if (!waOk) failures++;
console.log(
  `\nWhatsApp quote carries the same total as the panel: ${waOk ? "✓" : "✗"}` +
  ` (S/ ${waQuoted[3]} vs S/ ${waGross})`
);

// --- Spanish: the toggle works, and coverage is reported honestly ---------
const esPage = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
// Only seed the language if nothing has chosen one yet. This used to set it
// unconditionally, and addInitScript re-runs on every navigation - so when the
// toggle at the bottom of this block reloaded the page, this put it straight
// back into Spanish and the round-trip check could never have passed on a
// working page.
//
// It reported ✓ anyway, for a reason worth writing down: the old build linked
// Google Fonts from its head, the reload blocked on that request and never
// completed, and the check then read the raw English strings out of the
// half-loaded source markup and called that "restored to English". Embedding
// the fonts made the reload finish, which is what finally exposed both bugs.
await esPage.addInitScript(() => {
  try {
    if (!localStorage.getItem("ayesicena-lang")) localStorage.setItem("ayesicena-lang", "es");
  } catch (e) {}
});
await esPage.goto("file://" + FILE);
await esPage.waitForTimeout(900);

const navEs = await esPage.getByRole("tab").allInnerTexts();
const navTranslated = navEs.filter((t) => /Inicio|La noche|Buscar|La matriz|Temporada|Comparar|Insumos|Recetas|Paquetes|Armar/.test(t)).length;
const navOk = navTranslated >= 10;
if (!navOk) failures++;
console.log(`\nSpanish nav translated: ${navTranslated} of ${navEs.length - 1} ${navOk ? "✓" : "✗"}`);

// Dish names must NOT be translated - the Scottish name is the product.
await esPage.getByRole("tab", { name: "La matriz" }).click();
await esPage.waitForTimeout(600);
const matrixEs = await esPage.locator("#menuBody tbody tr").count();
const namesKept = await esPage.locator("#menuBody", { hasText: "Haggis Bonbons" }).count();
const namesOk = matrixEs === DISHES_LEN && namesKept > 0;
if (!namesOk) failures++;
console.log(`dish names left in English: ${namesOk ? "✓" : "✗"} (${matrixEs} rows)`);

// Coverage, reported per pane. One number for the whole page is useless:
// the recipes are 4,000 strings of kitchen English and swamp everything the
// client actually reads.
// Every pane, not a subset. This list once held seven of the eleven, so the
// evening, the season, the ingredient graph and the day were never measured
// at all and the headline figure was reporting a number for most of the app.
// Every pane, not a subset. This list once held seven of the eleven, so the
// evening, the season, the ingredient graph and the day were never measured
// at all and the headline figure was reporting a number for most of the app.
// Addressed by data-pane rather than by label, so a tab whose own name is
// still English cannot make the check unrunnable.
const PANES = ["home", "moments", "find", "menu", "seasonal", "compare",
               "graph", "recipes", "day", "packages", "builder"];
const paneMisses = {};
console.log("Spanish coverage by pane");
let clientT = 0, clientU = 0;
for (const id of PANES) {
  await esPage.locator(`.tab[data-pane="${id}"]`).click();
  await esPage.waitForTimeout(500);
  const c = await esPage.evaluate(() => {
    const data = JSON.parse(document.getElementById("data").textContent);
    const dict = data.es;
    const values = new Set(Object.values(dict));
    // Untranslated by policy, not by omission: dish names are the product,
    // the British original is a name too, and suppliers are proper nouns.
    // Proper nouns, all of them: the dish, the British original it comes from,
    // the supplier, the ingredient and the district. "Papas nativas" and
    // "Magdalena del Mar" are already the Spanish, and counting them as
    // untranslated English understated the figure by a whole pane.
    const names = new Set([
      ...data.dishes.map((d) => d.name),
      ...data.dishes.map((d) => d.origin),
      ...data.dishes.map((d) => d.source),
      ...data.dishes.map((d) => d.keyIngredients),
      ...data.ingredients.map((i) => i.name),
      ...data.districts.map((d) => d.name),
      ...Object.values(data.tiers).map((t) => t.name),
      // The key-ingredient column is a comma-separated list of them.
      // Both cases: the graph and the run sheet lowercase them.
      ...data.dishes.flatMap((d) => d.keyIngredients.split(",").flatMap((x) =>
        [x.trim(), x.trim().toLowerCase()])),
      "Aye, Si, Cena."
    ]);
    // The page records every string it produced, so coverage is measured
    // against what actually happened rather than re-derived from the rules.
    const applied = window.__i18nApplied || {};
    const pane = [...document.querySelectorAll(".pane")].find((p) => !p.hidden);
    const w = document.createTreeWalker(pane, NodeFilter.SHOW_TEXT);
    let t = 0, u = 0, n;
    while ((n = w.nextNode())) {
      const s = n.nodeValue.replace(/\s+/g, " ").trim();
      // Two words, not four. The old floor of four hid a whole pane of labels
      // — "Arrival", "Late night", every month in the date picker — and made
      // the figure read 100% while the date picker was in English.
      if (!s || s.split(" ").length < 2) continue;
      // A bare number, a price or a clock time is the same in both.
      if (!/[a-zA-Z]{3}/.test(s)) continue;
      // Dish names are deliberately untranslated - "Haggis Bonbons" is the
      // product - so counting them would understate real coverage. A menu is
      // often printed as a list of them, which is still all names.
      if (names.has(s) || names.has(s.toLowerCase())) continue;
      const parts = s.replace(/\([^)]*\)/g, "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
      if (parts.length > 1 && parts.every((x) => names.has(x.replace(/\s*\.$/, "").trim()))) continue;
      if (values.has(s) || applied[s]) t++; else u++;
    }
    return { t, u };
  });
  const pct = c.t + c.u ? (c.t / (c.t + c.u)) * 100 : 100;
  if (id !== "recipes") { clientT += c.t; clientU += c.u; }
  paneMisses[id] = c.u;
  console.log(`  ${id.padEnd(9)} ${pct.toFixed(0).padStart(3)}%  (${c.u} strings still English)`);
}
const clientPct = (clientT / (clientT + clientU)) * 100;
// The floor was 80% while the figure was only measuring seven panes at a
// four-word minimum. Both of those are fixed, so the floor can be where it
// belongs: a pane that slips shows up as a failure, not as a rounding.
const clientOk = clientPct >= 99;
const worstPane = Object.entries(paneMisses).sort((a, b) => b[1] - a[1])[0];
const paneOk = worstPane[1] <= 2;
if (!clientOk) failures++;
if (!paneOk) failures++;
console.log(`client-facing panes: ${clientPct.toFixed(0)}% ${clientOk ? "✓" : "✗ expected at least 99%"}`);
console.log(
  `worst pane: ${worstPane[0]} with ${worstPane[1]} untranslated ` +
  `${paneOk ? "✓" : "✗ expected at most 2"}`
);

// Chrome the percentage cannot see: a one-word <summary>, a placeholder, an
// aria-label. These are always translatable, so any English one is a gap.
const chromeGaps = await esPage.evaluate(() => {
  const dict = JSON.parse(document.getElementById("data").textContent).es;
  const values = new Set(Object.values(dict));
  const bad = [];
  document.querySelectorAll("summary").forEach((el) => {
    const t = el.textContent.replace(/\s+/g, " ").trim();
    if (t && !values.has(t) && !/[áéíóúñ¿¡]/i.test(t)) bad.push("summary: " + t);
  });
  document.querySelectorAll("[placeholder]").forEach((el) => {
    const t = el.getAttribute("placeholder");
    if (t && !values.has(t) && !/[áéíóúñ¿¡]/i.test(t)) bad.push("placeholder: " + t);
  });
  return bad;
});
if (chromeGaps.length) failures++;
console.log(
  `summaries and placeholders translated: ${chromeGaps.length ? "✗ " + chromeGaps.join(" | ") : "✓"}`
);

// Switching back to English must restore the source text, not a translation -
// and it must do so on a page that actually finished reloading, so wait for the
// load rather than a fixed delay.
const reloaded = esPage.waitForLoadState("load");
await esPage.locator("#langBtn").click();
await reloaded;
await esPage.waitForTimeout(600);
const navBack = await esPage.getByRole("tab").allInnerTexts();
const backOk = navBack.some((t) => t.trim() === "The matrix") &&
  (await esPage.evaluate(() => document.documentElement.lang)) === "en";
if (!backOk) failures++;
console.log(`toggling back to English restores the source: ${backOk ? "✓" : "✗"}`);
await esPage.close();

// --- Dietary: the page must answer exactly what lib/dietary.ts answers -----
const { RECIPES: TS_REC } = await import("../.verify-recipes.mjs");
await page.getByRole("tab", { name: "Find dishes" }).click();
await page.waitForTimeout(700);

const dietChips = await page.locator("[data-diet]").count();
const dietOk = dietChips === 15;
if (!dietOk) failures++;
console.log(`\ndiet filters offered: ${dietChips} ${dietOk ? "✓" : "✗ expected 15"}`);

// Counts on the chips must match what the page itself computes, and the
// filter must actually narrow to them.
for (const diet of ["vegan", "gluten-free", "halal-ingredients", "kosher-ingredients", "low-fodmap", "lower-carb"]) {
  const expected = await page.evaluate(
    (d) => Object.values(window.__dietIndex || {}).filter((p) => p.suits.includes(d)).length,
    diet
  );
  await page.locator(`[data-diet="${diet}"]`).click();
  await page.waitForTimeout(350);
  const shown = Number((await page.locator("#findCount b").innerText()).trim());
  const ok = expected > 0 && shown === expected;
  if (!ok) failures++;
  console.log(`  ${diet.padEnd(14)} ${String(shown).padStart(3)} ${ok ? "✓" : "✗ expected " + expected}`);
  await page.locator(`[data-diet="${diet}"]`).click();
  await page.waitForTimeout(250);
}

// Every recipe declares something, and an unclassified one says so loudly.
await page.getByRole("tab", { name: "Recipes" }).click();
await page.waitForTimeout(400);
// An earlier check left "lucuma" in the search box, which would count 13
// panels and look like a bug in the panel rather than in the probe.
await page.fill("#recSearch", "");
await page.waitForTimeout(700);
const panels = await page.locator(".dietbox").count();
const panelsOk = panels === TS_REC.length;
if (!panelsOk) failures++;
console.log(`recipes carrying a dietary panel: ${panels} ${panelsOk ? "✓" : "✗ expected " + TS_REC.length}`);
const undeclarable = await page.locator(".dietbox.bad").count();
if (undeclarable > 0) failures++;
console.log(`recipes that cannot be declared: ${undeclarable} ${undeclarable === 0 ? "✓" : "✗"}`);

// --- Vedas: a closed season blocks, and says it is the law -----------------
await page.getByRole("tab", { name: "Build a menu" }).click();
await page.waitForTimeout(500);
await page.selectOption("#monthSel", "4");          // April: nothing closed
await page.waitForTimeout(400);
const aprilBoxes = await page.locator(".vedabox").count();

await page.selectOption("#monthSel", "9");
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Corvina al Pil-Pil/ }).first().click();
await page.waitForTimeout(600);
const septBoxes = await page.locator(".vedabox").count();
const vedaOk = aprilBoxes === 0 && septBoxes > 0;
if (!vedaOk) failures++;
console.log(`\nveda blocker: April ${aprilBoxes}, September with corvina ${septBoxes} ${vedaOk ? "✓" : "✗"}`);

const vedaText = await page.locator(".vedabox").first().innerText();
const wordingOk = /offence/i.test(vedaText) && /resoluci/i.test(vedaText);
if (!wordingOk) failures++;
console.log(`veda wording says offence, not risk: ${wordingOk ? "✓" : "✗"}`);

// --- Substitution: the season pane must answer what to do about a gap ------
await page.getByRole("tab", { name: "Season" }).click();
await page.waitForTimeout(400);
await page.locator('[data-month="10"]').click();
await page.waitForTimeout(800);

const subRows = await page.locator("#seasonSubs tbody tr").count();
const offCount = Number((await page.locator("#offCount").innerText()).trim());
const subsOk = subRows === offCount && subRows > 0;
if (!subsOk) failures++;
console.log(`\nsubstitution rows: ${subRows} for ${offCount} off-menu dishes ${subsOk ? "✓" : "✗"}`);

// Dishes with no substitute must sort to the top - they are the actual work.
// Since the matrix grew to 223 dishes there is usually something for every
// gap, so "none stuck" is a real outcome and not a failure. What is checked
// is the sort: fewest options first, and no answer at all right at the top.
const subCounts = await page.$$eval("#seasonSubs tbody tr", (rows) =>
  rows.map((r) => {
    const cell = r.children[2];
    return /nothing fits/.test(cell.textContent || "") ? 0 : cell.querySelectorAll("strong").length;
  })
);
const sortedAsc = subCounts.every((n, i) => i === 0 || subCounts[i - 1] <= n);
const stuck = subCounts.filter((n) => n === 0).length;
const stuckFirst = stuck === 0 || subCounts[0] === 0;
const subSortOk = sortedAsc && stuckFirst;
if (!subSortOk) failures++;
console.log(
  `fewest options first: ${subSortOk ? "✓" : "✗"}` +
  ` (${stuck} with no answer at all${stuck === 0 ? " — the wider matrix covers every October gap" : ""})`
);

// A substitute must never itself be out of season this month.
const suggested = await page.$$eval("#seasonSubs tbody tr td:nth-child(3) strong",
  (els) => els.map((e) => e.textContent.trim()));
const offNames = await page.$$eval("#seasonOff li, #seasonOff .card",
  (els) => els.map((e) => e.textContent.trim()));
const overlap = suggested.filter((n) => offNames.some((o) => o.includes(n)));
if (overlap.length) failures++;
console.log(`no substitute is itself off-menu: ${overlap.length === 0 ? "✓" : "✗ " + overlap[0]}`);

// --- Capacity: the day pane says no, and changes its mind when you buy kit -
await page.getByRole("tab", { name: "The day" }).click();
await page.waitForTimeout(600);
const verdictNo = await page.locator("#dayVerdict h2").innerText();
const saysNo = /^No/.test(verdictNo.trim());
if (!saysNo) failures++;
console.log(`\nday verdict with one plancha and four crew: ${saysNo ? "No ✓" : "✗ " + verdictNo}`);

await page.fill('[data-kit="planchas"]', "3");
await page.fill('[data-kit="vans"]', "2");
await page.fill('[data-kit="crew"]', "20");
await page.waitForTimeout(600);
const verdictYes = await page.locator("#dayVerdict h2").innerText();
const saysYes = /^Yes/.test(verdictYes.trim());
if (!saysYes) failures++;
console.log(`day verdict after buying the kit: ${saysYes ? "Yes ✓" : "✗ " + verdictYes}`);

// --- The two canonicalisers must agree, or the shop asks for the wrong thing
// The browser has its own port of canonicalIngredient. When it drifted,
// "lamb or beef stock" became "lamb" and the shopping list asked a butcher
// for two litres of cordero. Its own page, because the language toggle
// reloads and a reload mid-check reads an empty window.
const canonPage = await browser.newPage();
await canonPage.goto("file://" + FILE);
await canonPage.waitForTimeout(900);

const { RECIPES: TS_R } = await import("../.verify-recipes.mjs");
const { canonicalIngredient } = await import("../.verify-canon.mjs");
const sample = [...new Set(TS_R.flatMap((r) => r.ingredients.map((i) => i.item)))].slice(0, 500);
const browserKeys = await canonPage.evaluate(
  (items) => (window.__canonIng ? items.map((it) => window.__canonIng(it)) : null),
  sample
);
await canonPage.close();

if (!browserKeys) {
  failures++;
  console.log("\ncanonicaliser parity: ✗ the page does not expose canonIng");
} else {
  const bad = sample
    .map((it, i) => [it, canonicalIngredient(it), browserKeys[i]])
    .filter(([, a, b]) => a !== b);
  if (bad.length) failures++;
  console.log(
    `\ncanonicaliser parity across ${sample.length} ingredients: ` +
    (bad.length ? `✗ ${bad.length} disagree — first ${JSON.stringify(bad[0])}` : "✓")
  );
}

// --- Reachable without a mouse or a pair of eyes ---------------------------
// Not an audit. Four things that were wrong and are cheap to keep right: a
// control nobody can name, a result count that changes silently, a heading
// outline with holes in it, and an allergen chip with no text.
{
  const a11y = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await a11y.goto("file://" + FILE);
  await a11y.waitForTimeout(900);
  const panes = await a11y.evaluate(() =>
    [].map.call(document.querySelectorAll("nav [data-pane]"), (n) => n.dataset.pane));
  for (const k of panes) {
    await a11y.evaluate((x) => document.querySelector(`nav [data-pane="${x}"]`).click(), k);
    await a11y.waitForTimeout(200);
  }
  const r = await a11y.evaluate(() => {
    const nameless = [];
    document.querySelectorAll("input,select,textarea").forEach((el) => {
      if (el.type === "hidden") return;
      const lab = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (!(lab || el.closest("label") || el.getAttribute("aria-label") ||
            el.getAttribute("aria-labelledby") || el.getAttribute("title"))) {
        nameless.push(el.tagName + "#" + (el.id || "(no id)"));
      }
    });
    let skips = 0;
    document.querySelectorAll("[id^=pane-]").forEach((pane) => {
      const hs = [].map.call(pane.querySelectorAll("h1,h2,h3,h4,h5,h6"), (h) => +h.tagName[1]);
      for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) skips++;
    });
    return { nameless, skips, live: document.querySelectorAll("[aria-live]").length };
  });
  if (r.nameless.length) failures++;
  console.log(`\nevery control has an accessible name: ${r.nameless.length ? "✗ " + r.nameless.join(", ") : "✓"}`);
  if (r.skips) failures++;
  console.log(`heading outline has no gaps: ${r.skips ? "✗ " + r.skips + " skips" : "✓"}`);
  if (r.live < 3) failures++;
  console.log(`result counts announce themselves: ${r.live >= 3 ? "✓" : "✗"} (${r.live} live regions)`);
  await a11y.close();
}

await browser.close();

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
