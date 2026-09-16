/**
 * Emit a single self-contained HTML build of the app.
 *
 * The dish data is pulled from data/dishes.ts itself (types stripped, then
 * required) so the standalone page can never drift from the real source.
 * The quote maths is a hand-port of lib/pricing.ts; scripts/verify-standalone
 * checks the port against the same figures the jest suite asserts.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

/** See the client-build note beside OUT_DISHES below. */
const CLIENT_BUILD = process.argv.includes("--client");

// --- pull the real data out of the TypeScript sources ----------------------
/** Strip the type annotations off a data module and require it for its value. */
function loadData(file, exportName) {
  const src = fs.readFileSync(path.join(ROOT, "data", file), "utf8");
  // A data module may export more than one value (venues.ts exports two), and
  // any `export` left behind breaks the CJS require below - so convert them all.
  const js = src
    .replace(/^import type .*$/gm, "")
    // Both annotated (`export const X: T =`) and bare (`export const X =`)
    // declarations have to become CJS, or the require below trips on the one
    // it missed.
    .replace(/export const (\w+)\s*:[^=]+=/g, "module.exports.$1 =")
    .replace(/export const (\w+)\s*=/g, "module.exports.$1 =")
    .replace(/\bas const\b/g, "")
    // Type aliases have no runtime meaning and are not valid CJS.
    .replace(/^export type .*$/gm, "");
  const tmp = path.join(ROOT, `.${exportName}.tmp.cjs`);
  fs.writeFileSync(tmp, js);
  try {
    const mod = require(tmp);
    if (mod[exportName] === undefined) {
      throw new Error(`${file} did not export ${exportName} after type stripping`);
    }
    return mod[exportName];
  } finally {
    fs.unlinkSync(tmp);
  }
}

const DISHES = loadData("dishes.ts", "DISHES");
const FLAVOURS = loadData("flavours.ts", "FLAVOURS");
const EVENTS = loadData("events.ts", "EVENTS");
const INGREDIENTS = loadData("ingredients.ts", "INGREDIENTS");
const MOMENTS = loadData("moments.ts", "MOMENTS");
const RECIPES = loadData("recipes.ts", "RECIPES");
const ES = loadData("i18n.ts", "ES");
// The recipe lines live in their own file because there are 1,590 of them and
// they arrive in tranches. Merged here so one lookup serves both.
//
// Except in a client build. Stripping the recipe notes out of the data and then
// shipping their Spanish translations would leak the very thing that was
// removed - the dictionary keys ARE the English text, suppliers and all, and
// four of those notes name the stall. The client build has no recipe pane, so
// these translations have nothing to translate anyway.
const ES_RECIPES = loadData("i18n-recipes.ts", "ES_RECIPES");
if (!CLIENT_BUILD) Object.assign(ES, ES_RECIPES);
const ES_INGREDIENTS = loadData("i18n-ingredients.ts", "ES_INGREDIENTS");
const ES_PREP = loadData("i18n-prep.ts", "ES_PREP");
const INGREDIENT_ATTRS = loadData("ingredient-attributes.ts", "INGREDIENT_ATTRS");
const PLANT_PLAIN = loadData("ingredient-attributes.ts", "PLANT_PLAIN");
const HARD_TEXTURE_DISHES = loadData("ingredient-attributes.ts", "HARD_TEXTURE_DISHES");
const NOT_FOR_CHILDREN = loadData("ingredient-attributes.ts", "NOT_FOR_CHILDREN");
const HIGH_FODMAP = loadData("ingredient-attributes.ts", "HIGH_FODMAP");
const HIGH_CARB = loadData("ingredient-attributes.ts", "HIGH_CARB");
const VEDAS = loadData("vedas.ts", "VEDAS");
// The same list lib/dietary.ts and lib/conflicts.ts check against. The page
// used to hardcode a shorter one and so could not warn about six of the
// fourteen declarable allergens.
const ALLERGENS = loadData("allergens.ts", "ALLERGENS");
const ALLERGEN_LABEL = loadData("allergens.ts", "ALLERGEN_LABEL");
const ES_PATTERNS = loadData("i18n.ts", "ES_PATTERNS");
const PRICES = loadData("prices.ts", "PRICES");
const SUB_RECIPE_OF = loadData("prices.ts", "SUB_RECIPE_OF");
const SUB_PREP_PRICES = loadData("prices.ts", "SUB_PREP_PRICES");
const NON_FOOD_PRICES = loadData("prices.ts", "NON_FOOD_PRICES");
const COMPOUND_ALIAS = loadData("prices.ts", "COMPOUND_ALIAS");
const NON_FOOD = loadData("prices.ts", "NON_FOOD");
const DISTRICTS = loadData("venues.ts", "DISTRICTS");
const VENUE_TYPES = loadData("venues.ts", "VENUE_TYPES");

if (DISHES.length < 100) {
  throw new Error(`Expected the full matrix, extracted only ${DISHES.length}`);
}
const unflavoured = DISHES.filter((d) => !FLAVOURS[d.id]).map((d) => d.id);
if (unflavoured.length) {
  throw new Error(`Dishes missing a flavour entry: ${unflavoured.join(", ")}`);
}
const dishIds = new Set(DISHES.map((d) => d.id));
const ghostRecipes = RECIPES.filter((r) => !dishIds.has(r.dishId)).map((r) => r.dishId);
if (ghostRecipes.length) {
  throw new Error(`Recipes for dishes not in the matrix: ${ghostRecipes.join(", ")}`);
}
for (const ing of INGREDIENTS) {
  const ghosts = ing.dishes.filter((id) => !dishIds.has(id));
  if (ghosts.length) throw new Error(`${ing.id} references missing dishes: ${ghosts.join(", ")}`);
}

// --- tier rules, mirrored from lib/pricing.ts ------------------------------
// __tests__/standalone-tiers.test.ts fails if this and TIERS there drift apart.
const TIERS = {
  ninos: {
    id: "ninos", name: "Wee Feast", minGuests: 10, menajePerGuest: 0,
    packagingPerGuest: 5, guestsPerWaiter: 0, chefs: 0, transport: 60, bitesPerGuest: 6
  },
  scran: {
    id: "scran", name: "Scran Boxes", minGuests: 8, menajePerGuest: 0,
    packagingPerGuest: 7, guestsPerWaiter: 0, chefs: 0, transport: 60, bitesPerGuest: 8
  },
  buffet: {
    id: "buffet", name: "Two Shores Buffet", minGuests: 20, menajePerGuest: 18,
    packagingPerGuest: 2, guestsPerWaiter: 25, chefs: 1, transport: 220, bitesPerGuest: 6
  },
  plated: {
    id: "plated", name: "The Aye Si Plated Experience", minGuests: 20, menajePerGuest: 27.5,
    packagingPerGuest: 0, guestsPerWaiter: 12, chefs: 1, transport: 300, bitesPerGuest: 6
  },
  ceilidh: {
    id: "ceilidh", name: "The Ceilidh Table", minGuests: 12, menajePerGuest: 45,
    packagingPerGuest: 0, guestsPerWaiter: 8, chefs: 2, transport: 380, bitesPerGuest: 10
  }
};

const CONST = { IGV: 0.18, STAFF: 100, CHEF: 180, FC_MIN: 0.25, FC_MAX: 0.3 };

// Plain text, exactly as lib/dishes.ts has it. These were once written with
// "&amp;" baked in, ready for innerHTML — which meant the Spanish dictionary
// key never matched and two categories stayed English on every page.
// Escaping belongs at the render site, not in the data.
const CATEGORY_LABEL = {
  canape: "Canapés & bites",
  main: "Mains",
  bowl: "Bowls",
  side: "Sides & breads",
  breakfast: "Breakfast",
  bakery: "Bakery",
  dessert: "Desserts"
};
const CATEGORY_ORDER = ["canape","main","bowl","side","breakfast","bakery","dessert"];

const FLAVOUR_AXES = ["sweet","savoury","rich","tart","smoky","spiced","fresh"];

/**
 * The client build.
 *
 *   node scripts/build-standalone.mjs --client aye-si-cena-menu.html
 *
 * The ordinary file is a working tool and carries the whole business: 223
 * costs, 223 supplier names, every food-cost percentage and every recipe. It
 * is your commercial position in one file and it must never be sent to a
 * client. This is the version that can be.
 *
 * What comes out is stripped at the DATA level, not hidden in the CSS. A
 * hidden column is still in the document, one keystroke from view; there is no
 * point shipping a file to somebody and relying on them not to look. So:
 *
 *   cost, source, costVerified   removed from every dish
 *   the three price tables       emptied, so nothing can be recomputed
 *   recipe method and quantities removed - the ingredient NAMES stay, because
 *                                that is what the allergen engine reads and a
 *                                client is owed the allergens
 *   panes                        menu, the evening, find, packages, home
 *
 * The dietary engine therefore works untouched: a guest can still filter for
 * coeliac or check what is in a dish. What they cannot see is what it cost you,
 * who you buy it from, or how it is made.
 */
const OUT_DISHES = CLIENT_BUILD
  ? DISHES.map(({ cost, source, costVerified, ...rest }) => rest)
  : DISHES;

/**
 * Ingredient names survive; the method, the quantities and the notes do not.
 *
 * The notes were nearly the leak. They read as cooking guidance - "smoke it
 * yourself over tea and sugar if you can" - and four of them name the stall in
 * the same breath: Terminal Pesquero, Oregon Foods. scripts/verify-client-build
 * caught it by grepping the bytes rather than looking at the page, which is the
 * only way this kind of thing gets found.
 */
const OUT_RECIPES = CLIENT_BUILD
  ? RECIPES.map((r) => ({
      ...r,
      method: [],
      yields: "",
      holds: "",
      note: "",
      ingredients: r.ingredients.map((i) => ({ qty: "", item: i.item }))
    }))
  : RECIPES;

const EMPTY = {};
const OUT_PANES = CLIENT_BUILD
  ? ["home", "moments", "find", "menu", "packages"]
  : ["home","moments","find","menu","recipes","seasonal","compare","graph","day","packages","builder"];

const payload = JSON.stringify({ dishes: OUT_DISHES, clientBuild: CLIENT_BUILD, panes: OUT_PANES, tiers: TIERS, k: CONST, labels: CATEGORY_LABEL,
  flavours: FLAVOURS, events: EVENTS, axes: FLAVOUR_AXES,
  ingredients: INGREDIENTS, order: CATEGORY_ORDER, moments: MOMENTS, recipes: OUT_RECIPES,
  districts: DISTRICTS, venues: VENUE_TYPES,
  es: ES, esPatterns: ES_PATTERNS, esIng: ES_INGREDIENTS, esPrep: ES_PREP,
  attrs: INGREDIENT_ATTRS, plain: PLANT_PLAIN,
  hardDishes: HARD_TEXTURE_DISHES, notForKids: NOT_FOR_CHILDREN, vedas: VEDAS,
  fodmap: HIGH_FODMAP, carb: HIGH_CARB,
  diets: [
    ["vegetarian","Vegetarian","No meat, fish or shellfish. Dairy and eggs are fine."],
    ["vegan","Vegan","No animal product at all, including honey, gelatine and dairy."],
    ["pescatarian","Pescatarian","Fish and shellfish are fine; no meat."],
    ["gluten-free","Coeliac / gluten-free","For coeliac disease, not a preference. Oats are excluded unless certified."],
    ["dairy-free","Lactose / dairy-free","Covers lactose intolerance and milk allergy."],
    ["nut-free","Nut-free","Tree nuts and peanuts."],
    ["no-pork","No pork","Pork, bacon, morcilla, lard."],
    ["no-alcohol","No alcohol","Cooking burns off less than people think."],
    ["halal-ingredients","Halal — ingredients only","No pork and no alcohol — the half of halal that is about ingredients. It says NOTHING about whether the meat was slaughtered halal, which is the part that actually matters. Do not describe a dish as halal on this basis alone."],
    ["kosher-ingredients","Kosher — ingredients only","No pork, no shellfish, no meat and dairy in one dish. Kosher also needs certified supply and a supervised kitchen, neither of which this app can see."],
    ["low-fodmap","Low FODMAP","No onion, garlic, wheat or legumes. The list is short because the aderezo under half the Peruvian dishes is onion and garlic. Portion size matters and this cannot model it."],
    ["lower-carb","Lower carb / keto-leaning","Not built on flour, sugar, rice, potato or oats. A filter, not a nutrition panel — it does not count grams."],
    ["lower-sugar","Lower sugar","A guide for guests managing blood sugar, not a medical claim."],
    ["kid-friendly","Children","Nothing hot, boozy, skewered or on the bone."],
    ["soft-texture","Soft texture","For guests who cannot chew easily. Not an IDDSI assessment."]
  ],
  allergens: ALLERGENS, allergenLabel: ALLERGEN_LABEL,
  prices: CLIENT_BUILD ? EMPTY : PRICES, subOf: CLIENT_BUILD ? EMPTY : SUB_RECIPE_OF,
  subPrices: CLIENT_BUILD ? EMPTY : SUB_PREP_PRICES,
  sundryPrices: CLIENT_BUILD ? EMPTY : NON_FOOD_PRICES, alias: COMPOUND_ALIAS, sundries: NON_FOOD,
  trip: { vanHourly: 45, perKm: 1.8, crewHourly: 18, generator: 280,
          vanTrips: { ninos:1, scran:1, buffet:2, plated:2, ceilidh:3 },
          loadCrew: { ninos:1, scran:1, buffet:2, plated:3, ceilidh:4 } },
  formats: { "drop-off": "Drop-off", buffet: "Buffet", plated: "Plated", "live-station": "Live station" },
  cap: { fryer: 2, oven: 4, liveStation: 2, griddle: 3 },
  lead: { cold: 1440, oven: 240, hob: 180, griddle: 30, fryer: 15 },
  months: ["January","February","March","April","May","June","July","August","September","October","November","December"] });

/**
 * The three faces, embedded.
 *
 * Linking Google Fonts from the head of a file whose whole point is opening
 * without a network cost 13.2 seconds to first paint when the request failed;
 * the same file with the link removed painted in 112 ms. Subsetted to the
 * characters this page actually uses, the three faces come to about 166 KB of
 * base64 - which buys those thirteen seconds back, and stops every open
 * reporting the reader's IP to Google.
 *
 * Regenerate the .woff2 files with:  node scripts/fetch-fonts.mjs
 */
const FONT_DIR = path.join(ROOT, "assets", "fonts");
const FONT_FACES = JSON.parse(fs.readFileSync(path.join(FONT_DIR, "manifest.json"), "utf8"))
  .map((f) => {
    const b64 = fs.readFileSync(path.join(FONT_DIR, f.file)).toString("base64");
    // The variable cuts serve several weights from one file, so declare a
    // weight range rather than repeat a 60 KB data URI three times.
    const weight = f.weights.length > 1
      ? `${Math.min(...f.weights)} ${Math.max(...f.weights)}`
      : String(f.weights[0]);
    return `@font-face{font-family:'${f.family}';font-style:normal;` +
           `font-weight:${weight};font-display:swap;` +
           `src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  })
  .join("\n");

/**
 * The head.
 *
 * Every line here earns its place. Without the doctype the page renders in
 * quirks mode, which changes the box model out from under the layout. Without
 * the viewport tag a phone lays the page out at ~980px and scales the result
 * down, so none of the responsive CSS below ever engages on the device it was
 * written for - and a 390px test viewport will not show you that, because the
 * tool sets the viewport directly. Without the charset a file:// open is left
 * guessing, and "Lúcuma" is a coin toss.
 */
const html = String.raw`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aye Si Cena</title>
<meta name="description" content="Aye, Si, Cena - catering escoces-peruano en Lima. 223 platos con su costo, sus alergenos y su temporada.">
<style>
${FONT_FACES}
:root{
  --bg:#E8E9E6;--surface:#F5F5F2;--raised:#DEE0DB;
  --ink:#1E2326;--ink-2:#565E62;--ink-3:#7C8589;--line:#CBCFC9;
  --aji:#A96A0F;--thistle:#63488A;--good:#2C6349;--warn:#8A5A11;--bad:#96382B;
  --c-sweet:#B07314;--c-savoury:#5C4A86;--c-rich:#8A4B22;--c-tart:#2F7D5B;
  --c-smoky:#4A5A66;--c-spiced:#A33B2C;--c-fresh:#6E8F33;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#14181A;--surface:#1C2124;--raised:#252B2F;
  --ink:#E4E3DC;--ink-2:#9AA2A5;--ink-3:#6F787C;--line:#2C3337;
  --aji:#E5A63C;--thistle:#AB93D1;--good:#6FBF95;--warn:#E0A458;--bad:#E0776A;
  --c-sweet:#E0A343;--c-savoury:#A794D6;--c-rich:#D08650;--c-tart:#5FB68C;
  --c-smoky:#8AA0B0;--c-spiced:#E07B6C;--c-fresh:#A8C665;
}}
:root[data-theme="dark"]{
  --bg:#14181A;--surface:#1C2124;--raised:#252B2F;
  --ink:#E4E3DC;--ink-2:#9AA2A5;--ink-3:#6F787C;--line:#2C3337;
  --aji:#E5A63C;--thistle:#AB93D1;--good:#6FBF95;--warn:#E0A458;--bad:#E0776A;
  --c-sweet:#E0A343;--c-savoury:#A794D6;--c-rich:#D08650;--c-tart:#5FB68C;
  --c-smoky:#8AA0B0;--c-spiced:#E07B6C;--c-fresh:#A8C665;
}
*{box-sizing:border-box}
.dietbox{margin-top:14px;padding:11px 13px;border-radius:9px;background:var(--raised);
  border-left:3px solid var(--aji)}
.dietbox.bad{border-left-color:var(--bad)}
.dietbox p{margin:0;font-size:.86rem}
.dietbox .lbl{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);
  margin-bottom:4px}
.alg{display:inline-block;margin:0 5px 4px 0;padding:2px 7px;border-radius:20px;
  background:var(--bad);color:var(--bg);font-size:11px;font-weight:600}
.suit{display:inline-block;margin:0 5px 4px 0;padding:2px 7px;border-radius:20px;
  border:1px solid var(--good);color:var(--good);font-size:11px}
.vedabox{margin-top:12px;padding:11px 13px;border-radius:9px;border:2px solid var(--bad);
  background:var(--raised)}
.vedabox p{margin:0 0 5px;font-size:.84rem;line-height:1.5}
.vedabox .lbl{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--bad);
  font-weight:700}
.rc.over{color:var(--bad);font-weight:600}
.rc.under{color:var(--warn)}
.rc.muted{color:var(--ink-3)}
.graphstage{position:relative;margin-top:18px;border:1px solid var(--line);border-radius:14px;
  background:var(--surface);overflow:hidden;touch-action:none}
#graphSvg{display:block;width:100%;height:min(70vh,620px);cursor:grab}
#graphSvg.dragging{cursor:grabbing}
#graphSvg .edge{stroke:var(--line);stroke-linecap:round;transition:stroke .2s,stroke-opacity .2s}
#graphSvg .edge.lit{stroke:var(--aji);stroke-opacity:.85}
#graphSvg .node{cursor:pointer}
#graphSvg .node circle{transition:fill-opacity .2s,stroke-width .2s}
#graphSvg .node:hover circle{stroke-width:3}
#graphSvg .node.sel circle{stroke:var(--aji);stroke-width:3}
#graphSvg .node.dim{opacity:.22}
#graphSvg .node text{pointer-events:none;font-size:9.5px;fill:var(--ink-2)}
#graphSvg .node.sel text{fill:var(--ink);font-weight:700}
.graphpanel{position:absolute;right:12px;top:12px;width:min(300px,calc(100% - 24px));
  max-height:calc(100% - 24px);overflow:auto;background:var(--raised);border:1px solid var(--line);
  border-radius:12px;padding:14px 15px;box-shadow:0 8px 28px rgba(0,0,0,.22)}
.graphpanel h2{margin:0 0 3px;font-size:1.02rem;letter-spacing:0}
.graphpanel .close{float:right;border:0;background:none;color:var(--ink-3);cursor:pointer;
  font-size:17px;line-height:1;padding:0 2px}
@media (prefers-reduced-motion:reduce){#graphSvg .edge,#graphSvg .node circle{transition:none}}
.compass-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;margin-top:6px}
#compass{width:100%;max-width:400px;user-select:none;overflow:visible}
#compass .wedge{cursor:pointer;transition:transform .32s cubic-bezier(.2,.8,.2,1),
  opacity .24s ease;transform-origin:200px 200px}
#compass .wedge path{transition:fill .3s ease,stroke .3s ease,filter .3s ease}
#compass .wedge:hover{transform:scale(1.035)}
#compass .wedge.on{transform:scale(1.05)}
#compass .wedge.off-limits{cursor:default;opacity:.28}
#compass .wedge.off-limits:hover{transform:none}
#compass text{pointer-events:none}
#compass .hubN{font-variant-numeric:tabular-nums}
@keyframes hubPop{0%{opacity:0;transform:scale(.55)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
#compass .hubN{animation:hubPop .42s cubic-bezier(.2,.8,.2,1) both;transform-origin:200px 214px}
@keyframes riseIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.rise{animation:riseIn .42s cubic-bezier(.2,.8,.2,1) both}
@media (prefers-reduced-motion:reduce){
  #compass .wedge,#compass .wedge path,#compass .hubN,.rise{animation:none!important;transition:none!important}
  #compass .wedge:hover,#compass .wedge.on{transform:none}
}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:Karla,"Helvetica Neue",Arial,sans-serif;font-size:16px;line-height:1.55;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.tnum{font-variant-numeric:tabular-nums}
.mono{font-family:"IBM Plex Mono",ui-monospace,monospace}
.flavtag{border:1px solid var(--line);border-radius:4px;padding:1px 6px;
  font-size:10px;color:var(--ink-3);text-transform:capitalize}
.linkbtn{background:none;border:0;color:var(--ink-3);cursor:pointer;
  font-size:11px;text-decoration:underline;padding:0}
.grouphead{letter-spacing:.12em;text-transform:uppercase;margin:0 0 10px;
  font-size:11px;color:var(--ink-3);font-weight:500}
.cap{text-transform:capitalize}
:focus-visible{outline:2px solid var(--aji);outline-offset:2px}

header.bar{border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:30}
.bar-in{display:flex;gap:12px;align-items:center;
  max-width:1120px;margin:0 auto;padding:14px 20px}
.brand{font-family:Fraunces,Georgia,serif;font-size:1.5rem;font-weight:600;letter-spacing:-.01em}
.brand em{font-style:normal;color:var(--aji)}
/* One row that scrolls, never four rows that wrap. Wrapping cost 470px of an
   844px phone screen — more than half the fold spent on navigation. */
nav{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;flex:1 1 auto;min-width:0;
  scrollbar-width:none;-ms-overflow-style:none;scroll-padding-inline:20px}
nav::-webkit-scrollbar{display:none}
/* A scrolling strip that just clips mid-word looks broken. The fade says
   "there is more this way" without spending a row on arrows. */
.navwrap{position:relative;flex:1 1 auto;min-width:0;display:flex}
.navwrap::after{content:"";position:absolute;top:0;right:0;bottom:0;width:34px;
  pointer-events:none;opacity:0;transition:opacity .18s;
  background:linear-gradient(90deg,transparent,var(--bg))}
.navwrap::before{content:"";position:absolute;top:0;left:0;bottom:0;width:34px;z-index:1;
  pointer-events:none;opacity:0;transition:opacity .18s;
  background:linear-gradient(270deg,transparent,var(--bg))}
.navwrap.more-right::after{opacity:1}
.navwrap.more-left::before{opacity:1}
.qsbtn{display:flex;align-items:center;gap:7px;border-color:var(--line);flex:0 0 auto}
.qsbtn svg{width:14px;height:14px}
.qsbtn:hover{border-color:var(--ink-3)}
@media(max-width:860px){ .qsbtn-t,.qsbtn-k{display:none} }
.tab{font:inherit;font-size:.875rem;background:none;border:1px solid transparent;
  color:var(--ink-2);padding:6px 12px;border-radius:99px;cursor:pointer;
  white-space:nowrap;flex:0 0 auto}
#langBtn{flex:0 0 auto}
@media (max-width:640px){
  .bar-in{flex-wrap:wrap;gap:8px;padding:11px 16px}
  .brand{font-size:1.25rem;margin-right:auto}
  /* The scroller is .navwrap now. Targeting <nav> here put the row order out
     as brand / tabs / buttons, which cost a third row on a phone. */
  .navwrap{order:3;flex-basis:100%}
}
.tab:hover{color:var(--ink)}
.tab[aria-selected="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink);font-weight:700}

h1{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.02em;line-height:1.02;
  font-size:clamp(2.4rem,6vw,4rem);margin:0 0 18px;text-wrap:balance}
h2{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.01em;
  font-size:clamp(1.4rem,3.2vw,2rem);margin:0;text-wrap:balance}
h3{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.2rem;margin:0}
/* Every pane is its own page with its own h1, so the group headings under it
   are h2 - but they are card titles and should not be set at h2 size. This
   keeps the outline honest without changing the design. */
h2.h-sm{font-size:1.2rem;letter-spacing:0}
h2.grouphead{font-size:11px;letter-spacing:.12em}
/* A client build ships no cost, so the columns that would show one are not
   drawn at all. Belt and braces: the data is already gone. */
[data-client] .money,[data-client] .fc,[data-client] th.money,[data-client] th.fc{display:none}
.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;
  letter-spacing:.17em;text-transform:uppercase;color:var(--ink-3);margin:0 0 16px}
.lede{max-width:60ch;color:var(--ink-2);font-size:1.06rem;margin:0}
.muted{color:var(--ink-2)}
section.pane{padding:44px 0}
section.pane[hidden]{display:none}
.divider{border:0;border-top:1px solid var(--line);margin:40px 0}

.grid{display:grid;gap:16px}
.g3{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px}
.kv{display:flex;justify-content:space-between;gap:12px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12.5px;padding:3px 0}
.kv dt{color:var(--ink-2)}.kv dd{margin:0;font-weight:600}

.stats{display:flex;flex-wrap:wrap;gap:10px 28px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:var(--ink-3);margin-top:26px}
.stats b{color:var(--ink);font-weight:600}

.btn{font:inherit;font-size:.9rem;font-weight:700;padding:12px 20px;border-radius:9px;cursor:pointer;
  background:var(--ink);color:var(--bg);border:1px solid var(--ink)}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.btn.ghost:hover{border-color:var(--ink-3)}
.btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:30px}

.tscroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
table{border-collapse:collapse;width:100%;min-width:730px}
thead th{background:var(--raised);text-align:left;padding:11px 13px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink-3);font-weight:500;white-space:nowrap}
tbody td{padding:12px 13px;border-top:1px solid var(--line);vertical-align:top;font-size:14px}
tbody tr:hover{background:var(--raised)}
.dish-n{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;color:var(--ink-3)}
.dish-t{font-weight:700;display:block;line-height:1.3}
.dish-b{display:block;color:var(--ink-2);font-size:13px;margin-top:2px}
.dna{display:block;font-size:12px;margin-top:5px}
.dna .u{color:var(--thistle);font-weight:700}
.dna .p{color:var(--aji);font-weight:700}
/* The same two colours, inline. Prose reached for .dna to get the colour and
   inherited its display:block, which broke the matrix lede into three lines
   with "purple" and "gold" stranded as headings. */
.cu{color:var(--thistle);font-weight:700}
.cp{color:var(--aji);font-weight:700}
.money{font-family:"IBM Plex Mono",ui-monospace,monospace;text-align:right;white-space:nowrap;font-size:13px}
.src{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10.5px;color:var(--ink-3);white-space:nowrap}
.src.wrap-ok{white-space:normal}
.fc{font-family:"IBM Plex Mono",ui-monospace,monospace;text-align:right;font-size:11.5px;white-space:nowrap}
.fc.ok{color:var(--good)}.fc.under{color:var(--warn)}.fc.over{color:var(--bad)}

.sec-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:34px 0 12px}
.pill-count{border:1px solid var(--line);border-radius:99px;padding:1px 9px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;color:var(--ink-3)}

/* builder */
.build{display:grid;gap:26px;grid-template-columns:1fr}
@media(min-width:1000px){.build{grid-template-columns:1fr 330px}}
/* A grid item's automatic minimum is min-content, and a <select> takes the
   width of its longest option. "Magdalena del Mar · 5 min" was therefore
   forcing the builder column to 732px inside a 390px phone, and the whole
   page scrolled sideways. Both halves of that need saying out loud. */
.build>*{min-width:0}
select{max-width:100%}
fieldset{border:0;padding:0;margin:0 0 22px}
legend{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;
  letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin-bottom:9px;padding:0}
fieldset{min-width:0}
.chips{display:flex;gap:8px;flex-wrap:wrap}

/* ---- quick search ------------------------------------------------------ */
.qs-back{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.34);
  display:flex;align-items:flex-start;justify-content:center;padding:9vh 16px 16px;
  backdrop-filter:blur(2px)}
/* A class with display:flex beats the hidden attribute, which left an
   invisible full-screen overlay swallowing every click on the page. */
.qs-back[hidden]{display:none}
.qs{width:min(640px,100%);background:var(--surface);border:1px solid var(--line);
  border-radius:15px;box-shadow:0 22px 60px rgba(0,0,0,.3);overflow:hidden;
  display:flex;flex-direction:column;max-height:76vh}
.qs-in{display:flex;align-items:center;gap:10px;padding:15px 16px;
  border-bottom:1px solid var(--line);flex-shrink:0}
.qs-in svg{width:17px;height:17px;color:var(--ink-3);flex-shrink:0}
.qs-in input{flex:1;min-width:0;border:0;background:none;color:var(--ink);font:inherit;
  font-size:1.02rem;outline:none}
.qs-kbd,.qs-foot kbd{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;
  border:1px solid var(--line);border-radius:5px;padding:2px 6px;color:var(--ink-3);
  background:var(--bg)}
.qs-list{overflow-y:auto;padding:7px}
.qs-grp{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--ink-3);padding:11px 10px 5px}
.qs-item{display:flex;gap:11px;align-items:baseline;width:100%;text-align:left;border:0;
  background:none;color:inherit;font:inherit;padding:9px 10px;border-radius:9px;cursor:pointer}
.qs-item:hover,.qs-item.sel{background:var(--raised)}
.qs-item .qs-t{font-weight:600}
.qs-item .qs-s{font-size:.82rem;color:var(--ink-3);margin-left:auto;white-space:nowrap;
  font-family:"IBM Plex Mono",ui-monospace,monospace}
.qs-none{padding:26px 14px;text-align:center;color:var(--ink-3);font-size:.92rem}
.qs-foot{display:flex;gap:16px;flex-wrap:wrap;padding:9px 15px;border-top:1px solid var(--line);
  font-size:10.5px;color:var(--ink-3);flex-shrink:0}
@media(max-width:640px){ .qs-foot{display:none} .qs-back{padding:0} .qs{max-height:100vh;
  height:100vh;border-radius:0;width:100%} }

/* ---- filter bar -------------------------------------------------------- */
.toolbar{position:sticky;top:0;z-index:12;background:var(--bg);
  border-bottom:1px solid var(--line);padding:14px 0 12px;margin:0 0 22px}
.searchrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.searchbox{position:relative;flex:1 1 260px;min-width:0;display:flex;align-items:center}
.searchbox svg{position:absolute;left:12px;width:15px;height:15px;pointer-events:none;
  color:var(--ink-3)}
.searchbox input{width:100%;padding:11px 38px 11px 35px;border:1px solid var(--line);
  border-radius:9px;background:var(--surface);color:var(--ink);font:inherit;font-size:.94rem}
.searchbox input:focus-visible{outline:2px solid var(--aji);outline-offset:1px;border-color:transparent}
.clearq{position:absolute;right:7px;border:0;background:none;color:var(--ink-3);cursor:pointer;
  font-size:17px;line-height:1;padding:6px 8px;border-radius:6px;display:none}
.clearq.on{display:block}
.clearq:hover{color:var(--ink);background:var(--raised)}
.selwrap{display:flex;align-items:center;gap:6px}
.selwrap select{padding:10px 11px;border:1px solid var(--line);border-radius:9px;
  background:var(--surface);color:var(--ink);font:inherit;font-size:.88rem}
.filtline{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:11px}
.filtbox{margin-top:10px}
.filtbox>summary{cursor:pointer;display:flex;align-items:center;gap:8px;list-style:none;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-3);padding:6px 0}
.filtbox>summary::-webkit-details-marker{display:none}
.filtbox>summary::before{content:"";width:7px;height:7px;flex-shrink:0;
  border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;
  transform:rotate(-45deg);transition:transform .18s;margin-left:2px}
.filtbox[open]>summary::before{transform:rotate(45deg)}
.filtbox>summary:hover{color:var(--ink)}
.filtn{background:var(--ink);color:var(--bg);border-radius:99px;padding:1px 7px;
  font-size:10px;letter-spacing:0;display:none}
.filtn.on{display:inline-block}
.notebox{margin-top:14px;border-top:1px solid var(--line);padding-top:6px}
.notebox>summary{cursor:pointer;list-style:none;font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);padding:7px 0;
  display:flex;align-items:center;gap:8px}
.notebox>summary::-webkit-details-marker{display:none}
.notebox>summary::before{content:"+";font-size:14px;line-height:1}
.notebox[open]>summary::before{content:"\2212"}
.notebox>summary:hover{color:var(--ink)}
.resultbar{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-top:11px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;color:var(--ink-3)}
.resultbar b{color:var(--ink);font-size:13px}
.linkbtn{border:0;background:none;color:var(--aji);cursor:pointer;font:inherit;
  font-size:11.5px;text-decoration:underline;padding:2px 0}
.linkbtn:hover{color:var(--ink)}
.empty{border:1px dashed var(--line);border-radius:12px;padding:34px 22px;text-align:center;
  color:var(--ink-2)}
.empty h2{margin:0 0 7px;font-size:1.2rem;letter-spacing:0}
.empty p{margin:0 0 14px;font-size:.92rem}

/* Sortable table headers */
th.sortable{cursor:pointer;user-select:none;white-space:nowrap}
th.sortable:hover{color:var(--ink)}
th.sortable .arrow{opacity:.35;margin-left:3px}
th.sortable[aria-sort] .arrow{opacity:1;color:var(--aji)}

/* A 7-column table does not belong on a 390px screen. Below that the same
   rows render as cards, which is the only honest fix for "swipe sideways". */
.dishcards{display:none}
@media(max-width:700px){
  .mxtable{display:none}
  .dishcards{display:grid;gap:10px}
}
.dcard{border:1px solid var(--line);border-radius:11px;padding:13px 14px;background:var(--surface)}
.dcard-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.dcard-nums{display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;color:var(--ink-3)}
.dcard-nums b{color:var(--ink);font-weight:600}
.chip{font:inherit;font-size:.875rem;padding:9px 16px;border-radius:99px;cursor:pointer;
  background:transparent;color:var(--ink-2);border:1px solid var(--line)}
.chip:hover{border-color:var(--ink-3);color:var(--ink)}
.chip[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink);font-weight:700}
input[type=number]{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:15px;width:120px;
  padding:9px 12px;border-radius:9px;border:1px solid var(--line);background:var(--surface);color:var(--ink)}
.picks{display:grid;gap:9px;grid-template-columns:1fr}
@media(min-width:640px){.picks{grid-template-columns:1fr 1fr}}
.pick{text-align:left;font:inherit;background:transparent;cursor:pointer;
  border:1px solid var(--line);border-radius:10px;padding:11px 13px;color:var(--ink)}
.pick:hover{border-color:var(--ink-3)}
.pick[aria-pressed="true"]{border-color:var(--aji);background:var(--surface)}
.pick-top{display:flex;justify-content:space-between;gap:9px;align-items:baseline}
.pick-name{font-weight:700;font-size:.9rem;line-height:1.25}
.pick-price{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:var(--ink-2);white-space:nowrap}

.quote{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px;
  position:sticky;top:86px}
.qrow{display:flex;justify-content:space-between;gap:12px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;padding:3px 0;color:var(--ink-2)}
.qrow.dim{color:var(--ink-3)}
.qrow.tot{border-top:1px solid var(--line);margin-top:5px;padding-top:7px;color:var(--ink);font-weight:600}
.keep{background:var(--raised);border-radius:9px;padding:13px;margin-top:16px}
.keep .lbl{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;
  letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
.keep .big{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:1.35rem;
  font-weight:600;color:var(--good);margin-top:3px}
.warn{border:1px solid var(--line);background:var(--raised);border-radius:8px;
  padding:9px 11px;font-size:12.5px;color:var(--warn);margin-top:11px}
.note{font-size:11.5px;color:var(--ink-3);margin-top:14px;line-height:1.5}

footer{border-top:1px solid var(--line);margin-top:56px;padding:24px 0 48px;
  font-size:13px;color:var(--ink-3)}
footer p{margin:0 0 7px;max-width:70ch}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>

<header class="bar">
  <div class="bar-in">
    <span class="brand">Aye <em>Si</em> Cena</span>
    <div class="navwrap"><nav role="tablist" aria-label="Sections">
      <button class="tab" role="tab" data-pane="home" aria-selected="true">Home</button>
      <button class="tab" role="tab" data-pane="moments" aria-selected="false">The evening</button>
      <button class="tab" role="tab" data-pane="find" aria-selected="false">Find dishes</button>
      <button class="tab" role="tab" data-pane="menu" aria-selected="false">The matrix</button>
      <button class="tab" role="tab" data-pane="seasonal" aria-selected="false">Season</button>
      <button class="tab" role="tab" data-pane="compare" aria-selected="false">Compare</button>
      <button class="tab" role="tab" data-pane="graph" aria-selected="false">Ingredients</button>
      <button class="tab" role="tab" data-pane="recipes" aria-selected="false">Recipes</button>
      <button class="tab" role="tab" data-pane="day" aria-selected="false">The day</button>
      <button class="tab" role="tab" data-pane="packages" aria-selected="false">Packages</button>
      <button class="tab" role="tab" data-pane="builder" aria-selected="false">Build a menu</button>
    </nav></div>
    <button id="qsBtn" class="tab qsbtn" type="button" data-openqs aria-label="Search everything">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <span class="qsbtn-t">Search</span><kbd class="qs-kbd qsbtn-k">/</kbd>
    </button>
    <button id="langBtn" class="tab" type="button" aria-label="Cambiar idioma"
      style="font-family:'IBM Plex Mono',monospace;font-size:11px"></button>
  </div>
</header>

<div class="wrap">

  <section class="pane" id="pane-home">
    <p class="eyebrow">Scottish-Peruvian catering · Lima</p>
    <h1>Aye, Si, Cena.</h1>
    <p class="lede"><span style="color:var(--ink)">Aye</span> is Scottish for yes.
      <span style="color:var(--ink)">Sí</span> is Spanish for yes. Say it aloud and it means
      something else again. The full matrix, taking Glasgow technique through the Lima pantry.</p>
    <div class="btns">
      <button class="btn" data-goto="builder">Build a menu &amp; see the price</button>
      <button class="btn ghost" data-goto="menu">Browse the whole matrix</button>
    </div>
    <div class="stats" id="homeStats"></div>

    <hr class="divider">
    <h2>Three ways to book</h2>
    <p class="lede" style="margin-top:8px">Same kitchen, three levels of service. The box tier needs
      no staff, no hired china and no liquor licence — which is why it is the fastest to sell.</p>
    <div class="grid g3" id="homeTiers" style="margin-top:24px"></div>

    <hr class="divider">
    <h2>The signatures</h2>
    <p class="lede" style="margin-top:8px">The dishes that explain the whole idea in one bite.</p>
    <div class="grid g3" id="homeSigs" style="margin-top:24px"></div>
  </section>

  <section class="pane" id="pane-moments" hidden>
    <h1>The evening</h1>
    <p class="lede">Point at the part of the night you are trying to fill. The bar under each
      moment shows how much of the matrix serves it — which is also where the gaps are.</p>
    <ol id="momentArc" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:30px 0 0;padding:0;list-style:none"></ol>
    <div id="momentBody" style="margin-top:34px;border-top:1px solid var(--line);padding-top:22px"></div>
  </section>

  <section class="pane" id="pane-compare" hidden>
    <h1>What the money buys</h1>
    <p class="lede">The same event at all three tiers, side by side. Set the head count and the
      difference between a boxed lunch and a plated dinner becomes a number.</p>
    <fieldset style="margin-top:26px">
      <legend>Guests</legend>
      <input type="number" id="cmpGuests" min="1" max="500" value="30" aria-label="Guests">
    </fieldset>
    <div id="cmpBody" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))"></div>
  </section>

  <section class="pane" id="pane-graph" hidden>
    <h1>What unlocks what</h1>
    <p class="lede">Every ingredient sized by how much menu it opens up. What belongs on a standing
      order, and which dishes carry an ingredient nothing else uses.</p>
    <div class="chips" id="graphControls" style="margin-top:22px"></div>
    <div class="graphstage">
      <svg id="graphSvg" role="application" tabindex="0"
        aria-label="Ingredient network. Drag a node to move it, click to see its dishes."></svg>
      <div id="graphPanel" class="graphpanel" hidden></div>
    </div>
    <p class="muted mono" style="font-size:11px;margin:10px 0 0;text-align:center">
      drag to move &middot; scroll to zoom &middot; click a node for its dishes
    </p>
    <div id="graphList" style="margin-top:32px"></div>
    <div id="graphOrphans" style="margin-top:34px;border-top:1px solid var(--line);padding-top:22px"></div>
  </section>

  <section class="pane" id="pane-find" hidden>
    <h1>Find dishes</h1>
    <p class="lede">Start from the event or start from the palate. Pick what you are planning and
      the matrix narrows to what actually works for it — then filter by flavour to land on a
      shortlist.</p>
    <div class="toolbar">
      <div class="searchrow">
        <label class="searchbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="findQ" type="search" autocomplete="off" spellcheck="false"
            placeholder="Search a dish or an ingredient" aria-label="Search dishes">
          <button type="button" class="clearq" id="findQClear" aria-label="Clear the search">&times;</button>
        </label>
      </div>
    </div>
    <fieldset style="margin-top:8px">
      <legend>What are you planning?</legend>
      <div class="grid g3" id="evtGrid"></div>
    </fieldset>
    <fieldset>
      <legend>The palate compass</legend>
      <p class="muted" style="font-size:.9rem;margin:0 0 6px">Each wedge is a flavour the
        matrix carries, and its depth is how much of it. Tap to steer.</p>
      <div class="compass-wrap">
        <svg id="compass" viewBox="0 0 400 400" role="group" aria-label="Flavour compass"></svg>
        <div class="chips" id="flavChips" style="justify-content:center"></div>
      </div>
    </fieldset>
    <fieldset>
      <legend>Service format</legend>
      <div class="chips" id="fmtChips"></div>
    </fieldset>
    <fieldset>
      <legend>Who is eating?</legend>
      <p class="muted" style="font-size:.9rem;margin:0 0 8px">Derived from every ingredient in
        the recipe, including sub-preparations &mdash; not from the dish description. Still not a
        legal allergen audit: confirm against the products you actually buy.</p>
      <div class="chips" id="dietChips"></div>
      <p id="dietNote" class="muted" style="font-size:.88rem;margin:10px 0 0"></p>
    </fieldset>
    <div id="findCount" role="status" aria-live="polite" style="border-top:1px solid var(--line);padding-top:18px;margin-bottom:20px"></div>
    <div id="findResults"></div>
  </section>

  <section class="pane" id="pane-menu" hidden>
    <h1>The matrix</h1>
    <p class="lede">Every dish with its lineage, its food cost and its menu value. The
      <span class="cu">purple</span> half is the British original; the
      <span class="cp">gold</span> half is what Peru does to it.</p>
    <details class="notebox">
      <summary><span>How to read these numbers</span></summary>
      <p class="lede" style="font-size:.92rem;color:var(--ink-3);margin-top:10px">FC% is food cost as a
        share of menu value. Above 30% is flagged — it is eating margin.</p>
      <p class="lede" style="font-size:.92rem;margin-top:8px"><strong>From recipe</strong> is what the
        dish prices out at when every ingredient line is costed and divided by the yield. Where that
        disagrees with the estimate by more than 40% the cell is flagged. The bakery is where it
        disagrees most: sugar and flour are cheap and the estimates assumed otherwise. Both figures
        are unverified until a market run.</p>
    </details>
    <div class="toolbar">
      <div class="searchrow">
        <label class="searchbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="mxQ" type="search" autocomplete="off" spellcheck="false"
            placeholder="Search a dish, an ingredient, a supplier" aria-label="Search the matrix">
          <button type="button" class="clearq" id="mxQClear" aria-label="Clear the search">&times;</button>
        </label>
        <span class="selwrap"><label class="src" for="mxSort">Sort</label>
          <select id="mxSort">
            <option value="id">Number</option>
            <option value="name">Name</option>
            <option value="price">Menu value</option>
            <option value="cost">Estimated cost</option>
            <option value="fc">Food cost %</option>
            <option value="gap">Furthest from its estimate</option>
          </select></span>
      </div>
      <details class="filtbox" id="mxFilters">
        <summary><span>Filters</span><span class="filtn" id="mxFiltN"></span></summary>
        <div class="filtline" id="mxCats"></div>
        <div class="filtline" id="mxOrigins"></div>
        <div class="filtline" id="mxFlags"></div>
      </details>
      <div class="resultbar" id="mxCount" role="status" aria-live="polite"></div>
    </div>
    <div id="menuBody"></div>
  </section>

  <section class="pane" id="pane-recipes" hidden>
    <h1>Recipes</h1>
    <p class="lede">How each dish is actually made, at catering scale. Every one carries a
      make-ahead plan and an honest hold time — what a dish will and will not survive is a
      scheduling fact, not a detail.</p>
    <p class="lede" style="font-size:.92rem;color:var(--ink-3);margin-top:10px">Quantities are
      batch quantities, not domestic ones. Cross-check them against the run sheet in Build a menu
      before a real service.</p>
    <div class="toolbar">
      <div class="searchrow">
        <label class="searchbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="recSearch" type="search" autocomplete="off" spellcheck="false"
            placeholder="Search a dish, an ingredient or a technique" aria-label="Search recipes">
          <button type="button" class="clearq" id="recQClear" aria-label="Clear the search">&times;</button>
        </label>
        <span class="selwrap"><label class="src" for="recTime">Total time</label>
          <select id="recTime">
            <option value="">Any</option>
            <option value="45">Under 45 min</option>
            <option value="90">Under 90 min</option>
            <option value="180">Under 3 hours</option>
          </select></span>
      </div>
      <details class="filtbox" id="recFilters">
        <summary><span>Filters</span><span class="filtn" id="recFiltN"></span></summary>
        <div class="filtline chips" id="recCats"></div>
        <div class="filtline chips" id="recDiets"></div>
      </details>
      <div class="resultbar" id="recCount" role="status" aria-live="polite"></div>
    </div>
    <div id="recBody"></div>
  </section>

  <section class="pane" id="pane-seasonal" hidden>
    <h1>What the market has</h1>
    <p class="lede">You buy all year, so the menu moves with the market. Pick a month to see what is
      worth buying, what is out of window, and which dishes you cannot properly build until it
      comes back.</p>
    <div id="seasonWarn"></div>
    <fieldset style="margin-top:28px">
      <legend>Month</legend>
      <div class="chips" id="monthChips"></div>
      <p id="monthName" class="brand" style="margin:14px 0 0"></p>
    </fieldset>
    <div id="seasonPanels" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))"></div>
    <div id="seasonOff" style="margin-top:34px"></div>
    <div id="seasonSubs" style="margin-top:34px;border-top:1px solid var(--line);padding-top:24px"></div>
    <div id="seasonPantry" style="margin-top:38px;border-top:1px solid var(--line);padding-top:24px"></div>
  </section>

  <section class="pane" id="pane-day" hidden>
    <h1>Can you take the job?</h1>
    <p class="lede">Two events on one Saturday is one plancha, one van and a crew who cannot be in
      San Isidro and Asia at the same time. This works in windows &mdash; out of the kitchen, load
      in, serve, load out, drive back &mdash; so two bookings clash on kit only when their windows
      actually overlap, not merely because they share a date.</p>
    <p class="lede" style="font-size:.92rem;color:var(--ink-3);margin-top:10px">It says no rather
      than warning. Taking a second Saturday you cannot staff loses both jobs, not one.</p>

    <fieldset style="margin-top:26px">
      <legend>What you own</legend>
      <div class="chips" id="kitRow"></div>
    </fieldset>

    <div class="grid g2" id="bookingForms" style="margin-top:20px;gap:20px"></div>
    <div id="dayVerdict" style="margin-top:26px"></div>
  </section>

  <section class="pane" id="pane-packages" hidden>
    <h1>Packages</h1>
    <p class="lede">Three tiers, and exactly what each carries in per-event cost. These figures drive
      the builder.</p>
    <div class="grid g3" id="pkgCards" style="margin-top:28px"></div>
    <hr class="divider">
    <h2>Rates behind the maths</h2>
    <div class="grid g3" id="pkgRates" style="margin-top:20px"></div>
    <p class="lede" style="margin-top:22px">Every quote is stated net, with IGV added on top.
      Quoting a gross figure while budgeting as if it were net loses about
      <strong>S/ 61.02</strong> per guest at a S/ 400 head price.</p>
  </section>

  <section class="pane" id="pane-builder" hidden>
    <h1>Build a menu</h1>
    <p class="lede">Choose a tier, set the head count, pick dishes. The price updates as you go —
      including menaje, staff, transport and IGV, so the number at the bottom is what the client
      actually pays.</p>
    <div class="build" style="margin-top:30px">
      <div>
        <fieldset>
          <legend>Service tier</legend>
          <div class="chips" id="tierChips"></div>
        </fieldset>
        <fieldset>
          <legend>Guests</legend>
          <input type="number" id="guests" min="1" max="500" value="20" aria-label="Number of guests">
          <span class="muted" style="margin-left:10px;font-size:.9rem" id="minNote"></span>
        </fieldset>
        <fieldset>
          <legend>When is it?</legend>
          <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end">
            <label style="display:block;font-size:.86rem;color:var(--ink-2)">Month
              <select id="monthSel" aria-label="Month of the event"
                style="display:block;margin-top:5px;padding:9px 11px;border:1px solid var(--line);
                       border-radius:8px;background:var(--surface);color:var(--ink);font:inherit"></select>
            </label>
          </div>
          <div id="vedaBox"></div>
          <div id="seasonBox"></div>
        </fieldset>
        <fieldset>
          <legend>Where is it?</legend>
          <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end">
            <label style="display:block;font-size:.86rem;color:var(--ink-2)">District
              <select id="distSel" aria-label="District"
                style="display:block;margin-top:5px;padding:9px 11px;border:1px solid var(--line);
                       border-radius:8px;background:var(--surface);color:var(--ink);font:inherit"></select>
            </label>
            <label style="display:block;font-size:.86rem;color:var(--ink-2)">Venue
              <select id="venueSel" aria-label="Venue type"
                style="display:block;margin-top:5px;padding:9px 11px;border:1px solid var(--line);
                       border-radius:8px;background:var(--surface);color:var(--ink);font:inherit"></select>
            </label>
            <label style="display:flex;align-items:center;gap:7px;font-size:.86rem;color:var(--ink-2);padding-bottom:9px">
              <input type="checkbox" id="peakChk" checked> Loading in at rush hour
            </label>
          </div>
          <p id="venueNote" class="muted" style="font-size:.88rem;margin:12px 0 0"></p>
        </fieldset>
        <div id="dropNote"></div>
        <div id="pickBody"></div>
        <div id="shopBody" style="margin-top:34px;border-top:1px solid var(--line);padding-top:24px"></div>
      </div>
      <aside><div class="quote" id="quote"></div></aside>
    </div>
  </section>

  <footer>
    <p>All prices in soles, exclusive of IGV. Costs are planning estimates modelled to a 25–30% food
      cost, not verified supplier quotes.</p>
    <p>Aye Si Cena · Lima · Scottish-Peruvian catering</p>
  </footer>
</div>

<div id="qsBack" class="qs-back" hidden>
  <div class="qs" role="dialog" aria-modal="true" aria-label="Quick search">
    <div class="qs-in">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="qsQ" type="text" autocomplete="off" spellcheck="false"
        placeholder="Search everything — a dish, an ingredient, a section"
        aria-label="Search everything" aria-controls="qsList" aria-expanded="true">
      <kbd class="qs-kbd">Esc</kbd>
    </div>
    <div id="qsList" class="qs-list" role="listbox" aria-label="Results"></div>
    <div class="qs-foot">
      <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> <span>to move</span></span>
      <span><kbd>&crarr;</kbd> <span>to open</span></span>
      <span><kbd>/</kbd> <span>to search from anywhere</span></span>
    </div>
  </div>
</div>

<script id="data" type="application/json">${payload}</script>
<script>
(function(){
"use strict";
var D = JSON.parse(document.getElementById("data").textContent);
var DISHES = D.dishes, TIERS = D.tiers, K = D.k, LABELS = D.labels;
var FLAV = D.flavours, EVENTS = D.events, AXES = D.axes;
var INGS = D.ingredients, MONTHS = D.months;
var MOMENTS = D.moments, FORMATS = D.formats, CAP = D.cap, LEAD = D.lead;
var ORDER = D.order;
var RECIPES = D.recipes;
var DISTRICTS = D.districts, VENUES = D.venues, TRIP = D.trip;
var ATTRS = D.attrs || {}, PLAIN = D.plain || [], DIETS = D.diets || [];
var HARD_DISHES = D.hardDishes || [], NO_KIDS = D.notForKids || [], VEDAS = D.vedas || [];
var FODMAP = D.fodmap || [], CARB = D.carb || [];
var ES = D.es, ES_ING = D.esIng || {}, ES_PREP = D.esPrep || {};
// Compiled once: the page re-translates on every render and recompiling these
// per text node would be the slowest thing on the page.
var ES_RX = (D.esPatterns || []).map(function(p){ return [new RegExp(p[0]), p[1]]; });
function patternTranslate(key){
  for (var i = 0; i < ES_RX.length; i++){
    if (ES_RX[i][0].test(key)) return key.replace(ES_RX[i][0], ES_RX[i][1]);
  }
  return null;
}
var PRICES = D.prices, SUB_OF = D.subOf, SUB_PRICES = D.subPrices;
var SUNDRY_PRICES = D.sundryPrices, ALIAS = D.alias, SUNDRIES = D.sundries;
var ALLERGENS = D.allergens, ALLERGEN_LABEL = D.allergenLabel;
/**
 * A client build has had cost, suppliers, the price tables and the recipe
 * method removed from its data before it ever reached the browser. This flag
 * only decides what to draw; there is nothing left to leak either way, which
 * is the point - a hidden column is still in the document.
 */
var CLIENT_BUILD = D.clientBuild === true;
var PANES = D.panes;


function soles(n){ return "S/ " + n.toFixed(2); }
/**
 * The renderer writes plenty of single-quoted attributes, so ' has to be in
 * here too. It was not, and the only ingredient note carrying an apostrophe -
 * "The caramel note in the Millionaire's..." - happened to belong to Lúcuma,
 * which is seasonal and so never reached the pantry renderer that uses a
 * single-quoted title. The next all-year ingredient with an apostrophe would
 * have terminated the attribute early and turned the rest of the sentence into
 * junk attributes.
 */
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
/**
 * A client build has no cost, so there is no ratio and no flag to give.
 * Returning NaN here would paint "NaN%" across the matrix; returning 0 would
 * claim a food cost of nothing. Both callers below check for null.
 */
function ratio(d){ return d.cost === undefined ? null : d.cost / d.price; }
function flag(d){
  var r = ratio(d);
  if (r === null) return "";
  return r > K.FC_MAX ? "over" : (r < K.FC_MIN ? "under" : "ok");
}

/**
 * A direct dictionary lookup, for a label the renderer glues into a longer
 * string before the DOM walker can see it.
 */
function L(s){ return LANG === "es" && ES[s] !== undefined ? ES[s] : s; }

/**
 * Record a string this layer composed in the viewer's language.
 *
 * The walker translates whole text nodes and records what it produced. A
 * string built here never passes through it, so without this the coverage
 * figure reports finished Spanish as untranslated English.
 */
function mark(s){
  if (LANG === "es") APPLIED[String(s).replace(/\s+/g, " ").trim()] = 1;
  return s;
}

/** What to ask for at the stall, in the language the stall speaks. */
function marketName(key){
  if (LANG !== "es") return key;
  return ES_ING[key] || key;
}

// Exposed so verify-standalone can hold this port to the TypeScript in
// lib/ingredient-key.ts. They drifted once and the shop asked a butcher for
// two litres of lamb.
window.__canonIng = canonIng;

/**
 * The two things that are not about taste: what the law forbids this month,
 * and who at the table cannot eat any of it.
 *
 * A veda is a blocker, not a warning. Selling a species inside its closed
 * season is an offence, so it renders as one.
 */
function renderLegal(menu, month){
  var vbox = document.getElementById("vedaBox");
  var sbox = document.getElementById("seasonBox");
  var monthName = MONTHS[month - 1];

  var hits = vedaHitsFor(menu, month);
  if (!hits.length) vbox.innerHTML = "";
  else {
    var byVeda = {};
    hits.forEach(function(h){ (byVeda[h.veda.id] = byVeda[h.veda.id] || []).push(h); });
    vbox.innerHTML = Object.keys(byVeda).map(function(k){
      var g = byVeda[k], v = g[0].veda;
      var names = g.map(function(x){ return x.dish.name; }).join(", ");
      return "<div class='vedabox'><p class='lbl'>Veda \u00b7 this is the law, not a preference</p>" +
        "<p><strong>" + esc(v.species) + " is in veda in " + esc(monthName) + ".</strong> " +
        "Selling " + esc(names) + " that month is an offence, not a risk.</p>" +
        "<p class='muted'>" + esc(v.note) + "</p>" +
        "<p class='muted'>Dates move every year. Confirm the current resoluci\u00f3n ministerial " +
        "at gob.pe/produce before you quote.</p></div>";
    }).join("");
  }

  // Seasonal is a different kind of fact: poor and dear, not illegal.
  var blocked = {};
  INGS.forEach(function(i){
    if (i.yearRound || i.months.indexOf(month) > -1) return;
    i.dishes.forEach(function(id){ blocked[id] = (blocked[id] || []).concat([i.name]); });
  });
  var off = menu.filter(function(d){ return blocked[d.id]; });
  sbox.innerHTML = off.length
    // Split so each translatable phrase is its own text node: the dish names
    // in the middle stay English on purpose, and gluing them to the sentence
    // made the whole paragraph untranslatable.
    ? "<p class='muted' style='font-size:.86rem;margin:10px 0 0'><strong>" + off.length + " " +
      "<span>" + (off.length === 1 ? "dish out of window in" : "dishes out of window in") + "</span> " +
      "<span>" + esc(monthName) + "</span>:</strong> " +
      off.map(function(d){ return esc(d.name) + " (" + esc(blocked[d.id].join(", ")) + ")"; }).join("; ") +
      ". <span>Buyable, but poor and dear \u2014 see Season for what to swap in.</span></p>"
    : "";
}

function renderShop(menu, guests, tierId){
  var el = document.getElementById("shopBody");
  if (!menu.length || !(guests > 0)){ el.innerHTML = ""; return; }
  var s = buildShoppingList(menu, guests, tierId);
  var overs = s.scaled.filter(function(x){ return x.produced > x.needed; });

  el.innerHTML =
    "<div class='sec-head'><h2>The shop</h2><span class='pill-count tnum'>" +
      s.list.length + "</span></div>" +
    "<p class='lede' style='margin-top:6px;font-size:.94rem'>Every recipe scaled to this head " +
      "count and added up. Whole batches only \u2014 half a batch of shortbread is a different " +
      "biscuit \u2014 so some dishes make more than the event needs.</p>" +
    "<div class='tscroll' style='margin-top:16px'><table><thead><tr>" +
      "<th>Ingredient</th><th style='text-align:right'>Buy</th>" +
      "<th style='text-align:right'>Cost</th><th>For</th>" +
    "</tr></thead><tbody>" + s.list.map(function(r){
      return "<tr><td class='cap'>" + esc(marketName(r.key)) + "</td>" +
        "<td class='money tnum' style='font-weight:600'>" + esc(r.display) + "</td>" +
        "<td class='money tnum muted'>" + soles(r.soles) + "</td>" +
        "<td class='src'>" + esc(r.dishes.join(", ")) + "</td></tr>";
    }).join("") +
    "<tr><td colspan='2' style='font-weight:700'>Total ingredients</td>" +
      "<td class='money tnum' style='font-weight:700'>" + soles(s.total) + "</td>" +
      "<td class='src'>" + soles(Math.round((s.total/guests)*100)/100) + " per guest</td></tr>" +
    "</tbody></table></div>" +
    "<div class='sec-head' style='margin-top:28px'><h2>Batches to cook</h2></div>" +
    "<div class='tscroll'><table><thead><tr><th>Dish</th>" +
      "<th style='text-align:right'>Needed</th><th style='text-align:right'>Batches</th>" +
      "<th style='text-align:right'>Makes</th><th style='text-align:right'>Ingredients</th>" +
    "</tr></thead><tbody>" + s.scaled.map(function(x){
      var spare = x.produced - x.needed;
      return "<tr><td>" + esc(x.name) + "</td>" +
        "<td class='money tnum'>" + x.needed + "</td>" +
        "<td class='money tnum' style='font-weight:600'>" + x.batches + "</td>" +
        "<td class='money tnum'>" + x.produced +
          (spare > 0 ? " <span class='mono muted' style='font-size:10px'>+" + spare + "</span>" : "") + "</td>" +
        "<td class='money tnum muted'>" + soles(x.foodCost) + "</td></tr>";
    }).join("") + "</tbody></table></div>" +
    (overs.length
      ? "<p class='muted' style='font-size:.88rem;margin-top:12px'>" + overs.length +
        " dish" + (overs.length === 1 ? "" : "es") + " overproduce because a batch cannot be " +
        "split. Sell the surplus, or put it in the tasting boxes.</p>"
      : "");
}

// --- costing, mirroring lib/costing.ts + lib/scaling.ts -------------------
// A hand-port, like the quote maths. verify-standalone recomputes the same
// figures from the TypeScript and fails if the two drift.
var PREP_WORDS = ("chopped finely coarsely sliced diced grated softened melted cubed minced " +
  "crushed shredded peeled trimmed beaten whisked sifted soaked rinsed drained warmed cooled " +
  "room temperature roughly thinly thickly picked stripped halved quartered scored cleaned " +
  "boned skinned jointed filleted deseeded hulled zested juiced").split(" ");
var IRREGULAR = { leaves:"leaf", loaves:"loaf", knives:"knife", haggis:"haggis",
  asparagus:"asparagus", couscous:"couscous", tomatoes:"tomato", potatoes:"potato",
  berries:"berry", cherries:"cherry", anchovies:"anchovy", chives:"chive", peas:"pea",
  oats:"oat", greens:"green", molasses:"molasses" };

function singular(w){
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 3 && w.charAt(w.length-1) === "s" && w.slice(-2) !== "ss") return w.slice(0,-1);
  return w;
}
// Mirrors OR_OVERRIDE in lib/ingredient-key.ts. Without it, "lamb or beef
// stock" canonicalised to "lamb" here while the TypeScript said "lamb stock",
// and the shopping list asked the butcher for two litres of cordero.
var OR_OVERRIDE = { "lamb or beef stock": "lamb stock", "fish or light chicken stock": "fish stock" };

function canonIng(item){
  var t = String(item == null ? "" : item).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  var head = t.split(",")[0].trim().replace(/\s+/g, " ");
  if (OR_OVERRIDE[head]) return OR_OVERRIDE[head];
  t = t.split(",")[0].replace(/\([^)]*\)/g," ").split(/\bor\b/)[0].replace(/[^a-z0-9%\s-]/g," ");
  return t.split(/\s+/).filter(Boolean)
    .filter(function(w){ return PREP_WORDS.indexOf(w) === -1; })
    .map(singular).join(" ").trim();
}

var MASS = { g:1, gram:1, grams:1, kg:1000, kilo:1000 };
var VOL  = { ml:1, l:1000, litre:1000, litres:1000, liter:1000, liters:1000 };
var EACH_W = ["","batch","quantity","pack","tin","loaf","sheet","sheets","clove","cloves",
  "cob","cobs","stick","sticks","pod","pods","leaf","leaves"];
var BUNCH_W = ["bunch","bunches","handful","handfuls"];

function parseQty(q){
  var m = /^\s*([\d./]+)\s*(.*)$/.exec(q == null ? "" : q);
  if (!m) return null;
  var a;
  if (/^\d+\s*\/\s*\d+$/.test(m[1])){
    var f = m[1].split("/"); a = Number(f[0]) / Number(f[1]);
  } else a = Number(m[1]);
  if (!isFinite(a) || a <= 0) return null;
  var u = m[2].trim().toLowerCase().replace(/\.$/,"");
  if (MASS[u]) return { amount:a*MASS[u], base:"g" };
  if (VOL[u])  return { amount:a*VOL[u],  base:"ml" };
  if (u === "tbsp") return { amount:a*15, base:"ml" };
  if (u === "tsp")  return { amount:a*5,  base:"ml" };
  if (BUNCH_W.indexOf(u) > -1) return { amount:a, base:"bunch" };
  if (EACH_W.indexOf(u) > -1)  return { amount:a, base:"each" };
  return null;
}
function convertBase(m, target){
  if (m.base === target) return m.amount;
  var fluid = function(b){ return b === "g" || b === "ml"; };
  return (fluid(m.base) && fluid(target)) ? m.amount : null;
}
var PER_BASE = { kg:{b:"g",size:1000}, L:{b:"ml",size:1000},
                 each:{b:"each",size:1}, bunch:{b:"bunch",size:1} };

function portionsOf(yields){
  var ex = /(\d+)\s*(portions?|pieces?|servings?|slices?)/i.exec(yields);
  if (ex) return Number(ex[1]);
  var all = String(yields).match(/\d+(?:\.\d+)?/g);
  return all && all.length ? Math.max.apply(null, all.map(Number)) : null;
}

function costLine(qty, item, depth){
  depth = depth || 0;
  var raw = canonIng(item), key = ALIAS[raw] || raw;
  var out = { qty:qty, item:item, key:key, status:"costed", soles:0, nonFood:false };

  if (SUB_OF[raw] !== undefined){
    var v = costSub(SUB_OF[raw], qty, depth);
    if (v === null) return { qty:qty, item:item, key:key, status:"sub-preparation", soles:0, nonFood:false };
    out.soles = v; return out;
  }
  out.nonFood = SUNDRIES.indexOf(key) > -1;
  var price = out.nonFood ? SUNDRY_PRICES[key] : (PRICES[key] || SUB_PRICES[key]);
  if (!price){ out.status = "unpriced"; return out; }

  var m = parseQty(qty);
  if (!m){ out.status = "unreadable"; return out; }
  var spec = PER_BASE[price.per];
  var amt = convertBase(m, spec.b);
  if (amt === null && price.unitGrams){
    var counted = m.base === "each" || m.base === "bunch";
    var wanted  = spec.b === "each" || spec.b === "bunch";
    if (counted && !wanted) amt = m.amount * price.unitGrams;
    else if (!counted && wanted) amt = m.amount / price.unitGrams;
  }
  if (amt === null){ out.status = "unreadable"; return out; }
  out.soles = (amt / spec.size) * price.soles;
  return out;
}

function recipeFor(id){
  for (var i = 0; i < RECIPES.length; i++) if (RECIPES[i].dishId === id) return RECIPES[i];
  return null;
}
function costRecipe(r, depth){
  depth = depth || 0;
  var lines = r.ingredients.map(function(i){ return costLine(i.qty, i.item, depth); });
  var food = 0, sundry = 0;
  lines.forEach(function(l){
    if (l.status !== "costed") return;
    if (l.nonFood) sundry += l.soles; else food += l.soles;
  });
  var portions = portionsOf(r.yields);
  return { dishId:r.dishId, portions:portions, lines:lines,
    foodTotal:Math.round(food*100)/100, sundryTotal:Math.round(sundry*100)/100,
    perPortion: portions > 0 ? Math.round((food/portions)*100)/100 : null };
}
function batchWeight(r){
  var g = 0;
  r.ingredients.forEach(function(i){
    var m = parseQty(i.qty); if (!m) return;
    var v = convertBase(m, "g"); if (v !== null) g += v;
  });
  return g > 0 ? g : null;
}
function costSub(dishId, qty, depth){
  if (depth >= 3) return null;
  var sub = recipeFor(dishId); if (!sub) return null;
  var c = costRecipe(sub, depth + 1);
  if (c.foodTotal <= 0) return null;
  var m = parseQty(qty); if (!m) return null;
  if (m.base === "each") return c.foodTotal * m.amount;
  var bw = batchWeight(sub); if (bw === null) return null;
  var g = convertBase(m, "g");
  return g === null ? null : c.foodTotal * (g / bw);
}

// Real cost per portion for every dish, computed once.
var REAL_COST = {};
RECIPES.forEach(function(r){
  var c = costRecipe(r);
  if (c.perPortion !== null) REAL_COST[r.dishId] = c.perPortion;
});

function scaleQty(qty, factor){
  var m = parseQty(qty); if (!m) return qty;
  var parts = /^\s*([\d./]+)\s*(.*)$/.exec(qty); if (!parts) return qty;
  var unit = parts[2].trim(), written;
  if (parts[1].indexOf("/") > -1){
    var f = parts[1].split("/"); written = Number(f[0]) / Number(f[1]);
  } else written = Number(parts[1]);
  if (!isFinite(written) || written <= 0) return qty;
  var scaled = written * factor;
  if (m.base === "each" && !unit) return String(Math.ceil(scaled));
  if (m.base === "bunch" || m.base === "each") return Math.ceil(scaled) + (unit ? " " + unit : "");
  var r = scaled >= 100 ? Math.round(scaled) : Math.round(scaled*10)/10;
  return unit ? r + " " + unit : String(r);
}

function portionsNeeded(dish, menu, guests, tierId){
  if (dish.category !== "canape") return guests;
  var n = menu.filter(function(d){ return d.category === "canape"; }).length || 1;
  return Math.ceil((guests * TIERS[tierId].bitesPerGuest) / n);
}

function displayAmount(a, base){
  function r(n){ return n >= 100 ? Math.round(n) : Math.round(n*10)/10; }
  if (base === "g")  return a >= 1000 ? r(a/1000) + " kg" : r(a) + " g";
  if (base === "ml") return a >= 1000 ? r(a/1000) + " L"  : r(a) + " ml";
  if (base === "bunch") return Math.ceil(a) + " bunch";
  return String(Math.ceil(a));
}

/** Scale a menu to a head count and add the lines up into one shop. */
function buildShoppingList(menu, guests, tierId){
  var scaled = [], rows = {};
  menu.forEach(function(d){
    var r = recipeFor(d.id); if (!r) return;
    var need = portionsNeeded(d, menu, guests, tierId);
    var yieldSize = portionsOf(r.yields) || 1;
    var batches = Math.max(1, Math.ceil(need / yieldSize));
    var lines = r.ingredients.map(function(i){
      return { qty: scaleQty(i.qty, batches), item: i.item };
    });
    var food = 0;
    lines.forEach(function(l){
      var c = costLine(l.qty, l.item);
      if (c.status === "costed" && !c.nonFood) food += c.soles;
      var key = canonIng(l.item), m = parseQty(l.qty);
      if (!m) return;
      var row = rows[key];
      if (!row){
        rows[key] = { key:key, amount:m.amount, base:m.base,
          soles: c.status === "costed" ? c.soles : 0, dishes:[d.name] };
        return;
      }
      var v = convertBase(m, row.base);
      if (v === null) return;
      row.amount += v;
      if (c.status === "costed") row.soles += c.soles;
      if (row.dishes.indexOf(d.name) === -1) row.dishes.push(d.name);
    });
    scaled.push({ dishId:d.id, name:d.name, needed:need, batches:batches,
      produced: batches * yieldSize, foodCost: Math.round(food*100)/100 });
  });
  var list = Object.keys(rows).map(function(k){
    var r = rows[k];
    r.display = displayAmount(r.amount, r.base);
    r.soles = Math.round(r.soles*100)/100;
    return r;
  }).sort(function(a,b){ return b.soles - a.soles; });
  return { scaled:scaled, list:list,
    total: Math.round(list.reduce(function(s,r){ return s + r.soles; },0)*100)/100 };
}

// --- dietary, mirroring lib/dietary.ts ------------------------------------
// Derived from the recipe's own ingredient lines, never from the dish text.
// An ingredient nobody has classified invalidates the answer rather than
// shading it: suits comes back empty and the card says why.
var PLAIN_SET = {};
PLAIN.forEach(function(k){ PLAIN_SET[k] = 1; });

function attrsFor(key){
  if (ATTRS[key]) return ATTRS[key];
  if (PLAIN_SET[key]) return {};
  return null;
}

function collectKeys(recipe, depth, seen){
  depth = depth || 0; seen = seen || {};
  var out = { keys: [], unknown: [] };
  if (depth > 3 || seen[recipe.dishId]) return out;
  seen[recipe.dishId] = 1;
  recipe.ingredients.forEach(function(ing){
    var key = canonIng(ing.item);
    if (SUB_OF[key] !== undefined){
      var sub = recipeFor(SUB_OF[key]);
      if (sub){
        var inner = collectKeys(sub, depth + 1, seen);
        out.keys = out.keys.concat(inner.keys);
        out.unknown = out.unknown.concat(inner.unknown);
        return;
      }
    }
    if (attrsFor(key) === null) out.unknown.push(key); else out.keys.push(key);
  });
  return out;
}

function dishDietary(recipe){
  var got = collectKeys(recipe);
  var allergens = {}, because = {};
  function blame(diet, key){
    if (!because[diet]) because[diet] = [];
    if (because[diet].indexOf(key) === -1) because[diet].push(key);
  }
  var vegetarian = true, vegan = true, hasMeat = false;

  got.keys.forEach(function(key){
    var a = attrsFor(key) || {};
    (a.allergens || []).forEach(function(al){ allergens[al] = 1; });
    var isVeg = a.vegetarian === undefined ? true : a.vegetarian;
    var isVegan = a.vegan === undefined ? isVeg : a.vegan;
    if (!isVeg){
      vegetarian = false; blame("vegetarian", key);
      var al = a.allergens || [];
      var aquatic = al.indexOf("fish") > -1 || al.indexOf("crustaceans") > -1 || al.indexOf("molluscs") > -1;
      if (!aquatic) hasMeat = true;
    }
    if (!isVegan){ vegan = false; blame("vegan", key); }
    var al2 = a.allergens || [];
    if (al2.indexOf("gluten") > -1) blame("gluten-free", key);
    if (al2.indexOf("milk") > -1) blame("dairy-free", key);
    if (al2.indexOf("nuts") > -1 || al2.indexOf("peanuts") > -1) blame("nut-free", key);
    if (al2.indexOf("pork") > -1) blame("no-pork", key);
    if (al2.indexOf("alcohol") > -1) blame("no-alcohol", key);
    if (a.sugary) blame("lower-sugar", key);
    if (a.hot) blame("kid-friendly", key);
    if (a.hardTexture) blame("soft-texture", key);
  });

  // Kosher forbids meat and dairy together, which is a property of the
  // combination rather than of any one ingredient.
  var hasFlesh = got.keys.some(function(k){
    var a = attrsFor(k);
    if (!a || (a.vegetarian === undefined ? true : a.vegetarian)) return false;
    var al = a.allergens || [];
    return al.indexOf("fish") === -1 && al.indexOf("crustaceans") === -1 && al.indexOf("molluscs") === -1;
  });
  var hasDairy = got.keys.some(function(k){
    return ((attrsFor(k) || {}).allergens || []).indexOf("milk") > -1;
  });
  if (hasFlesh && hasDairy) blame("kosher-ingredients", "meat and dairy in one dish");
  got.keys.forEach(function(k){
    var al = ((attrsFor(k) || {}).allergens) || [];
    if (al.indexOf("pork") > -1){ blame("halal-ingredients", k); blame("kosher-ingredients", k); }
    if (al.indexOf("alcohol") > -1) blame("halal-ingredients", k);
    if (al.indexOf("crustaceans") > -1 || al.indexOf("molluscs") > -1) blame("kosher-ingredients", k);
    if (FODMAP.indexOf(k) > -1) blame("low-fodmap", k);
    if (CARB.indexOf(k) > -1) blame("lower-carb", k);
  });

  if (HARD_DISHES.indexOf(recipe.dishId) > -1) blame("soft-texture", "hard or crisp as served");
  if (NO_KIDS.indexOf(recipe.dishId) > -1) blame("kid-friendly", "skewered, boned or offal");
  if (because["no-alcohol"]) because["no-alcohol"].forEach(function(k){ blame("kid-friendly", k); });

  var suits = [];
  function ok(d){ return !because[d]; }
  if (vegetarian) suits.push("vegetarian");
  if (vegan && vegetarian) suits.push("vegan");
  if (!hasMeat) suits.push("pescatarian");
  ["gluten-free","dairy-free","nut-free","no-pork","no-alcohol",
   "halal-ingredients","kosher-ingredients","low-fodmap","lower-carb",
   "lower-sugar","kid-friendly","soft-texture"].forEach(function(d){ if (ok(d)) suits.push(d); });

  return {
    dishId: recipe.dishId,
    allergens: Object.keys(allergens).sort(),
    suits: got.unknown.length ? [] : suits,
    because: because,
    unknown: got.unknown
  };
}

// Computed once. Every dish, every diet.
// Exposed so verify-standalone can hold this port to lib/dietary.ts.
var DIET_INDEX = {};
RECIPES.forEach(function(r){ DIET_INDEX[r.dishId] = dishDietary(r); });

/*
 * Which dishes a tier can carry. Mirrors lib/tiers.ts.
 *
 * Three tiers read the dish's own tiers column. Two are derived: the Wee
 * Feast is kid-friendly box food with no alcohol in it at all — the licence
 * flag is about SELLING alcohol, but a children's party is not a licensing
 * question — and the Ceilidh Table carries anything that can be plated.
 */
function fitsTier(d, tier){
  if (tier === "ceilidh") return d.tiers.indexOf("plated") > -1;
  if (tier === "ninos"){
    if (d.tiers.indexOf("scran") === -1) return false;
    if (d.needsLicence) return false;
    var p = DIET_INDEX[d.id];
    // No recipe written yet, or an ingredient nobody has classified: claims
    // nothing. "Probably fine for children" is not an answer.
    if (!p || p.unknown.length) return false;
    return p.suits.indexOf("kid-friendly") > -1;
  }
  return d.tiers.indexOf(tier) > -1;
}
function dishesAtTier(tier){ return DISHES.filter(function(d){ return fitsTier(d, tier); }); }
window.__dietIndex = DIET_INDEX;
// Read by scripts/verify-standalone.mjs so the tier count is never pinned here.
window.__tiers = TIERS;

function dietLabel(id){
  for (var i = 0; i < DIETS.length; i++) if (DIETS[i][0] === id) return DIETS[i][1];
  return id;
}
function dietNote(id){
  for (var i = 0; i < DIETS.length; i++) if (DIETS[i][0] === id) return DIETS[i][2];
  return "";
}
function suitsAll(dishId, diets){
  if (!diets.length) return true;
  var p = DIET_INDEX[dishId];
  if (!p) return false;
  for (var i = 0; i < diets.length; i++) if (p.suits.indexOf(diets[i]) === -1) return false;
  return true;
}

// --- vedas, mirroring lib/vedas.ts ----------------------------------------
function vedaHitsFor(dishes, month){
  var hits = [];
  dishes.forEach(function(d){
    var r = recipeFor(d.id); if (!r) return;
    var keys = r.ingredients.map(function(i){ return canonIng(i.item); });
    VEDAS.forEach(function(v){
      if (v.closed.indexOf(month) === -1) return;
      for (var i = 0; i < v.ingredientKeys.length; i++){
        if (keys.indexOf(v.ingredientKeys[i]) > -1){
          hits.push({ veda: v, dish: d, ingredient: v.ingredientKeys[i] });
          return;
        }
      }
    });
  });
  return hits;
}

function renderSubs(offIds, month){
  var el = document.getElementById("seasonSubs");
  if (!offIds.length){ el.innerHTML = ""; return; }

  var rows = offIds.map(function(id){
    var d = DISHES.filter(function(x){ return x.id === id; })[0];
    if (!d) return null;
    return { dish: d, because: blockedBecause(month, id), options: substitutesFor(d, month) };
  }).filter(Boolean);

  // The ones with no answer are the actual work, so they go first.
  rows.sort(function(a, b){
    return a.options.length - b.options.length || b.dish.price - a.dish.price;
  });
  var stuck = rows.filter(function(r){ return !r.options.length; });

  el.innerHTML =
    "<div class='sec-head'><h2>What to put there instead</h2>" +
      "<span class='pill-count tnum'>" + rows.length + "</span></div>" +
    "<p class='lede' style='margin-top:6px;font-size:.94rem'>" + rows.length + " <span>dishes are out of " +
      "window in</span> <span>" + esc(MONTHS[month-1]) + "</span>, and <strong>" + stuck.length + "</strong> <span>of them have " +
      "nothing that can stand in. Those are the ones worth your morning. A substitute has to taste " +
      "like the original, be in season now, cost about the same, and need no more service than the " +
      "dish it replaces &mdash; so where there is no answer, it says so rather than inventing one.</p>" +
    "<div class='tscroll' style='margin-top:16px'><table><thead><tr>" +
      "<th>Off the menu</th><th>Because</th><th>Put this there instead</th>" +
    "</tr></thead><tbody>" + rows.map(function(r){
      var opts = r.options.length
        ? r.options.map(function(o){
            return "<div style='margin-bottom:6px'><strong>" + esc(o.dish.name) + "</strong> " +
              "<span class='mono muted' style='font-size:10.5px'>" + esc(mark(o.reasons.join(" \u00b7 "))) +
              "</span></div>";
          }).join("")
        : "<span class='fc over'>nothing fits &mdash; cook something new or drop the course</span>";
      return "<tr><td><strong>" + esc(r.dish.name) + "</strong><br>" +
        "<span class='src'><span>" + esc(LABELS[r.dish.category]) + "</span> \u00b7 " +
          soles(r.dish.price) + "</span></td>" +
        "<td class='src'>" + esc(r.because.join(", ")) + "</td>" +
        "<td>" + opts + "</td></tr>";
    }).join("") + "</tbody></table></div>";
}

// --- capacity, mirroring lib/capacity.ts ----------------------------------
// conflicts.ts asks whether one menu can be cooked. This asks whether a DAY
// can be delivered.
var KIT = { planchas: 1, fryers: 1, ovens: 1, vans: 1, crew: 4, maxShiftMinutes: 12 * 60 };

var BOOKINGS = [
  { id: "A", hour: 13, durationMinutes: 120, guests: 40, tier: "buffet",
    distIdx: 1, venueIdx: 0, live: true },
  { id: "B", hour: 20, durationMinutes: 180, guests: 60, tier: "plated",
    distIdx: 5, venueIdx: 0, live: true }
];

function bookingWindow(b){
  var t = transportCost(b.tier, DISTRICTS[b.distIdx], VENUES[b.venueIdx], true, false);
  var oneWay = t.driveMinutes / 2;
  var setup = 60 + VENUES[b.venueIdx].crewMinutes;
  return {
    out: b.hour * 60 - oneWay - setup,
    back: b.hour * 60 + b.durationMinutes + 45 + oneWay
  };
}
function crewNeeded(b){
  var t = TIERS[b.tier];
  var waiters = t.guestsPerWaiter > 0 ? Math.ceil(b.guests / t.guestsPerWaiter) : 0;
  return waiters + t.chefs + TRIP.loadCrew[b.tier];
}
function clashesForDay(bookings){
  var clashes = [];
  var wins = bookings.map(bookingWindow);

  bookings.forEach(function(b, i){
    var len = wins[i].back - wins[i].out;
    if (len > KIT.maxShiftMinutes){
      clashes.push({ kind: "shift", ids: [b.id],
        detail: "Booking " + b.id + " runs " + (len/60).toFixed(1) + " hours door to door, past " +
          "the " + (KIT.maxShiftMinutes/60) + "-hour limit. " + DISTRICTS[b.distIdx].name +
          " at peak is most of it." });
    }
  });

  for (var i = 0; i < bookings.length; i++){
    for (var j = i + 1; j < bookings.length; j++){
      var a = bookings[i], b2 = bookings[j];
      if (!(wins[i].out < wins[j].back && wins[j].out < wins[i].back)) continue;
      if ((a.live ? 1 : 0) + (b2.live ? 1 : 0) > KIT.planchas){
        clashes.push({ kind: "equipment", ids: [a.id, b2.id],
          detail: mark(LANG === "es"
            ? "Ambos necesitan la plancha y usted tiene " + KIT.planchas + ". Sus ventanas se superponen."
            : "Both need the plancha and you own " + KIT.planchas + ". Their windows overlap.") });
      }
      var need = crewNeeded(a) + crewNeeded(b2);
      if (need > KIT.crew){
        clashes.push({ kind: "crew", ids: [a.id, b2.id],
          detail: mark(LANG === "es"
            ? need + " personas necesarias entre ambos a la vez; usted tiene " + KIT.crew +
              ". Contrate " + (need - KIT.crew) + " más o mueva un evento."
            : need + " people needed across both at once; you have " + KIT.crew +
              ". Hire " + (need - KIT.crew) + " more or move one booking.") });
      }
      if (KIT.vans < 2){
        clashes.push({ kind: "van", ids: [a.id, b2.id],
          detail: mark(LANG === "es"
            ? "Una sola camioneta no puede montar en " + DISTRICTS[a.distIdx].name + " y " +
              DISTRICTS[b2.distIdx].name + " en la misma ventana."
            : "One van cannot load in at " + DISTRICTS[a.distIdx].name + " and " +
              DISTRICTS[b2.distIdx].name + " in the same window.") });
      }
    }
  }
  return clashes;
}

function clock(mins){
  var m = ((mins % 1440) + 1440) % 1440;
  return String(Math.floor(m/60)).padStart(2,"0") + ":" + String(Math.round(m%60)).padStart(2,"0");
}

function renderDay(){
  document.getElementById("kitRow").innerHTML =
    [["planchas","Planchas"],["fryers","Fryers"],["vans","Vans"],["crew","Crew"]].map(function(k){
      return "<label class='chip' style='cursor:default'><span>" + esc(L(k[1])) + "</span>" +
        " <input type='number' min='0' max='20' value='" + KIT[k[0]] + "' data-kit='" + k[0] + "' " +
        "style='width:46px;margin-left:6px;border:0;background:transparent;color:inherit;font:inherit'></label>";
    }).join("");

  document.getElementById("bookingForms").innerHTML = BOOKINGS.map(function(b, i){
    var w = bookingWindow(b);
    return "<div class='card'><h2 class='h-sm' style='margin:0 0 10px'><span>Booking</span> " + b.id + "</h2>" +
      "<div style='display:flex;flex-wrap:wrap;gap:10px'>" +
        "<label class='src'>Service<input type='time' data-bk='" + i + "' data-f='hour' " +
          "value='" + clock(b.hour*60) + "' style='display:block;margin-top:4px'></label>" +
        "<label class='src'>Guests<input type='number' min='1' max='400' data-bk='" + i + "' " +
          "data-f='guests' value='" + b.guests + "' style='display:block;margin-top:4px;width:70px'></label>" +
        "<label class='src'>District<select data-bk='" + i + "' data-f='distIdx' style='display:block;margin-top:4px'>" +
          DISTRICTS.map(function(d, k){ return "<option value='" + k + "'" + (k===b.distIdx?" selected":"") +
            ">" + esc(d.name) + "</option>"; }).join("") + "</select></label>" +
        "<label class='src'>Tier<select data-bk='" + i + "' data-f='tier' style='display:block;margin-top:4px'>" +
          Object.keys(TIERS).map(function(t){ return "<option value='" + t + "'" + (t===b.tier?" selected":"") +
            ">" + esc(TIERS[t].name) + "</option>"; }).join("") + "</select></label>" +
        "<label class='src' style='display:flex;align-items:center;gap:6px;margin-top:18px'>" +
          "<input type='checkbox' data-bk='" + i + "' data-f='live'" + (b.live?" checked":"") + "> live station</label>" +
      "</div>" +
      "<p class='src wrap-ok' style='margin:12px 0 0'><span>Crew out</span> <strong>" + clock(w.out) +
        "</strong> · <span>back</span> <strong>" + clock(w.back) + "</strong> · " +
        ((w.back - w.out)/60).toFixed(1) + " <span>hours</span> · <span>needs</span> " +
        crewNeeded(b) + " <span>people</span></p>" +
      "</div>";
  }).join("");

  var clashes = clashesForDay(BOOKINGS);
  var el = document.getElementById("dayVerdict");
  if (!clashes.length){
    el.innerHTML = "<div class='card' style='border-color:var(--good)'>" +
      "<h2 style='margin:0 0 6px;color:var(--good)'>Yes — the day is deliverable</h2>" +
      "<p class='lede' style='margin:0'>Both bookings fit the kit you own. Nothing overlaps that " +
      "cannot overlap.</p></div>";
    return;
  }
  el.innerHTML = "<div class='card' style='border-color:var(--bad)'>" +
    "<h2 style='margin:0 0 4px;color:var(--bad)'><span>No</span> — " + clashes.length + " " +
      "<span>" + (clashes.length===1 ? "thing stops this day" : "things stop this day") + "</span></h2>" +
    "<p class='lede' style='margin:0 0 12px'>Each of these is physical: kit you do not own, or " +
      "people who cannot be in two places.</p>" +
    clashes.map(function(c){
      return "<div style='border-left:3px solid var(--bad);padding:6px 0 6px 11px;margin-bottom:9px'>" +
        "<p class='mono' style='margin:0;font-size:10px;letter-spacing:.08em;text-transform:uppercase;" +
        "color:var(--bad)'><span>" + esc(c.kind) + "</span> · " + esc(c.ids.join(" + ")) + "</p>" +
        "<p style='margin:2px 0 0;font-size:.88rem'>" + esc(c.detail) + "</p></div>";
    }).join("") + "</div>";
}

document.getElementById("kitRow").addEventListener("input", function(e){
  var f = e.target.dataset.kit; if (!f) return;
  KIT[f] = Math.max(0, Number(e.target.value) || 0);
  renderDay();
});
document.getElementById("bookingForms").addEventListener("input", function(e){
  var i = e.target.dataset.bk; if (i === undefined) return;
  var b = BOOKINGS[Number(i)], f = e.target.dataset.f;
  if (f === "hour"){ var hm = e.target.value.split(":"); b.hour = Number(hm[0]) + Number(hm[1])/60; }
  else if (f === "live") b.live = e.target.checked;
  else if (f === "tier") b.tier = e.target.value;
  else b[f] = Number(e.target.value);
  renderDay();
});

// --- substitution, mirroring lib/substitution.ts --------------------------
// A substitute has to pass four tests at once: taste like the original, be in
// season this month, cost about the same, and need no more service than the
// dish it replaces. Nothing rather than something wrong - a menu hole you can
// see beats a swap that moves the quote or breaks a diet.
var FORMAT_DEMAND = { "drop-off": 0, buffet: 1, plated: 2, "live-station": 3 };

function offMenuSet(month){
  var blocked = {};
  INGS.forEach(function(i){
    if (i.yearRound || i.months.indexOf(month) > -1) return;
    i.dishes.forEach(function(id){ blocked[id] = 1; });
  });
  return blocked;
}
function blockedBecause(month, dishId){
  return INGS.filter(function(i){
    return !i.yearRound && i.months.indexOf(month) === -1 && i.dishes.indexOf(dishId) > -1;
  }).map(function(i){ return i.name; });
}
function jaccard(a, b){
  if (!a.length && !b.length) return 1;
  var shared = a.filter(function(x){ return b.indexOf(x) > -1; }).length;
  var union = a.concat(b.filter(function(x){ return a.indexOf(x) === -1; })).length;
  return union === 0 ? 0 : shared / union;
}

function substitutesFor(target, month, tolerance, wantDiets, limit){
  tolerance = tolerance === undefined ? 0.25 : tolerance;
  var blocked = offMenuSet(month);
  var tf = FLAV[target.id] || [];
  var out = [];

  DISHES.forEach(function(d){
    if (d.id === target.id || blocked[d.id]) return;
    if (d.category !== target.category) return;
    if (FORMAT_DEMAND[d.format] > FORMAT_DEMAND[target.format]) return;
    var shift = (d.price - target.price) / target.price;
    if (Math.abs(shift) > tolerance) return;
    if (wantDiets && wantDiets.length && !suitsAll(d.id, wantDiets)) return;
    var match = jaccard(tf, FLAV[d.id] || []);
    if (match === 0) return;

    // Built from translated parts rather than translated as a sentence: the
    // flavour axes and the origin are already in the dictionary, and the word
    // order differs between the two languages.
    var es = LANG === "es";
    var reasons = [];
    var shared = (FLAV[d.id] || []).filter(function(f){ return tf.indexOf(f) > -1; });
    if (shared.length) reasons.push((es ? "comparte " : "shares ") +
      shared.map(L).join(", "));
    reasons.push(Math.abs(shift) < 0.02 ? (es ? "mismo precio" : "same price")
      : (shift > 0 ? "+" : "") + Math.round(shift * 100) + "% " +
        (es ? "sobre el precio de carta" : "on the menu price"));
    if (d.subOrigin === target.subOrigin) reasons.push(es
      ? "misma línea " + L(d.subOrigin).toLowerCase()
      : "same " + d.subOrigin + " line");
    reasons.forEach(mark);

    out.push({ dish: d, match: match, shift: shift, reasons: reasons,
      score: match * 0.7 + (1 - Math.abs(shift) / tolerance) * 0.25 +
             (d.subOrigin === target.subOrigin ? 0.05 : 0) });
  });

  out.sort(function(a, b){ return b.score - a.score; });
  return out.slice(0, limit || 4);
}

// --- transport, mirroring lib/venues.ts ----------------------------------
function transportCost(tierId, district, venue, peak, liveStation){
  var oneWay = district.driveMinutes + (peak ? district.peakExtra : 0);
  var trips = TRIP.vanTrips[tierId];
  var driveMinutes = oneWay * 2 * trips;
  var vanCost = (driveMinutes / 60) * TRIP.vanHourly;
  var fuelCost = district.km * 2 * trips * TRIP.perKm;
  var crew = TRIP.loadCrew[tierId];
  var crewMinutes = venue.crewMinutes * 2 * trips * crew;
  var crewCost = (crewMinutes / 60) * TRIP.crewHourly;

  var lines = [
    { label:"Van \u2014 " + trips + " run" + (trips===1?"":"s") + ", " + Math.round(driveMinutes) + " min driving", total:vanCost },
    { label:"Fuel \u2014 " + (district.km*2*trips) + " km", total:fuelCost }
  ];
  var warnings = [];
  if (crewCost > 0) lines.push({ label:"Load-in crew \u2014 " + crew + " \u00d7 " + Math.round(crewMinutes/crew) + " min", total:crewCost });
  if (liveStation && !venue.hasPower){
    lines.push({ label:"Generator hire \u2014 no mains power on site", total:TRIP.generator });
    warnings.push(venue.name + " has no mains power. A live station needs a generator, priced in above.");
  }
  if (!venue.hasKitchen && tierId === "plated"){
    warnings.push(venue.name + " has no kitchen. Plated service here means everything finishes off a hot box \u2014 check the menu holds.");
  }
  if (oneWay >= 60){
    warnings.push(district.name + " is " + oneWay + " minutes each way" + (peak?" in traffic":"") + ". Cold-chain and crew hours both need checking before quoting.");
  }
  var total = lines.reduce(function(a,l){ return a + l.total; }, 0);
  return { total:Math.round(total*100)/100, lines:lines, driveMinutes:driveMinutes, warnings:warnings };
}

// --- quote maths, mirroring lib/pricing.ts -------------------------------
function buildQuote(dishes, guests, tierId, ctx){
  var t = TIERS[tierId], warnings = [];
  if (!dishes.length || !(guests > 0)) return null;
  if (guests < t.minGuests)
    warnings.push(t.name + " has a " + t.minGuests + "-guest minimum; this quote is for " + guests + ".");

  var canapes = dishes.filter(function(d){ return d.category === "canape"; });
  var plates  = dishes.filter(function(d){ return d.category !== "canape"; });
  var value = 0, cost = 0;
  if (canapes.length){
    var av = canapes.reduce(function(s,d){ return s + d.price; }, 0) / canapes.length;
    var ac = canapes.reduce(function(s,d){ return s + d.cost;  }, 0) / canapes.length;
    value += av * t.bitesPerGuest; cost += ac * t.bitesPerGuest;
  }
  plates.forEach(function(d){ value += d.price; cost += d.cost; });

  var waiters = t.guestsPerWaiter > 0 ? Math.ceil(guests / t.guestsPerWaiter) : 0;
  var staffTotal = waiters * K.STAFF + t.chefs * K.CHEF;
  // Transport is costed against the real venue when one is set.
  var tLine;
  if (ctx && ctx.district && ctx.venue){
    var live = dishes.some(function(d){ return d.format === "live-station"; });
    var tc = transportCost(tierId, ctx.district, ctx.venue, ctx.peak, live);
    tLine = { label:"Transport & load-in \u2014 " + ctx.district.name + ", " + ctx.venue.name,
              perGuest: tc.total/guests, total: tc.total };
    warnings = warnings.concat(tc.warnings);
  } else {
    tLine = { label:"Transport & load-in (flat estimate \u2014 no venue set)",
              perGuest: t.transport/guests, total: t.transport };
  }
  var lines = [
    { label:"Menaje hire", perGuest:t.menajePerGuest, total:t.menajePerGuest*guests },
    { label:"Packaging",   perGuest:t.packagingPerGuest, total:t.packagingPerGuest*guests },
    { label: waiters > 0
        ? "Staff — " + waiters + " waiter" + (waiters===1?"":"s") + ", " + t.chefs + " chef"
        : "Staff — " + t.chefs + " chef",
      perGuest: staffTotal/guests, total: staffTotal },
    tLine
  ].filter(function(l){ return l.total > 0; });

  var svc = lines.reduce(function(s,l){ return s + l.perGuest; }, 0);
  var net = value + svc, netTotal = net * guests;
  var igv = netTotal * K.IGV;
  var contrib = net - cost - svc;

  var over = dishes.filter(function(d){ return flag(d) === "over"; });
  if (over.length) warnings.push(over.length + " dish" + (over.length===1?"":"es") +
    " above the 30% food-cost ceiling: " + over.map(function(d){ return d.name; }).join(", "));

  return { tier:t, guests:guests, menuValuePerGuest:value, foodCostPerGuest:cost,
    serviceLines:lines, serviceCostPerGuest:svc, netPerGuest:net, netTotal:netTotal,
    igvTotal:igv, grossTotal:netTotal+igv, contributionPerGuest:contrib,
    contributionTotal:contrib*guests, contributionRatio: net>0 ? contrib/net : 0,
    warnings:warnings };
}

// --- language ------------------------------------------------------------
// Rather than thread a key through every string in the page, the dictionary
// is applied over the rendered DOM after each paint. A string absent from it
// stays English and is visibly so - which is what makes the coverage figure
// below honest rather than assumed.
var LANG = "es";
try { LANG = localStorage.getItem("ayesicena-lang") || "es"; } catch (e) { LANG = "es"; }
// Before anything renders. This used to run at the very end of the file,
// after the season card and the ingredient graph had already been built from
// the English month names — so the season page showed "Mar, Apr, May" in
// Spanish and nobody could see why.
localiseLabels();

// Text nodes inside these never get touched: dish names, supplier names and
// the numbers are the same in both languages.
// A textarea holds a message the user is about to send, already written in
// their language. The walker must not go near it.
var NO_TRANSLATE = "SCRIPT,STYLE,CODE,TEXTAREA".split(",");

function translateNode(root){
  if (LANG !== "es") return;
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  var n, hits = 0, misses = 0;
  var pending = [];
  while ((n = walker.nextNode())){
    var parent = n.parentElement;
    if (!parent || NO_TRANSLATE.indexOf(parent.tagName) > -1) continue;
    var raw = n.nodeValue;
    var key = raw.replace(/\s+/g, " ").trim();
    // Any run of letters is a candidate; the dictionary decides. This used to
    // demand three letters, which meant "of", "at" and "on" could never be
    // translated no matter what the dictionary said.
    if (!key || !/[a-zA-Z]/.test(key)) continue;
    var direct = ES[key];
    if (direct === undefined) direct = patternTranslate(key);
    if (direct !== undefined && direct !== null){
      // The key is whitespace-normalised, but the node is not: markup wraps
      // long sentences across lines. Replacing the key inside the raw value
      // found nothing, so every multi-line string silently stayed English.
      // Swap the whole value instead, keeping the surrounding whitespace.
      var lead = /^\s*/.exec(raw)[0];
      var trail = /\s*$/.exec(raw)[0];
      pending.push([n, lead + direct + trail]);
      hits++;
    } else misses++;
  }
  // Mutating while walking invalidates the walker, so apply afterwards.
  pending.forEach(function(x){
    x[0].nodeValue = x[1];
    APPLIED[x[1].replace(/\s+/g, " ").trim()] = 1;
  });
  LANG_STATS = { hits: hits, misses: misses };
}
var LANG_STATS = { hits: 0, misses: 0 };
// Every string this layer produced, so coverage can be measured exactly
// rather than inferred by re-deriving the patterns.
var APPLIED = {};
window.__i18nApplied = APPLIED;

/** Attributes carry visible text too - placeholders and labels. */
function translateAttrs(root){
  if (LANG !== "es") return;
  ["placeholder", "aria-label", "title"].forEach(function(a){
    [].forEach.call(root.querySelectorAll("[" + a + "]"), function(el){
      var v = el.getAttribute(a);
      if (ES[v] !== undefined) el.setAttribute(a, ES[v]);
    });
  });
}

function localiseLabels(){
  if (LANG !== "es") return;
  Object.keys(LABELS).forEach(function(k){ if (ES[LABELS[k]]) LABELS[k] = ES[LABELS[k]]; });
  Object.keys(FORMATS).forEach(function(k){ if (ES[FORMATS[k]]) FORMATS[k] = ES[FORMATS[k]]; });
  MONTHS.forEach(function(m, i){ if (ES[m]) MONTHS[i] = ES[m]; });
  // AXES are deliberately not translated - they are ids, and the flavour
  // wheel labels them separately. There used to be a loop here that assigned
  // each element to itself, which looked deliberate and did nothing.
}

function applyLanguage(){
  document.documentElement.lang = LANG;
  var btn = document.getElementById("langBtn");
  if (btn) btn.textContent = LANG === "es" ? "EN" : "ES";
  if (LANG === "es"){
    translateNode(document.body);
    translateAttrs(document);
  }
}

/**
 * Every pane repaints itself with innerHTML on interaction, which would undo
 * the translation. Watching the document catches all of them - including any
 * render function added later - rather than needing a call at the end of each.
 *
 * translateNode mutates text, which fires the observer again, so a re-entrancy
 * flag is what stops this looping forever.
 */
var translating = false;
var langObserver = new MutationObserver(function(records){
  if (LANG !== "es" || translating) return;
  translating = true;
  try {
    records.forEach(function(rec){
      [].forEach.call(rec.addedNodes, function(node){
        if (node.nodeType === 1) { translateNode(node); translateAttrs(node); }
        else if (node.nodeType === 3 && node.parentElement) translateNode(node.parentElement);
      });
    });
  } finally {
    // Let the mutations we just caused drain before listening again.
    setTimeout(function(){ translating = false; }, 0);
  }
});
langObserver.observe(document.body, { childList: true, subtree: true });

document.getElementById("langBtn").addEventListener("click", function(){
  LANG = (LANG === "es") ? "en" : "es";
  try { localStorage.setItem("ayesicena-lang", LANG); } catch (e) {}
  // Swapping back to English means re-rendering from source, since the
  // translation is destructive to the DOM text.
  location.reload();
});

// --- tabs ----------------------------------------------------------------
var tabs = [].slice.call(document.querySelectorAll(".tab"));
function show(name){
  tabs.forEach(function(t){ t.setAttribute("aria-selected", String(t.dataset.pane === name)); });
  PANES.forEach(function(p){
    document.getElementById("pane-" + p).hidden = (p !== name);
  });
  applyLanguage();
  // The tab row scrolls now, so the selected tab can be off-screen.
  var sel = document.querySelector('.tab[aria-selected="true"]');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (navFade) navFade();
  window.scrollTo(0,0);
}
tabs.forEach(function(t){ t.addEventListener("click", function(){ show(t.dataset.pane); }); });
[].forEach.call(document.querySelectorAll("[data-goto]"), function(b){
  b.addEventListener("click", function(){ show(b.dataset.goto); });
});

// --- home ----------------------------------------------------------------
document.getElementById("homeStats").innerHTML = ORDER.map(function(c){
  var n = DISHES.filter(function(d){ return d.category === c; }).length;
  // The label gets its own node so the translator can see it whole.
  return "<span><span>" + esc(LABELS[c]) + "</span> <b class='tnum'>" + n + "</b></span>";
}).join("");

document.getElementById("homeTiers").innerHTML = Object.keys(TIERS).map(function(k){
  var t = TIERS[k];
  return "<div class='card'><h2 class='h-sm'>" + esc(t.name) + "</h2>" +
    "<p class='src' style='margin:5px 0 12px'>Minimum " + t.minGuests + " guests · " +
      t.bitesPerGuest + " bites per guest</p>" +
    "<dl style='margin:0'>" +
      "<div class='kv'><dt>Menaje</dt><dd class='tnum'>" +
        (t.menajePerGuest>0 ? soles(t.menajePerGuest)+"/guest" : "not required") + "</dd></div>" +
      "<div class='kv'><dt>Floor staff</dt><dd class='tnum'>" +
        (t.guestsPerWaiter>0 ? "1 per "+t.guestsPerWaiter : "none") + "</dd></div>" +
      "<div class='kv'><dt>Transport</dt><dd class='tnum'>" + soles(t.transport) + "</dd></div>" +
    "</dl></div>";
}).join("");

document.getElementById("homeSigs").innerHTML = DISHES.slice()
  .filter(function(d){ return d.tiers.length === 3; })
  .sort(function(a,b){ return a.cost/a.price - b.cost/b.price; })
  .slice(0,6)
  .map(function(d){
    return "<div class='card'><p class='dish-n'>" + String(d.id).padStart(3,"0") + "</p>" +
      "<h3 style='margin:3px 0 8px'>" + esc(d.name) + "</h3>" +
      "<p class='muted' style='font-size:.9rem;margin:0 0 10px'>" + esc(d.fusion) + "</p>" +
      "<p class='dna' style='margin:0'><span class='u'>" + esc(d.origin) +
      "</span> <span style='color:var(--ink-3)'>→</span> <span class='p'>" + esc(d.subOrigin) +
      "</span></p></div>";
  }).join("");

// --- the matrix ----------------------------------------------------------
// 223 rows with no way through them was the single biggest usability hole in
// the app. Search, filter by course and by lineage, sort on any column, and
// on a phone the same rows render as cards rather than a sideways scroll.
var mx = { q: "", cat: "", origin: "", flag: "", sort: "id", dir: 1 };

/**
 * Search that ignores accents, because the menu is half Spanish.
 *
 * Typing "lucuma" has to find "lúcuma" and "aji" has to find "ají". Anything
 * else makes a Peruvian buyer type accents to search their own language.
 */
function fold(v){
  return String(v == null ? "" : v).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

var MX_HAY = {};
function dishHaystack(d){
  if (MX_HAY[d.id]) return MX_HAY[d.id];
  var r = RECIPE_BY_DISH[d.id];
  var parts = [d.name, d.fusion, d.origin, d.subOrigin, d.source || "", d.keyIngredients,
    LABELS[d.category], FORMATS[d.format], String(d.id)];
  if (r) parts.push(r.ingredients.map(function(i){ return i.item; }).join(" "));
  // The Spanish is searchable too, so the same box works in either language.
  parts.push(ES[d.fusion] || "", ES_ING_ALL(d));
  return (MX_HAY[d.id] = fold(parts.join(" ")));
}
function ES_ING_ALL(d){
  var r = RECIPE_BY_DISH[d.id];
  if (!r) return "";
  return r.ingredients.map(function(i){ return ES_ING[canonIng(i.item)] || ""; }).join(" ");
}

function mxVariance(d){
  var c = costRecipe(RECIPE_BY_DISH[d.id]);
  if (!c || !c.perPortion) return null;
  return Math.abs(c.perPortion - d.cost) / d.cost;
}

function mxMatches(d){
  if (mx.cat && d.category !== mx.cat) return false;
  if (mx.origin && lineOf(d) !== mx.origin) return false;
  if (mx.flag === "over" && ratio(d) <= K.FC_MAX) return false;
  if (mx.flag === "gap"){ var v = mxVariance(d); if (v === null || v <= 0.4) return false; }
  if (mx.flag === "licence" && !d.needsLicence) return false;
  if (mx.flag === "veg" && !d.veg) return false;
  if (mx.q && dishHaystack(d).indexOf(mx.q) === -1) return false;
  return true;
}

function lineOf(d){ return d.subOrigin.indexOf("Scottish") === 0 ? "Scottish" : d.subOrigin; }

function mxSorted(list){
  var k = mx.sort, dir = mx.dir;
  var by = {
    id:    function(a,b){ return a.id - b.id; },
    name:  function(a,b){ return a.name.localeCompare(b.name); },
    price: function(a,b){ return a.price - b.price; },
    cost:  function(a,b){ return a.cost - b.cost; },
    fc:    function(a,b){ return ratio(a) - ratio(b); },
    gap:   function(a,b){ return (mxVariance(a) || 0) - (mxVariance(b) || 0); }
  };
  return list.slice().sort(function(a,b){ return by[k](a,b) * dir; });
}

function mxRow(d){
  return "<tr><td class='dish-n tnum'>" + d.id + "</td><td>" +
    "<span class='dish-t'>" + esc(d.name) + "</span>" +
    "<span class='dish-b'>" + esc(d.fusion) + "</span>" +
    "<span class='dna'><span class='u'>" + esc(d.origin) +
      "</span> <span style='color:var(--ink-3)'>→</span> <span class='p'>" + esc(d.subOrigin) + "</span></span>" +
    "</td>" +
    (CLIENT_BUILD ? "" :
      "<td class='money tnum muted'>" + soles(d.cost) + "</td>" +
      "<td class='money tnum'>" + realCostCell(d) + "</td>") +
    "<td class='money tnum' style='font-weight:600'>" + soles(d.price) + "</td>" +
    (CLIENT_BUILD ? "" :
      "<td class='fc tnum " + flag(d) + "'>" + Math.round(ratio(d)*100) + "%</td>") +
    (CLIENT_BUILD ? "" : "<td class='src'>" + esc(d.source) + "</td>") + "</tr>";
}

function mxCard(d){
  return "<div class='dcard'><div class='dcard-top'>" +
    "<div><span class='dish-n tnum'>" + String(d.id).padStart(3,"0") + " &middot; <span>" +
      esc(LABELS[d.category]) + "</span></span>" +
      "<h3 style='margin:3px 0 0;font-size:1.02rem'>" + esc(d.name) + "</h3></div>" +
    (CLIENT_BUILD ? "" :
      "<span class='fc tnum " + flag(d) + "'>" + Math.round(ratio(d)*100) + "%</span>") + "</div>" +
    "<p class='dish-b' style='margin:7px 0 0'>" + esc(d.fusion) + "</p>" +
    "<p class='dna' style='margin:7px 0 0'><span class='u'>" + esc(d.origin) +
      "</span> <span style='color:var(--ink-3)'>→</span> <span class='p'>" +
      esc(d.subOrigin) + "</span></p>" +
    "<div class='dcard-nums'>" +
      (CLIENT_BUILD ? "" : "<span><span>Est.</span> <b>" + soles(d.cost) + "</b></span>") +
      // The number itself, not the table cell's markup stripped with a regex —
      // that dragged the ×ratio badge in and read as "S/ 0.73 ×0.33".
      "<span><span>From recipe</span> <b>" +
        (REAL_COST[d.id] === undefined ? "\u2014" : soles(REAL_COST[d.id])) + "</b></span>" +
      "<span><span>Menu value</span> <b>" + soles(d.price) + "</b></span>" +
    "</div></div>";
}

function mxHead(){
  // The headers are built here, not in the static markup, so a client build
  // simply does not have a cost, recipe-cost, FC% or supplier column - rather
  // than having one that is empty, which invites the question.
  var cols = CLIENT_BUILD
    ? [["id","#",""],["name","Dish",""],["price","Menu value","right"]]
    : [["id","#",""],["name","Dish",""],["cost","Est. cost","right"],
       ["gap","From recipe","right"],["price","Menu value","right"],["fc","FC%","right"]];
  return "<thead><tr>" + cols.map(function(c){
    var on = mx.sort === c[0];
    return "<th class='sortable' data-sort='" + c[0] + "'" +
      (on ? " aria-sort='" + (mx.dir === 1 ? "ascending" : "descending") + "'" : "") +
      (c[2] ? " style='text-align:right'" : "") + "><span>" + esc(c[1]) + "</span>" +
      "<span class='arrow'>" + (on ? (mx.dir === 1 ? "\u2191" : "\u2193") : "\u2195") + "</span></th>";
  }).join("") + (CLIENT_BUILD ? "" : "<th><span>Source</span></th>") + "</tr></thead>";
}

function renderMatrix(){
  var hits = DISHES.filter(mxMatches);
  var body = document.getElementById("menuBody");
  var filtered = mx.q || mx.cat || mx.origin || mx.flag;

  document.getElementById("mxCount").innerHTML =
    "<span><b class='tnum'>" + hits.length + "</b> " +
      (hits.length === 1 ? "<span>dish</span>" : "<span>dishes</span>") +
      " <span>of</span> <span class='tnum'>" + DISHES.length + "</span></span>" +
    (filtered ? "<button type='button' class='linkbtn' id='mxClear'>Clear all filters</button>" : "");
  if (filtered){
    document.getElementById("mxClear").addEventListener("click", function(){
      mx.q = ""; mx.cat = ""; mx.origin = ""; mx.flag = "";
      document.getElementById("mxQ").value = "";
      syncMatrix();
    });
  }

  if (!hits.length){
    body.innerHTML = "<div class='empty'><h2>Nothing matches that</h2>" +
      "<p>Try an ingredient rather than a dish name, or clear a filter.</p>" +
      "<button type='button' class='chip' id='mxEmptyClear'>Clear all filters</button></div>";
    document.getElementById("mxEmptyClear").addEventListener("click", function(){
      mx.q = ""; mx.cat = ""; mx.origin = ""; mx.flag = "";
      document.getElementById("mxQ").value = "";
      syncMatrix();
    });
    return;
  }

  // Grouped by course while sorted by number, which is how you browse it.
  // Any other sort is a question about the whole matrix, so it goes flat.
  var groups = mx.sort === "id" && !mx.cat
    ? ORDER.map(function(c){ return { label: LABELS[c],
        rows: hits.filter(function(d){ return d.category === c; }) }; })
        .filter(function(g){ return g.rows.length; })
    : [{ label: "", rows: mxSorted(hits) }];

  body.innerHTML = groups.map(function(g){
    var rows = mx.sort === "id" ? mxSorted(g.rows) : g.rows;
    return (g.label ? "<div class='sec-head'><h2>" + esc(g.label) + "</h2>" +
        "<span class='pill-count tnum'>" + rows.length + "</span></div>" : "") +
      "<div class='tscroll mxtable'><table>" + mxHead() + "<tbody>" +
        rows.map(mxRow).join("") + "</tbody></table></div>" +
      "<div class='dishcards'>" + rows.map(mxCard).join("") + "</div>";
  }).join("");

  [].forEach.call(body.querySelectorAll("[data-sort]"), function(th){
    th.addEventListener("click", function(){
      var k = th.dataset.sort;
      if (mx.sort === k) mx.dir = -mx.dir; else { mx.sort = k; mx.dir = k === "gap" ? -1 : 1; }
      document.getElementById("mxSort").value = mx.sort;
      renderMatrix();
    });
  });
}

function mxChips(){
  var cats = "<button type='button' class='chip" + (mx.cat === "" ? " on" : "") +
    "' data-mxcat=''><span>All courses</span></button>" +
    ORDER.map(function(c){
      var n = DISHES.filter(function(d){ return d.category === c; }).length;
      return "<button type='button' class='chip" + (mx.cat === c ? " on" : "") +
        "' data-mxcat='" + c + "'><span>" + esc(LABELS[c]) + "</span>" +
        "<span class='tnum'> " + n + "</span></button>";
    }).join("");
  document.getElementById("mxCats").innerHTML = cats;

  var lines = {};
  DISHES.forEach(function(d){ lines[lineOf(d)] = (lines[lineOf(d)] || 0) + 1; });
  var order = Object.keys(lines).sort(function(a,b){ return lines[b] - lines[a]; });
  document.getElementById("mxOrigins").innerHTML =
    "<button type='button' class='chip" + (mx.origin === "" ? " on" : "") +
      "' data-mxorigin=''><span>Every lineage</span></button>" +
    order.map(function(o){
      return "<button type='button' class='chip" + (mx.origin === o ? " on" : "") +
        "' data-mxorigin='" + esc(o) + "'><span>" + esc(o) + "</span>" +
        "<span class='tnum'> " + lines[o] + "</span></button>";
    }).join("");

  document.getElementById("mxFlags").innerHTML =
    [["", "No flag"], ["over", "Over the food-cost ceiling"], ["gap", "More than 40% from its estimate"],
     ["licence", "Needs the liquor licence"], ["veg", "Vegetarian"]].map(function(f){
      return "<button type='button' class='chip" + (mx.flag === f[0] ? " on" : "") +
        "' data-mxflag='" + f[0] + "'><span>" + esc(f[1]) + "</span></button>";
    }).join("");

  [["data-mxcat","cat"],["data-mxorigin","origin"],["data-mxflag","flag"]].forEach(function(pair){
    [].forEach.call(document.querySelectorAll("[" + pair[0] + "]"), function(b){
      b.addEventListener("click", function(){
        var v = b.getAttribute(pair[0]);
        mx[pair[1]] = (mx[pair[1]] === v) ? "" : v;
        syncMatrix();
      });
    });
  });
}

function filtBadge(id, n){
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = n ? String(n) : "";
  el.classList.toggle("on", !!n);
}

function syncMatrix(){
  mxChips();
  renderMatrix();
  filtBadge("mxFiltN", (mx.cat ? 1 : 0) + (mx.origin ? 1 : 0) + (mx.flag ? 1 : 0));
  applyLanguage();
}

/**
 * Filters open on a desktop, folded on a phone.
 *
 * Three rows of chips above the first dish is a wall on a 390px screen, and
 * wasted whitespace on a 1280px one. The badge on the summary is what keeps a
 * folded filter from being a hidden one.
 */
function initFilterBoxes(){
  var wide = window.matchMedia("(min-width:701px)").matches;
  ["mxFilters","recFilters"].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.open = wide;
  });
}

document.getElementById("mxQ").addEventListener("input", function(e){
  mx.q = fold(e.target.value.trim());
  document.getElementById("mxQClear").classList.toggle("on", !!e.target.value);
  renderMatrix(); applyLanguage();
});
document.getElementById("mxQClear").addEventListener("click", function(){
  var i = document.getElementById("mxQ");
  i.value = ""; mx.q = ""; i.focus();
  document.getElementById("mxQClear").classList.remove("on");
  renderMatrix(); applyLanguage();
});
document.getElementById("mxSort").addEventListener("change", function(e){
  mx.sort = e.target.value; mx.dir = e.target.value === "gap" ? -1 : 1;
  renderMatrix(); applyLanguage();
});

// --- recipes -------------------------------------------------------------
// One card per dish, filtered by course and by a free-text search that reaches
// into the ingredients and the method - so "fryer" or "lucuma" both find work.
var RECIPE_BY_DISH = {};
RECIPES.forEach(function(r){ RECIPE_BY_DISH[r.dishId] = r; });
var DISH_BY_ID = {};
DISHES.forEach(function(d){ DISH_BY_ID[d.id] = d; });

var recCat = "";      // "" means every course
var recQuery = "";
var recDiet = "";     // "" means no dietary filter
var recTime = "";     // "" means any total time

var REC_HAY = {};
function recipeHaystack(r, d){
  if (REC_HAY[r.dishId]) return REC_HAY[r.dishId];
  var en = d.name + " " + d.fusion + " " + d.keyIngredients + " " +
    r.ingredients.map(function(i){ return i.qty + " " + i.item; }).join(" ") + " " +
    r.method.join(" ") + " " + r.makeAhead + " " + r.holds;
  // The Spanish goes in the same haystack: a cook searching "avena" or
  // "mantequilla" has to find the recipe whichever language the page is in.
  var es = r.ingredients.map(function(i){ return ES_ING[canonIng(i.item)] || ""; }).join(" ") +
    " " + r.method.map(function(m){ return ES[m] || ""; }).join(" ") +
    " " + (ES[d.fusion] || "");
  return (REC_HAY[r.dishId] = fold(en + " " + es));
}

function recipeMatches(r){
  var d = DISH_BY_ID[r.dishId];
  if (!d) return false;
  if (recCat && d.category !== recCat) return false;
  if (recDiet && !suitsAll(d.id, [recDiet])) return false;
  if (recTime && (r.prepMin + r.cookMin) > Number(recTime)) return false;
  if (recQuery && recipeHaystack(r, d).indexOf(recQuery) === -1) return false;
  return true;
}

function recFiltered(){ return recQuery || recCat || recDiet || recTime; }

function recClearAll(){
  recQuery = ""; recCat = ""; recDiet = ""; recTime = "";
  document.getElementById("recSearch").value = "";
  document.getElementById("recTime").value = "";
  document.getElementById("recQClear").classList.remove("on");
  renderRecCats(); renderRecDiets(); renderRecipes(); recBadge(); applyLanguage();
}

function recBadge(){
  filtBadge("recFiltN", (recCat ? 1 : 0) + (recDiet ? 1 : 0) + (recTime ? 1 : 0));
}

function renderRecDiets(){
  // Only the diets that actually rule anything out are worth a chip: an empty
  // filter is a dead button and a filter nothing fails is a lie.
  var html = "<button type='button' class='chip" + (recDiet === "" ? " on" : "") +
    "' data-rdiet=''><span>Anyone</span></button>";
  html += DIETS.map(function(row){
    var n = RECIPES.filter(function(r){ return suitsAll(r.dishId, [row[0]]); }).length;
    if (!n || n === RECIPES.length) return "";
    return "<button type='button' class='chip" + (recDiet === row[0] ? " on" : "") +
      "' data-rdiet='" + row[0] + "' title='" + esc(row[2]) + "'><span>" + esc(row[1]) + "</span>" +
      "<span class='tnum'> " + n + "</span></button>";
  }).join("");
  document.getElementById("recDiets").innerHTML = html;
  [].forEach.call(document.querySelectorAll("[data-rdiet]"), function(b){
    b.addEventListener("click", function(){
      recDiet = (recDiet === b.dataset.rdiet) ? "" : b.dataset.rdiet;
      renderRecDiets(); renderRecipes(); recBadge(); applyLanguage();
    });
  });
}

function renderRecCats(){
  var html = "<button class='chip" + (recCat === "" ? " on" : "") + "' data-rcat=''>All" +
    "<span class='tnum'> " + RECIPES.length + "</span></button>";
  html += ORDER.map(function(c){
    var n = RECIPES.filter(function(r){
      var d = DISH_BY_ID[r.dishId]; return d && d.category === c;
    }).length;
    if (!n) return "";
    return "<button class='chip" + (recCat === c ? " on" : "") + "' data-rcat='" + c + "'>" +
      esc(LABELS[c]) + "<span class='tnum'> " + n + "</span></button>";
  }).join("");
  document.getElementById("recCats").innerHTML = html;
  [].forEach.call(document.querySelectorAll("[data-rcat]"), function(b){
    b.addEventListener("click", function(){
      recCat = (recCat === b.dataset.rcat) ? "" : b.dataset.rcat;
      renderRecCats(); renderRecipes(); recBadge(); applyLanguage();
    });
  });
}

/**
 * A recipe line in Spanish keeps its prep note - "cebolla roja, en cubos
 * finos" - because the note is the instruction and the name is the shop.
 */
function recipeItem(item){
  if (LANG !== "es") return item;
  var key = canonIng(item);
  var es = ES_ING[key];
  if (!es) return item;
  var comma = item.indexOf(",");
  var out = es;
  if (comma > -1){
    // "butter, softened" is an ingredient AND an instruction. Translating
    // only the first half produced "mantequilla, softened", which is worse
    // than leaving the whole line in English.
    var tail = item.slice(comma + 1).trim();
    out = es + ", " + (ES_PREP[tail] || tail);
  }
  // Recorded so the coverage figure counts these as translated. They are
  // produced here rather than by the dictionary walker, and without this
  // every ingredient line was reported as still English.
  APPLIED[out.replace(/\s+/g, " ").trim()] = 1;
  return out;
}

/** What a recipe declares, and what it suits. Read off its own ingredients. */
function dietaryPanel(dishId){
  var p = DIET_INDEX[dishId];
  if (!p) return "";
  if (p.unknown.length){
    return "<div class='dietbox bad'><p class='mono lbl'>Cannot be declared</p>" +
      "<p>" + esc(p.unknown.join(", ")) + " has not been classified, so nothing here is " +
      "trustworthy for this dish. Fix the ingredient table before serving it to anyone " +
      "with an allergy.</p></div>";
  }
  var al = p.allergens.length
    ? p.allergens.map(function(a){ return "<span class='alg'>" + esc(a) + "</span>"; }).join("")
    : "<span class='muted'>none declared</span>";
  var suits = p.suits.length
    ? p.suits.map(function(d){ return "<span class='suit'>" + esc(dietLabel(d)) + "</span>"; }).join("")
    : "<span class='muted'>nothing on the list</span>";
  return "<div class='dietbox'>" +
    "<p class='mono lbl'>Contains</p><p>" + al + "</p>" +
    "<p class='mono lbl' style='margin-top:9px'>Suits</p><p>" + suits + "</p>" +
    "</div>";
}

function renderRecipes(){
  var hits = RECIPES.filter(recipeMatches);
  document.getElementById("recCount").innerHTML =
    "<span><b class='tnum'>" + hits.length + "</b> <span>of</span> " +
      "<span class='tnum'>" + RECIPES.length + "</span> <span>recipes</span></span>" +
    (recFiltered() ? "<button type='button' class='linkbtn' id='recClear'>Clear all filters</button>" : "");
  if (recFiltered()) document.getElementById("recClear").addEventListener("click", recClearAll);

  if (!hits.length){
    document.getElementById("recBody").innerHTML =
      "<div class='empty'><h2>Nothing matches that</h2>" +
      "<p>Try an ingredient rather than a dish name, or loosen a filter.</p>" +
      "<button type='button' class='chip' id='recEmptyClear'>Clear all filters</button></div>";
    document.getElementById("recEmptyClear").addEventListener("click", recClearAll);
    return;
  }

  document.getElementById("recBody").innerHTML = hits.map(function(r){
    var d = DISH_BY_ID[r.dishId];
    var total = r.prepMin + r.cookMin;
    return "<div class='card' style='margin-bottom:18px'>" +
      "<p class='dish-n'>" + String(d.id).padStart(3,"0") + " &middot; <span>" +
        esc(LABELS[d.category]) + "</span></p>" +
      "<h2 class='h-sm' style='margin:3px 0 6px'>" + esc(d.name) + "</h2>" +
      "<p class='dna' style='margin:0 0 10px'><span class='u'>" + esc(d.origin) +
        "</span> <span style='color:var(--ink-3)'>&rarr;</span> <span class='p'>" +
        esc(d.subOrigin) + "</span></p>" +
      // Each label in its own span: the translator works on whole text nodes,
      // so a composed line is one long string it can never match.
      "<p class='src wrap-ok' style='margin:0 0 16px'><span>" + esc(r.yields) + "</span>" +
        " &middot; <span>prep " + r.prepMin + " min</span>" +
        " &middot; <span>cook " + r.cookMin + " min</span>" +
        " &middot; <span class='tnum'>" + total + " min</span> <span>total</span>" +
        " &middot; <span>" + esc(FORMATS[d.format]) + "</span></p>" +

      "<div class='grid' style='grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px'>" +
        "<div><h3 style='margin:0 0 8px;font-size:.78rem;letter-spacing:.08em;'" +
          "text-transform:uppercase;color:var(--ink-3)'>Ingredients</h3><dl style='margin:0'>" +
          r.ingredients.map(function(i){
            return "<div class='kv'><dt>" + esc(recipeItem(i.item)) + "</dt>" +
              "<dd class='tnum'>" + esc(i.qty) + "</dd></div>";
          }).join("") + "</dl></div>" +
        "<div><h3 style='margin:0 0 8px;font-size:.78rem;letter-spacing:.08em;'" +
          "text-transform:uppercase;color:var(--ink-3)'>Method</h3><ol style='margin:0;padding-left:18px'>" +
          r.method.map(function(m){
            return "<li style='margin-bottom:7px;line-height:1.5'>" + esc(m) + "</li>";
          }).join("") + "</ol></div>" +
      "</div>" +

      dietaryPanel(d.id) +
      "<div style='margin-top:16px;border-top:1px solid var(--line);padding-top:14px'>" +
        "<div class='kv'><dt>Make ahead</dt><dd>" + esc(r.makeAhead) + "</dd></div>" +
        "<div class='kv'><dt>Holds</dt><dd>" + esc(r.holds) + "</dd></div>" +
        (r.scaling ? "<div class='kv'><dt>At scale</dt><dd>" + esc(r.scaling) + "</dd></div>" : "") +
      "</div></div>";
  }).join("");
}

document.getElementById("recTime").addEventListener("change", function(e){
  recTime = e.target.value; renderRecipes(); recBadge(); applyLanguage();
});
document.getElementById("recQClear").addEventListener("click", function(){
  var i = document.getElementById("recSearch");
  i.value = ""; recQuery = ""; i.focus();
  document.getElementById("recQClear").classList.remove("on");
  renderRecipes(); applyLanguage();
});
document.getElementById("recSearch").addEventListener("input", function(e){
  // Folded, so "lucuma" finds "lúcuma" here exactly as it does in the matrix.
  recQuery = fold(e.target.value.trim());
  document.getElementById("recQClear").classList.toggle("on", !!e.target.value);
  renderRecipes(); applyLanguage();
});
renderRecCats();
renderRecipes();

// --- packages ------------------------------------------------------------
document.getElementById("pkgCards").innerHTML = Object.keys(TIERS).map(function(k){
  var t = TIERS[k];
  var n = dishesAtTier(t.id).length;
  function row(l,v){ return "<div class='kv'><dt>" + l + "</dt><dd class='tnum'>" + v + "</dd></div>"; }
  return "<div class='card'><h2 class='h-sm'>" + esc(t.name) + "</h2>" +
    "<p class='src' style='margin:5px 0 14px'>" + n + " dishes available at this tier</p><dl style='margin:0'>" +
    row("Minimum guests", t.minGuests) + row("Bites per guest", t.bitesPerGuest) +
    row("Menaje per guest", t.menajePerGuest>0?soles(t.menajePerGuest):"—") +
    row("Packaging per guest", t.packagingPerGuest>0?soles(t.packagingPerGuest):"—") +
    row("Waiters", t.guestsPerWaiter>0?("1 per "+t.guestsPerWaiter):"none") +
    row("On-site chefs", t.chefs) + row("Transport", soles(t.transport)) + "</dl></div>";
}).join("");

document.getElementById("pkgRates").innerHTML =
  [["Waiter / prep shift", soles(K.STAFF)],
   ["On-site chef shift", soles(K.CHEF)],
   ["IGV", Math.round(K.IGV*100) + "%"]].map(function(r){
    return "<div class='card'><p class='src' style='margin:0'>" + r[0] + "</p>" +
      "<p class='tnum' style=\"font-family:'IBM Plex Mono',monospace;font-size:1.3rem;" +
      "font-weight:600;margin:5px 0 0\">" + r[1] + "</p></div>";
  }).join("");

// --- find dishes ---------------------------------------------------------
// Mirrors matchesEvent() in lib/dishes.ts: every clause present must hold.
function matchesEvent(d, f){
  if (f.tier && d.tiers.indexOf(f.tier) === -1) return false;
  if (f.categories && f.categories.indexOf(d.category) === -1) return false;
  if (f.formats && f.formats.indexOf(d.format) === -1) return false;
  if (f.needsLicence !== undefined && d.needsLicence !== f.needsLicence) return false;
  if (f.veg !== undefined && d.veg !== f.veg) return false;
  if (f.subOrigins && !f.subOrigins.some(function(o){ return d.subOrigin.indexOf(o) === 0; })) return false;
  return true;
}

var evtId = null, flav = [], flavMode = "any", fmts = [], diets = [];

document.getElementById("evtGrid").innerHTML = EVENTS.map(function(e){
  return "<button class='pick' data-evt='" + e.id + "' aria-pressed='false'>" +
    "<span class='pick-name'>" + esc(e.name) + "</span>" +
    "<span class='dish-b'>" + esc(e.blurb) + "</span></button>";
}).join("");

document.getElementById("evtGrid").addEventListener("click", function(e){
  var b = e.target.closest("[data-evt]"); if (!b) return;
  evtId = (evtId === b.dataset.evt) ? null : b.dataset.evt;
  renderFind();
});

document.getElementById("dietChips").addEventListener("click", function(e){
  var b = e.target.closest("[data-diet]");
  if (!b || b.disabled) return;
  var i = diets.indexOf(b.dataset.diet);
  if (i > -1) diets.splice(i, 1); else diets.push(b.dataset.diet);
  renderFind();
});

document.getElementById("fmtChips").addEventListener("click", function(e){
  var b = e.target.closest("[data-fmt]"); if (!b) return;
  var i = fmts.indexOf(b.dataset.fmt);
  if (i > -1) fmts.splice(i,1); else fmts.push(b.dataset.fmt);
  renderFind();
});

function onFlavHit(b){
  if (!b) return;
  if (b.dataset.flav === "__mode"){
    flavMode = (flavMode === "any") ? "all" : "any";
  } else {
    var i = flav.indexOf(b.dataset.flav);
    if (i > -1) flav.splice(i,1); else flav.push(b.dataset.flav);
  }
  renderFind();
}

// Both the wheel and the mode switch feed the same handler. The wedges are
// focusable, so the compass is operable from the keyboard as well as by tap.
document.getElementById("flavChips").addEventListener("click", function(e){
  onFlavHit(e.target.closest("[data-flav]"));
});
document.getElementById("compass").addEventListener("click", function(e){
  var g = e.target.closest("[data-flav]");
  if (g && !g.classList.contains("off-limits")) onFlavHit(g);
});
document.getElementById("compass").addEventListener("keydown", function(e){
  if (e.key !== "Enter" && e.key !== " ") return;
  var g = e.target.closest("[data-flav]");
  if (g && !g.classList.contains("off-limits")){ e.preventDefault(); onFlavHit(g); }
});

document.addEventListener("input", function(e){
  if (e.target && e.target.id === "svcTime"){ serviceTime = e.target.value || "19:30"; render(); }
});

document.addEventListener("click", function(e){
  if (e.target && e.target.id === "clearFind"){
    evtId = null; flav = []; fmts = []; diets = []; findQ = "";
    var fq = document.getElementById("findQ");
    if (fq){ fq.value = ""; document.getElementById("findQClear").classList.remove("on"); }
    renderFind(); applyLanguage();
  }
});

// --- the palate compass ---------------------------------------------------
// A wedge per flavour axis. The wedge's depth is the share of the current
// selection carrying that flavour, so the wheel is a reading of the matrix
// rather than a decorated row of buttons.
var AXIS_COLOUR = {
  sweet:  "var(--c-sweet)",
  savoury:"var(--c-savoury)",
  rich:   "var(--c-rich)",
  tart:   "var(--c-tart)",
  smoky:  "var(--c-smoky)",
  spiced: "var(--c-spiced)",
  fresh:  "var(--c-fresh)"
};
var CX = 200, CY = 200, R_IN = 74, R_OUT = 168;

function arcPath(cx, cy, rIn, rOut, a0, a1){
  var x0 = cx + Math.cos(a0)*rOut, y0 = cy + Math.sin(a0)*rOut;
  var x1 = cx + Math.cos(a1)*rOut, y1 = cy + Math.sin(a1)*rOut;
  var x2 = cx + Math.cos(a1)*rIn,  y2 = cy + Math.sin(a1)*rIn;
  var x3 = cx + Math.cos(a0)*rIn,  y3 = cy + Math.sin(a0)*rIn;
  var big = (a1 - a0) > Math.PI ? 1 : 0;
  return "M" + x0 + " " + y0 +
    "A" + rOut + " " + rOut + " 0 " + big + " 1 " + x1 + " " + y1 +
    "L" + x2 + " " + y2 +
    "A" + rIn + " " + rIn + " 0 " + big + " 0 " + x3 + " " + y3 + "Z";
}

/** What the recipe prices out at, against what the matrix claims. */
function realCostCell(d){
  var real = REAL_COST[d.id];
  if (real === undefined) return "<span class='muted'>\u2014</span>";
  var ratio = d.cost > 0 ? real / d.cost : null;
  var cls = (ratio === null || (ratio >= 0.7 && ratio <= 1.4)) ? "muted"
          : (ratio > 1.4 ? "over" : "under");
  var tag = ratio === null ? "" :
    " <span class='mono' style='font-size:10px'>\u00d7" + ratio.toFixed(2) + "</span>";
  return "<span class='rc " + cls + "'>" + soles(real) + tag + "</span>";
}

function renderCompass(base, matchCount){
  var n = AXES.length;
  var gap = 0.035;                     // radians of breathing room between wedges
  var counts = AXES.map(function(a){
    return base.filter(function(d){ return (FLAV[d.id] || []).indexOf(a) > -1; }).length;
  });
  var peak = Math.max.apply(null, counts.concat([1]));

  var parts = ['<defs>' +
    '<radialGradient id="cglow" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="var(--aji)" stop-opacity=".22"/>' +
      '<stop offset="72%" stop-color="var(--aji)" stop-opacity="0"/>' +
    '</radialGradient></defs>' +
    '<circle cx="200" cy="200" r="196" fill="url(#cglow)"/>'];

  AXES.forEach(function(a, i){
    var a0 = (i/n)*Math.PI*2 - Math.PI/2 + gap/2;
    var a1 = a0 + (Math.PI*2/n) - gap;
    var on = flav.indexOf(a) > -1;
    var count = counts[i];
    var dead = count === 0 && !on;
    // Depth carries the count: a flavour the current selection barely has
    // reaches less far out than one it is full of.
    // The floor is set by the label, not by taste: a two-line label needs
    // this much wedge under it, or the count falls off the fill onto the
    // ghost behind and disappears.
    var LABEL_BAND = 46;
    var depth = R_IN + LABEL_BAND + (R_OUT - R_IN - LABEL_BAND) * (count / peak);
    var mid = (a0 + a1) / 2;
    var lr = R_IN + 24;
    var lx = CX + Math.cos(mid)*lr, ly = CY + Math.sin(mid)*lr;
    var col = AXIS_COLOUR[a] || "var(--aji)";

    parts.push(
      "<g class='wedge" + (on ? " on" : "") + (dead ? " off-limits" : "") + "' " +
        "data-flav='" + a + "' role='button' tabindex='" + (dead ? -1 : 0) + "' " +
        "aria-pressed='" + on + "' aria-label='" + a + ", " + count + " dishes'>" +
        // the full-depth ghost, so the wheel always reads as a circle
        "<path d='" + arcPath(CX,CY,R_IN,R_OUT,a0,a1) + "' fill='var(--raised)' " +
          "stroke='var(--line)' stroke-width='1'/>" +
        // the data-bearing wedge
        "<path d='" + arcPath(CX,CY,R_IN,depth,a0,a1) + "' fill='" + col + "' " +
          "fill-opacity='" + (on ? 0.95 : 0.42) + "' stroke='" + col + "' " +
          "stroke-width='" + (on ? 2 : 1) + "'/>" +
        "<text x='" + lx.toFixed(1) + "' y='" + (ly-3).toFixed(1) + "' text-anchor='middle' " +
          "dominant-baseline='middle' font-size='13' font-weight='" + (on ? 700 : 500) + "' " +
          "fill='" + (on ? "var(--bg)" : "var(--ink)") + "'>" + a + "</text>" +
        "<text x='" + lx.toFixed(1) + "' y='" + (ly+12.5).toFixed(1) + "' text-anchor='middle' " +
          "dominant-baseline='middle' font-size='11' font-weight='600' class='tnum' " +
          "fill='" + (on ? "var(--bg)" : "var(--ink-2)") + "'>" + count + "</text>" +
      "</g>"
    );
  });

  parts.push(
    "<circle cx='200' cy='200' r='" + R_IN + "' fill='var(--surface)' " +
      "stroke='var(--aji)' stroke-opacity='.45' stroke-width='1.5'/>" +
    "<text x='200' y='186' text-anchor='middle' font-size='9.5' " +
      "letter-spacing='.16em' fill='var(--ink-3)'>DISHES</text>" +
    "<text x='200' y='214' text-anchor='middle' font-size='34' class='hubN' " +
      "fill='var(--aji)' font-weight='600'>" + matchCount + "</text>" +
    "<text x='200' y='234' text-anchor='middle' font-size='9.5' " +
      "fill='var(--ink-3)'>of " + DISHES.length + "</text>"
  );

  var svg = document.getElementById("compass");
  svg.innerHTML = parts.join("");
}

var findQ = "";

function renderFind(){
  var ev = null;
  for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === evtId) ev = EVENTS[i];

  var eventBase = ev ? DISHES.filter(function(d){ return matchesEvent(d, ev.filter); }) : DISHES;
  // Flavour counts must respect the format axis, or the compass lies.
  var base = fmts.length ? eventBase.filter(function(d){ return fmts.indexOf(d.format) > -1; }) : eventBase;
  var out = base;
  if (findQ) out = out.filter(function(d){ return dishHaystack(d).indexOf(findQ) > -1; });
  if (diets.length) out = out.filter(function(d){ return suitsAll(d.id, diets); });
  if (flav.length){
    out = out.filter(function(d){
      var f = FLAV[d.id] || [];
      return flavMode === "all"
        ? flav.every(function(x){ return f.indexOf(x) > -1; })
        : flav.some(function(x){ return f.indexOf(x) > -1; });
    });
  }

  [].forEach.call(document.querySelectorAll("[data-evt]"), function(b){
    b.setAttribute("aria-pressed", String(b.dataset.evt === evtId));
  });

  renderCompass(base, out.length);

  // The match-mode switch stays a control, not a wedge - it changes how the
  // wheel reads rather than what is on it.
  document.getElementById("flavChips").innerHTML = flav.length > 1
    ? "<button class='chip mono' data-flav='__mode' style='font-size:11px'>match: " + flavMode +
      " \u00b7 tap to switch</button>"
    : "<span class='muted mono' style='font-size:11px'>" +
      (flav.length ? "one flavour selected" : "no flavour selected \u2014 showing everything") + "</span>";

  document.getElementById("dietChips").innerHTML = DIETS.map(function(d){
    var id = d[0];
    var n = base.filter(function(x){ return suitsAll(x.id, [id]); }).length;
    var on = diets.indexOf(id) > -1;
    return "<button class='chip' data-diet='" + id + "' aria-pressed='" + on + "'" +
      (n === 0 && !on ? " disabled" : "") + ">" + esc(d[1]) +
      " <span class='mono tnum' style='font-size:11px;opacity:.65'>" + n + "</span></button>";
  }).join("");
  document.getElementById("dietNote").innerHTML = diets.length
    ? diets.map(function(id){ return "<strong>" + esc(dietLabel(id)) + ".</strong> " + esc(dietNote(id)); }).join("<br>")
    : "";

  document.getElementById("fmtChips").innerHTML = Object.keys(FORMATS).map(function(f){
    var n = eventBase.filter(function(d){ return d.format === f; }).length;
    var on = fmts.indexOf(f) > -1;
    return "<button class='chip' data-fmt='" + f + "' aria-pressed='" + on + "'" +
      (n === 0 && !on ? " disabled" : "") + ">" + esc(FORMATS[f]) +
      " <span class='mono tnum' style='font-size:11px;opacity:.65'>" + n + "</span></button>";
  }).join("");

  document.getElementById("findCount").innerHTML =
    "<span class='mono' style='font-size:14px'><b class='tnum'>" + out.length +
    "</b> <span class='muted'>of " + DISHES.length + " dishes</span></span>" +
    ((ev || flav.length || fmts.length || diets.length || findQ)
      ? " <button id='clearFind' class='linkbtn mono'>Clear all filters</button>"
      : "");

  if (!out.length){
    document.getElementById("findResults").innerHTML =
      "<div class='empty'><h2>Nothing matches that combination</h2>" +
      "<p>Switch the match mode to any, drop a flavour, or clear the search.</p>" +
      "<button type='button' class='chip' id='clearFind'>Clear all filters</button></div>";
    return;
  }

  document.getElementById("findResults").innerHTML = ORDER.map(function(cat){
    var rows = out.filter(function(d){ return d.category === cat; });
    if (!rows.length) return "";
    return "<section style='margin-bottom:26px'>" +
      "<h2 class='mono grouphead'><span>" + esc(LABELS[cat]) + "</span> &middot; " + rows.length + "</h2>" +
      "<div class='grid g3'>" + rows.map(function(d, i){
        // Cap the stagger: past a dozen cards the delay stops reading as
        // rhythm and starts reading as lag.
        var delay = Math.min(i, 11) * 0.035;
        return "<div class='card rise' style='padding:15px;animation-delay:" + delay + "s'>" +
          "<div class='pick-top'><span class='pick-name'>" + esc(d.name) + "</span>" +
          "<span class='pick-price tnum'>" + soles(d.price) + "</span></div>" +
          "<span class='dna'><span class='u'>" + esc(d.origin) +
          "</span> <span style='color:var(--ink-3)'>&rarr;</span> <span class='p'>" + esc(d.subOrigin) +
          "</span></span>" +
          "<div style='margin-top:9px;display:flex;flex-wrap:wrap;gap:4px'>" +
          (FLAV[d.id] || []).map(function(f){
            return "<span class='mono flavtag'>" + f + "</span>";
          }).join("") + "</div></div>";
      }).join("") + "</div></section>";
  }).join("");
}

renderFind();

// --- season --------------------------------------------------------------
// Mirrors inSeason() / dishesOutOfSeason() in lib/dishes.ts.
function inSeason(ing, m){ return ing.yearRound || ing.months.indexOf(m) > -1; }

var SHORT = ["J","F","M","A","M","J","J","A","S","O","N","D"];
var month = new Date().getMonth() + 1;

var unverified = INGS.filter(function(i){ return !i.verified; }).length;
document.getElementById("seasonWarn").innerHTML = unverified
  ? "<p class='card' style='border-color:var(--bad);margin-top:22px'>" +
    "<strong style='color:var(--bad)'>" + unverified + " of " + INGS.length +
    " seasons are unconfirmed.</strong> <span class='muted'>The dish links are reliable — they " +
    "come from the matrix. The month windows are estimates and nobody has checked them at a " +
    "market yet. Confirm before promising a client anything.</span></p>"
  : "";

document.getElementById("monthChips").addEventListener("click", function(e){
  var b = e.target.closest("[data-month]"); if (!b) return;
  month = Number(b.dataset.month);
  renderSeason();
});

function renderSeason(){
  document.getElementById("monthChips").innerHTML = MONTHS.map(function(m, i){
    var n = i + 1;
    return "<button class='chip mono' data-month='" + n + "' aria-pressed='" + (n === month) +
      "' aria-label='" + m + "' style='width:44px;padding:9px 0;text-align:center'>" +
      SHORT[i] + "</button>";
  }).join("");
  document.getElementById("monthName").textContent = MONTHS[month - 1];

  var seasonal = INGS.filter(function(i){ return !i.yearRound; });
  var pantry   = INGS.filter(function(i){ return i.yearRound; });
  var inNow    = seasonal.filter(function(i){ return inSeason(i, month); });
  var outNow   = seasonal.filter(function(i){ return !inSeason(i, month); });

  document.getElementById("seasonPanels").innerHTML =
    "<div class='card'><h2 class='mono grouphead' style='color:var(--good)'><span>Buying now</span> &middot; " +
      inNow.length + "</h3>" +
      (inNow.length ? inNow.map(function(i){
        return "<div style='margin-bottom:14px'><span style='font-weight:700;font-size:.9rem'>" +
          esc(i.name) + "</span>" +
          (i.verified ? "" : " <span class='mono flavtag'>unconfirmed</span>") +
          "<span class='dish-b'>" + esc(i.note) + "</span>" +
          "<span class='mono' style='display:block;font-size:11px;color:var(--ink-3);margin-top:3px'>" +
          i.dishes.length + " dish" + (i.dishes.length === 1 ? "" : "es") + "</span></div>";
      }).join("") : "<p class='muted' style='font-size:.9rem'>Nothing seasonal peaks this month.</p>") +
    "</div>" +
    "<div class='card'><h2 class='mono grouphead' style='color:var(--warn)'><span>Out of window</span> &middot; " +
      outNow.length + "</h3>" +
      (outNow.length ? outNow.map(function(i){
        return "<div style='margin-bottom:11px'><span class='muted' style='font-weight:700;font-size:.9rem'>" +
          esc(i.name) + "</span>" +
          "<span class='mono' style='display:block;font-size:11px;color:var(--ink-3)'><span>back in</span> " +
          (i.months.length ? mark(i.months.map(function(m){ return MONTHS[m-1].slice(0,3); }).join(", ")) : "—") +
          "</span></div>";
      }).join("") : "<p class='muted' style='font-size:.9rem'>Everything seasonal is available.</p>") +
    "</div>";

  var off = {};
  seasonal.forEach(function(i){
    if (!inSeason(i, month)) i.dishes.forEach(function(id){ (off[id] = off[id] || []).push(i.name); });
  });
  var offIds = Object.keys(off).map(Number).sort(function(a,b){ return a-b; });

  document.getElementById("seasonOff").innerHTML =
    "<h2>Off the menu in " + MONTHS[month - 1] + "</h2>" +
    "<p class='lede' style='margin-top:8px'>" +
      (offIds.length
        ? "<b id='offCount' class='tnum'>" + offIds.length + "</b> of " + DISHES.length +
          " dishes depend on something out of window. Quote around them, or swap the ingredient."
        : "<b id='offCount' class='tnum'>0</b> — every dish in the matrix is buildable this month.") +
    "</p>" +
    (offIds.length ? "<div class='grid g3' style='margin-top:18px'>" + offIds.map(function(id){
      var d = null;
      for (var j = 0; j < DISHES.length; j++) if (DISHES[j].id === id) d = DISHES[j];
      if (!d) return "";
      return "<div class='card' style='padding:13px'>" +
        "<span style='font-weight:700;font-size:.875rem;line-height:1.25'>" + esc(d.name) + "</span>" +
        "<span class='mono' style='display:block;font-size:11px;color:var(--warn);margin-top:4px'>" +
        off[id].map(esc).join(", ") + "</span></div>";
    }).join("") + "</div>" : "");

    renderSubs(offIds, month);

  document.getElementById("seasonPantry").innerHTML =
    "<h2 class='mono grouphead'><span>Available all year</span> &middot; " + pantry.length + "</h2>" +
    "<div style='display:flex;flex-wrap:wrap;gap:8px'>" + pantry.map(function(i){
      return "<span class='chip' style='cursor:default' title='" + esc(i.note) + "'>" +
        esc(i.name) + "</span>";
    }).join("") + "</div>";
}

renderSeason();

// --- moments -------------------------------------------------------------
var momentId = MOMENTS[0].id;

document.getElementById("momentArc").addEventListener("click", function(e){
  var b = e.target.closest("[data-moment]"); if (!b) return;
  momentId = b.dataset.moment; renderMoments();
});

function renderMoments(){
  var counts = {}, maxN = 1;
  MOMENTS.forEach(function(m){
    counts[m.id] = DISHES.filter(function(d){ return matchesEvent(d, m.filter); }).length;
    if (counts[m.id] > maxN) maxN = counts[m.id];
  });

  document.getElementById("momentArc").innerHTML = MOMENTS.map(function(m, i){
    var on = m.id === momentId, n = counts[m.id];
    var w = Math.max(8, Math.round((n / maxN) * 100));
    return "<li><button class='pick' data-moment='" + m.id + "' aria-pressed='" + on + "'" +
      (on ? " style='border-color:var(--aji);background:var(--surface)'" : "") + ">" +
      "<span class='mono' style='font-size:10px;color:var(--ink-3)'>" +
      (i < 9 ? "0" : "") + (i + 1) + "</span>" +
      "<span class='pick-name' style='display:block;margin-top:3px'>" + esc(m.name) + "</span>" +
      "<span style='display:block;height:3px;border-radius:2px;background:var(--aji);margin-top:11px;width:" + w + "%'></span>" +
      "<span class='mono tnum' style='display:block;font-size:11px;color:var(--ink-2);margin-top:5px'>" +
      n + " dishes</span></button></li>";
  }).join("");

  var m = null;
  for (var i = 0; i < MOMENTS.length; i++) if (MOMENTS[i].id === momentId) m = MOMENTS[i];
  var rows = DISHES.filter(function(d){ return matchesEvent(d, m.filter); });

  document.getElementById("momentBody").innerHTML =
    "<h2>" + esc(m.name) + "</h2><p class='lede' style='margin-top:7px'>" + esc(m.blurb) + "</p>" +
    "<div class='grid g3' style='margin-top:20px'>" + rows.map(function(d){
      return "<div class='card' style='padding:15px'>" +
        "<div class='pick-top'><span class='pick-name'>" + esc(d.name) + "</span>" +
        "<span class='pick-price tnum'>" + soles(d.price) + "</span></div>" +
        "<span class='dna'><span class='u'>" + esc(d.origin) +
        "</span> <span style='color:var(--ink-3)'>&rarr;</span> <span class='p'>" + esc(d.subOrigin) + "</span></span>" +
        "<div style='margin-top:9px;display:flex;flex-wrap:wrap;gap:4px'>" +
        "<span class='mono flavtag' style='text-transform:none'>" + esc(FORMATS[d.format]) + "</span>" +
        (d.needsLicence ? "<span class='mono flavtag' style='color:var(--warn);text-transform:none'>licence</span>" : "") +
        (d.veg ? "<span class='mono flavtag' style='color:var(--good);text-transform:none'>veg</span>" : "") +
        "</div></div>";
    }).join("") + "</div>";
}
renderMoments();

// --- conflicts (mirrors lib/conflicts.ts) ---------------------------------
function blendedFoodCost(sel, tierId){
  if (!sel.length) return 0;
  var t = TIERS[tierId];
  var canapes = sel.filter(function(d){ return d.category === "canape"; });
  var plates  = sel.filter(function(d){ return d.category !== "canape"; });
  var cost = 0, value = 0;
  if (canapes.length){
    var ac = canapes.reduce(function(s,d){ return s + d.cost; }, 0) / canapes.length;
    var av = canapes.reduce(function(s,d){ return s + d.price; }, 0) / canapes.length;
    cost += ac * t.bitesPerGuest; value += av * t.bitesPerGuest;
  }
  plates.forEach(function(d){ cost += d.cost; value += d.price; });
  return value > 0 ? cost / value : 0;
}

function findConflicts(sel, tierId){
  var out = [];

  // allergen: a course where every dish shares one
  var byCat = {};
  sel.forEach(function(d){ (byCat[d.category] = byCat[d.category] || []).push(d); });
  Object.keys(byCat).forEach(function(cat){
    var list = byCat[cat];
    if (list.length < 2) return;
    ALLERGENS.forEach(function(a){
      if (list.every(function(d){ return d.allergens.indexOf(a) > -1; })){
        // Compose in English and let ES_PATTERNS rewrite the whole sentence -
        // the allergen word is looked up first so it arrives already Spanish
        // and rides through the pattern as a capture.
        var label = L(a);
        out.push({ severity:"blocker", kind:"allergen",
          title: "No " + label + "-free option in " + LABELS[cat],
          detail: "All " + list.length + " dishes in this course contain " + label +
            ". A guest avoiding it has nothing to eat at this course." });
      }
    });
  });

  // kitchen contention
  function using(k){ return sel.filter(function(d){ return d.equipment.indexOf(k) > -1; }); }
  var fry = using("fryer");
  if (fry.length > CAP.fryer) out.push({ severity:"warning", kind:"kitchen",
    title: fry.length + " fried dishes, one fryer",
    detail: "Frying is sequential and oil temperature drops between batches. Above " +
      CAP.fryer + " the last one reaches the guest cold." });
  var ov = using("oven");
  if (ov.length > CAP.oven) out.push({ severity:"warning", kind:"kitchen",
    title: ov.length + " oven dishes in one service",
    detail: "Pastry, sponge and roasting all want different temperatures. Above " +
      CAP.oven + " you are either staging or compromising one of them." });
  var live = sel.filter(function(d){ return d.format === "live-station"; });
  if (live.length > CAP.liveStation) out.push({ severity:"blocker", kind:"kitchen",
    title: live.length + " live stations",
    detail: "Each live station needs someone standing at it for the whole service. Above " +
      CAP.liveStation + " this is a staffing cost the quote does not carry." });
  var gr = using("griddle");
  if (gr.length > CAP.griddle) out.push({ severity:"warning", kind:"kitchen",
    title: gr.length + " griddle items",
    detail: "One plancha, cooked to order. Above " + CAP.griddle + " the queue is the problem." });

  // margin
  if (sel.length){
    var blended = blendedFoodCost(sel, tierId);
    if (blended > K.FC_MAX){
      var worst = sel.slice().sort(function(a,b){ return b.cost/b.price - a.cost/a.price; }).slice(0,3);
      out.push({ severity:"warning", kind:"margin",
        title: "Blended food cost " + (blended*100).toFixed(1) + "%",
        detail: "Above the " + Math.round(K.FC_MAX*100) + "% ceiling. The heaviest items are " +
          worst.map(function(d){ return d.name; }).join(", ") + ". Swap one out or lift the price." });
    }
  }

  return out.sort(function(a,b){
    return a.severity === b.severity ? 0 : (a.severity === "blocker" ? -1 : 1);
  });
}

// --- run sheet (mirrors lib/runsheet.ts) ----------------------------------
var STATION = { cold:"Cold section", oven:"Oven", hob:"Stove", griddle:"Plancha", fryer:"Fryer" };

function leadStation(d){
  var best = "cold", bestLead = -1;
  d.equipment.forEach(function(e){
    if (LEAD[e] !== undefined && LEAD[e] > bestLead){ bestLead = LEAD[e]; best = e; }
  });
  return best;
}

function addMinutes(hhmm, mins){
  var parts = hhmm.split(":"), h = Number(parts[0]), m = Number(parts[1]);
  if (!isFinite(h) || !isFinite(m)) return hhmm;
  var total = (((h*60 + m + mins) % 1440) + 1440) % 1440;
  return ("0" + Math.floor(total/60)).slice(-2) + ":" + ("0" + (total%60)).slice(-2);
}

function buildRunSheet(sel, serviceTime){
  if (!sel.length) return [];
  var groups = {};
  sel.forEach(function(d){ var st = leadStation(d); (groups[st] = groups[st] || []).push(d); });
  var steps = Object.keys(groups).map(function(st){
    var offset = LEAD[st] || 60;
    return { offset: offset, station: STATION[st] || st,
      label: st === "cold" ? "Prep and set — done the day before"
           : st === "fryer" ? "Fry to order, into service"
           : "Start " + (STATION[st] || st).toLowerCase() + " work",
      dishes: groups[st].map(function(d){ return d.name; }),
      clock: addMinutes(serviceTime, -offset) };
  });
  steps.push({ offset:0, station:"Pass", label:"Service", dishes:[], clock:serviceTime });
  return steps.sort(function(a,b){ return b.offset - a.offset; });
}

// --- compare ---------------------------------------------------------------
var cmpGuestsEl = document.getElementById("cmpGuests");
cmpGuestsEl.addEventListener("input", renderCompare);

function renderCompare(){
  var guests = Math.max(1, parseInt(cmpGuestsEl.value, 10) || 1);
  document.getElementById("cmpBody").innerHTML = ["ninos","scran","buffet","plated","ceilidh"].map(function(tid){
    var t = TIERS[tid];
    var pool = dishesAtTier(tid);
    var menu = [];
    ["canape","main","side","dessert"].forEach(function(cat){
      var best = pool.filter(function(d){ return d.category === cat; })
        .sort(function(a,b){ return a.cost/a.price - b.cost/b.price; })[0];
      if (best) menu.push(best);
    });
    var q = buildQuote(menu, guests, tid);
    if (!q) return "<div class='card'><h2 class='h-sm'>" + esc(t.name) + "</h2></div>";
    function row(l,v,strong){
      return "<div class='qrow " + (strong ? "tot" : "") + "'><span>" + l +
        "</span><span class='tnum'>" + v + "</span></div>";
    }
    return "<div class='card'><h2 class='h-sm'>" + esc(t.name) + "</h2>" +
      "<p class='mono' style='font-size:11px;color:var(--ink-3);margin:4px 0 0'><span>min</span> " +
        t.minGuests + " <span>guests</span></p>" +
      "<p class='mono tnum' style='font-size:1.9rem;font-weight:600;margin:14px 0 0'>" +
        soles(q.netPerGuest) + "</p>" +
      "<p class='mono' style='font-size:11px;color:var(--ink-3);margin:0'>per guest, net of IGV</p>" +
      (q.warnings.length ? "<p class='warn'>" + esc(q.warnings[0]) + "</p>" : "") +
      "<div style='margin-top:14px'>" +
        row("Food", soles(q.foodCostPerGuest)) +
        row("Service", soles(q.serviceCostPerGuest)) +
        row("<span>Total</span> &middot; " + guests, soles(q.netTotal), true) +
        row("Client pays inc. IGV", soles(q.grossTotal), true) +
      "</div>" +
      "<div style='margin-top:16px;border-top:1px solid var(--line);padding-top:13px'>" +
        "<p class='mono grouphead'>What lands on the table</p>" +
        "<ul style='margin:0;padding-left:1.1em;font-size:12.5px;color:var(--ink-2)'>" +
        menu.map(function(d){ return "<li>" + esc(d.name) + "</li>"; }).join("") + "</ul>" +
        "<p class='muted' style='font-size:12.5px;margin:11px 0 0'>" +
        (t.menajePerGuest > 0 ? "Hired china and glassware. " : "Boxed, no china. ") +
        (t.guestsPerWaiter > 0 ? "Waiting staff, 1 per " + t.guestsPerWaiter + "." : "No staff on site.") +
        "</p></div>" +
      "<p class='mono tnum' style='color:var(--good);font-size:12.5px;margin:16px 0 0'>You keep " +
        soles(q.contributionTotal) + " (" + Math.round(q.contributionRatio*100) + "%)</p>" +
      "</div>";
  }).join("");
}
renderCompare();

// --- ingredient graph -----------------------------------------------------
function splitIngredients(raw){
  return raw.split(/[,;]/).map(function(x){
    return x.trim().toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
  }).filter(function(x){ return x.length > 2; });
}

function buildGraph(){
  var map = {};
  DISHES.forEach(function(d){
    var seen = {};
    splitIngredients(d.keyIngredients).forEach(function(n){
      if (seen[n]) return; seen[n] = 1;
      var node = map[n] || { name:n, dishes:[], value:0 };
      node.dishes.push(d.id); node.value += d.price; map[n] = node;
    });
  });
  return Object.keys(map).map(function(k){ return map[k]; })
    .sort(function(a,b){ return b.dishes.length - a.dishes.length || b.value - a.value; });
}

// --- graph interaction ----------------------------------------------------
(function(){
  var svg = document.getElementById("graphSvg");
  var dragIdx = null, dragged = false, panning = null;

  function toLocal(e){
    var r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) - VIEW.x) / VIEW.k,
             y: ((e.clientY - r.top)  - VIEW.y) / VIEW.k };
  }

  svg.addEventListener("pointerdown", function(e){
    var g = e.target.closest("[data-node]");
    svg.setPointerCapture(e.pointerId);
    dragged = false;
    if (g){
      dragIdx = Number(g.dataset.node);
      SIM.nodes[dragIdx].fixed = true;
      svg.classList.add("dragging");
    } else {
      panning = { x: e.clientX - VIEW.x, y: e.clientY - VIEW.y };
      svg.classList.add("dragging");
    }
  });

  svg.addEventListener("pointermove", function(e){
    if (dragIdx !== null){
      var p = toLocal(e);
      SIM.nodes[dragIdx].x = p.x; SIM.nodes[dragIdx].y = p.y;
      dragged = true;
      reheat(0.35);
    } else if (panning){
      VIEW.x = e.clientX - panning.x; VIEW.y = e.clientY - panning.y;
      dragged = true;
      paintGraph();
    }
  });

  function release(e){
    if (dragIdx !== null){
      // Let go and the node rejoins the simulation rather than staying pinned.
      SIM.nodes[dragIdx].fixed = false;
      if (!dragged) select(dragIdx);
      reheat(0.4);
    }
    dragIdx = null; panning = null;
    svg.classList.remove("dragging");
  }
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  svg.addEventListener("wheel", function(e){
    e.preventDefault();
    var r = svg.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    var k = Math.max(0.4, Math.min(3, VIEW.k * (e.deltaY < 0 ? 1.12 : 0.89)));
    // Zoom about the pointer, not the origin.
    VIEW.x = mx - (mx - VIEW.x) * (k / VIEW.k);
    VIEW.y = my - (my - VIEW.y) * (k / VIEW.k);
    VIEW.k = k;
    paintGraph();
  }, { passive: false });

  svg.addEventListener("keydown", function(e){
    if (e.key !== "Enter" && e.key !== " ") return;
    var g = e.target.closest("[data-node]");
    if (g){ e.preventDefault(); select(Number(g.dataset.node)); }
    if (e.key === "Escape") select(null);
  });

  function select(i){
    SIM.sel = (SIM.sel === i) ? null : i;
    paintGraph();
    renderGraphPanel();
  }

  document.getElementById("graphPanel").addEventListener("click", function(e){
    if (e.target.id === "graphClose"){ SIM.sel = null; paintGraph(); renderGraphPanel(); }
  });

  document.getElementById("graphControls").addEventListener("click", function(e){
    var b = e.target.closest("[data-shared],[data-graph]");
    if (!b) return;
    if (b.dataset.graph === "reheat"){ reheat(1); return; }
    SIM.minShared = Number(b.dataset.shared);
    SIM.edges = buildIngredientEdges(SIM.nodes, SIM.minShared);
    SIM.sel = null;
    renderGraphControls();
    renderGraphPanel();
    reheat(0.7);
  });

  // The stage has no size until its pane is shown, so lay out on first view.
  window.addEventListener("resize", function(){ if (SIM.nodes.length) reheat(0.3); });
})();

// --- force-directed ingredient network ------------------------------------
// Hand-rolled rather than d3, because the whole point of this build is that it
// is one file with nothing to fetch. ~30 nodes makes the O(n^2) repulsion
// cheap enough that a quadtree would be premature.
var SIM = { nodes: [], edges: [], alpha: 0, raf: 0, sel: null, minShared: 2 };
var VIEW = { k: 1, x: 0, y: 0 };

/**
 * Do a matrix ingredient string and a seasonal-window name refer to the same
 * thing? Plain substring matching missed "Papas nativas" against "papa nativa"
 * on the plural alone, and choked on "Asparagus (Ica)" and "Trout & paiche".
 */
function normIng(x){
  return String(x).toLowerCase()
    .replace(/[\u00e1\u00e0\u00e4\u00e2]/g,"a").replace(/[\u00e9\u00e8\u00eb\u00ea]/g,"e")
    .replace(/[\u00ed\u00ec\u00ef\u00ee]/g,"i").replace(/[\u00f3\u00f2\u00f6\u00f4]/g,"o")
    .replace(/[\u00fa\u00f9\u00fc\u00fb]/g,"u").replace(/\u00f1/g,"n")
    .replace(/\([^)]*\)/g, " ");
}
function ingTokens(x){
  return normIng(x).split(/[^a-z]+/)
    .filter(function(w){ return w.length > 2; })
    .map(function(w){ return w.replace(/s$/, ""); });   // crude singular
}
function sameIngredient(a, b){
  var at = ingTokens(a);
  // "Trout & paiche" is two ingredients sharing one window; either side counts.
  return normIng(b).split("&").some(function(part){
    var bt = ingTokens(part);
    if (!bt.length || !at.length) return false;
    var shorter = bt.length <= at.length ? bt : at;
    var longer  = bt.length <= at.length ? at : bt;
    return shorter.every(function(w){ return longer.indexOf(w) > -1; });
  });
}

/** Ingredients that appear together in at least minShared dishes. */
function buildIngredientEdges(nodes, minShared){
  var byName = {};
  nodes.forEach(function(n, i){ byName[n.name] = i; });
  var pairs = {};
  DISHES.forEach(function(d){
    var names = splitIngredients(d.keyIngredients).filter(function(n){
      return byName[n] !== undefined;
    });
    var uniq = names.filter(function(v, i){ return names.indexOf(v) === i; });
    for (var a = 0; a < uniq.length; a++){
      for (var b = a + 1; b < uniq.length; b++){
        var key = uniq[a] < uniq[b] ? uniq[a] + "\u0000" + uniq[b] : uniq[b] + "\u0000" + uniq[a];
        pairs[key] = (pairs[key] || 0) + 1;
      }
    }
  });
  return Object.keys(pairs).filter(function(k){ return pairs[k] >= minShared; })
    .map(function(k){
      var p = k.split("\u0000");
      return { s: byName[p[0]], t: byName[p[1]], w: pairs[k] };
    });
}

function graphGeometry(){
  // The client build removes the graph pane, and the force simulation keeps
  // ticking after it goes. Returning a default rather than throwing lets the
  // loop run harmlessly against nothing until it settles.
  var svg = document.getElementById("graphSvg");
  if (!svg) return { w: 900, h: 600 };
  var r = svg.getBoundingClientRect();
  return { w: r.width || 900, h: r.height || 600 };
}

function stepSim(){
  var g = graphGeometry(), cx = g.w / 2, cy = g.h / 2;
  var n = SIM.nodes, e = SIM.edges;
  var a = SIM.alpha;

  // Repulsion, every pair.
  for (var i = 0; i < n.length; i++){
    for (var j = i + 1; j < n.length; j++){
      var dx = n[j].x - n[i].x, dy = n[j].y - n[i].y;
      var d2 = dx*dx + dy*dy || 0.01;
      var d = Math.sqrt(d2);
      var force = (900 + n[i].r * n[j].r * 3) / d2;
      var fx = (dx / d) * force, fy = (dy / d) * force;
      n[i].vx -= fx; n[i].vy -= fy;
      n[j].vx += fx; n[j].vy += fy;
      // Hard collision, so labels stay readable.
      var minD = n[i].r + n[j].r + 16;
      if (d < minD){
        var push = (minD - d) * 0.5;
        n[i].x -= (dx/d) * push; n[i].y -= (dy/d) * push;
        n[j].x += (dx/d) * push; n[j].y += (dy/d) * push;
      }
    }
  }

  // Links pull, weighted by how many dishes the pair shares.
  e.forEach(function(l){
    var s = n[l.s], t = n[l.t];
    var dx = t.x - s.x, dy = t.y - s.y;
    var d = Math.sqrt(dx*dx + dy*dy) || 0.01;
    var target = 120 - Math.min(l.w, 6) * 8;
    var k = (d - target) * 0.012 * a;
    var fx = (dx/d) * k, fy = (dy/d) * k;
    s.vx += fx; s.vy += fy;
    t.vx -= fx; t.vy -= fy;
  });

  // Gentle pull to centre, integrate, damp.
  n.forEach(function(p){
    if (p.fixed) { p.vx = p.vy = 0; return; }
    // Centring has to beat repulsion or the graph inflates until it clips.
    p.vx += (cx - p.x) * 0.012 * a;
    p.vy += (cy - p.y) * 0.012 * a;
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.82; p.vy *= 0.82;
    p.x = Math.max(p.r + 6, Math.min(g.w - p.r - 6, p.x));
    // The label hangs below the node, so the floor sits higher than the ceiling.
    p.y = Math.max(p.r + 6, Math.min(g.h - p.r - 20, p.y));
  });

  SIM.alpha *= 0.985;
}

function paintGraph(){
  var svg = document.getElementById("graphSvg");
  var g = graphGeometry();
  svg.setAttribute("viewBox", "0 0 " + g.w + " " + g.h);
  var sel = SIM.sel;
  var lit = {};
  if (sel !== null){
    lit[sel] = 1;
    SIM.edges.forEach(function(l){
      if (l.s === sel) lit[l.t] = 1;
      if (l.t === sel) lit[l.s] = 1;
    });
  }

  var out = "<g transform='translate(" + VIEW.x + "," + VIEW.y + ") scale(" + VIEW.k + ")'>";
  SIM.edges.forEach(function(l){
    var on = sel !== null && (l.s === sel || l.t === sel);
    if (sel !== null && !on) return;   // a selection is a question; hide the noise
    out += "<line class='edge" + (on ? " lit" : "") + "' x1='" + SIM.nodes[l.s].x.toFixed(1) +
      "' y1='" + SIM.nodes[l.s].y.toFixed(1) + "' x2='" + SIM.nodes[l.t].x.toFixed(1) +
      "' y2='" + SIM.nodes[l.t].y.toFixed(1) + "' stroke-width='" +
      Math.min(0.6 + l.w * 0.35, 3).toFixed(2) + "' stroke-opacity='" +
      (on ? 0.95 : Math.min(0.34 + l.w * 0.09, 0.75)).toFixed(2) + "'/>";
  });
  SIM.nodes.forEach(function(p, i){
    var dim = sel !== null && !lit[i];
    out += "<g class='node" + (i === sel ? " sel" : "") + (dim ? " dim" : "") +
      "' data-node='" + i + "' role='button' tabindex='0' aria-label='" +
      esc(p.name) + ", " + p.dishes.length + " dishes'>" +
      "<circle cx='" + p.x.toFixed(1) + "' cy='" + p.y.toFixed(1) + "' r='" + p.r.toFixed(1) +
        "' fill='" + p.colour + "' fill-opacity='" + (i === sel ? 0.95 : 0.55) +
        "' stroke='" + p.colour + "' stroke-width='1.5'/>" +
      "<text x='" + p.x.toFixed(1) + "' y='" + (p.y + p.r + 12).toFixed(1) +
        "' text-anchor='middle'>" + esc(p.name.length > 17 ? p.name.slice(0,16) + "\u2026" : p.name) +
      "</text></g>";
  });
  svg.innerHTML = out + "</g>";
}

function tick(){
  // The client build has no graph pane. Stopping the loop the moment its canvas
  // is gone is cheaper and safer than teaching every function in the simulation
  // to survive a missing element one at a time.
  if (!document.getElementById("graphSvg")) { SIM.raf = 0; return; }
  stepSim();
  paintGraph();
  if (SIM.alpha > 0.005) SIM.raf = requestAnimationFrame(tick);
  else SIM.raf = 0;
}

function reheat(a){
  SIM.alpha = a || 0.9;
  if (!SIM.raf) SIM.raf = requestAnimationFrame(tick);
}

function initGraphSim(){
  var graph = buildGraph();
  var top = graph.slice(0, 30);
  var maxReach = Math.max.apply(null, top.map(function(n){ return n.dishes.length; }).concat([1]));
  var g = graphGeometry();
  // Seasonal ingredients are the ones that will strand you, so colour carries
  // that rather than just prettifying the node.
  var seasonal = {};
  INGS.forEach(function(i){ if (!i.yearRound) seasonal[i.id] = 1; });

  SIM.nodes = top.map(function(n, i){
    var a = (i / top.length) * Math.PI * 2;
    // Is THIS ingredient the seasonal one? Matching through dishes flagged
    // almost everything, because most dishes touch something seasonal.
    var risky = INGS.some(function(ing){
      return !ing.yearRound && sameIngredient(n.name, ing.name);
    });
    return {
      name: n.name, dishes: n.dishes, value: n.value,
      r: 7 + Math.sqrt(n.dishes.length / maxReach) * 20,
      x: g.w/2 + Math.cos(a) * 180 + (Math.random()-0.5)*30,
      y: g.h/2 + Math.sin(a) * 180 + (Math.random()-0.5)*30,
      vx: 0, vy: 0, fixed: false,
      colour: risky ? "var(--c-tart)" : "var(--c-savoury)"
    };
  });
  SIM.edges = buildIngredientEdges(SIM.nodes, SIM.minShared);
  SIM.sel = null;
  VIEW = { k: 1, x: 0, y: 0 };
  reheat(1);
}

function renderGraphPanel(){
  var el = document.getElementById("graphPanel");
  if (SIM.sel === null){ el.hidden = true; return; }
  var p = SIM.nodes[SIM.sel];
  var partners = SIM.edges.filter(function(l){ return l.s === SIM.sel || l.t === SIM.sel; })
    .sort(function(a,b){ return b.w - a.w; }).slice(0, 6)
    .map(function(l){ return SIM.nodes[l.s === SIM.sel ? l.t : l.s].name + " (" + l.w + ")"; });
  var names = p.dishes.slice(0, 12).map(function(id){
    var d = DISHES.filter(function(x){ return x.id === id; })[0];
    return d ? esc(d.name) : "";
  }).filter(Boolean);
  el.hidden = false;
  el.innerHTML =
    "<button class='close' id='graphClose' aria-label='Close'>\u00d7</button>" +
    "<h2 class='cap'>" + esc(p.name) + "</h2>" +
    "<p class='src' style='margin:0 0 10px'>" + p.dishes.length + " dishes \u00b7 " +
      soles(p.value) + " of menu</p>" +
    (partners.length
      ? "<p class='mono' style='font-size:10px;letter-spacing:.08em;text-transform:uppercase;" +
        "color:var(--ink-3);margin:0 0 5px'>Travels with</p><p style='font-size:.86rem;margin:0 0 12px'>" +
        partners.join(", ") + "</p>"
      : "<p class='muted' style='font-size:.86rem'>Shares no dish with another top ingredient.</p>") +
    "<p class='mono' style='font-size:10px;letter-spacing:.08em;text-transform:uppercase;" +
      "color:var(--ink-3);margin:0 0 5px'>Used in</p>" +
    "<p style='font-size:.86rem;margin:0'>" + names.join(", ") +
      (p.dishes.length > 12 ? " and " + (p.dishes.length - 12) + " more" : "") + "</p>";
}

function renderGraphControls(){
  document.getElementById("graphControls").innerHTML =
    [2,3,4].map(function(m){
      return "<button class='chip' data-shared='" + m + "' aria-pressed='" +
        (SIM.minShared === m) + "'>link at " + m + "+ shared dishes</button>";
    }).join("") +
    "<button class='chip mono' data-graph='reheat' style='font-size:11px'>shake</button>" +
    "<span class='mono' style='font-size:11px;color:var(--ink-3);margin-left:8px'>" +
      "<span style='color:var(--c-tart)'>\u25cf</span> seasonal &nbsp;" +
      "<span style='color:var(--c-savoury)'>\u25cf</span> year-round</span>";
}

function renderGraph(){
  var graph = buildGraph();
  var top = graph.slice(0, 30);
  renderGraphControls();
  if (!SIM.nodes.length) initGraphSim(); else { paintGraph(); reheat(0.5); }

  document.getElementById("graphList").innerHTML =
    "<h2>Buy these first</h2>" +
    "<p class='lede' style='margin-top:7px'>Ranked by how much of the menu each one unlocks. " +
      "The top is your standing order; the bottom is what you buy for a specific booking.</p>" +
    "<div class='tscroll' style='margin-top:16px'><table><thead><tr>" +
      "<th>Ingredient</th><th style='text-align:right'>Dishes</th><th style='text-align:right'>Menu unlocked</th>" +
    "</tr></thead><tbody>" + top.map(function(n){
      return "<tr><td class='cap'>" + esc(n.name) + "</td>" +
        "<td class='money tnum'>" + n.dishes.length + "</td>" +
        "<td class='money tnum muted'>" + soles(n.value) + "</td></tr>";
    }).join("") + "</tbody></table></div>";

  var sole = {};
  graph.forEach(function(n){
    if (n.dishes.length !== 1) return;
    var id = n.dishes[0]; (sole[id] = sole[id] || []).push(n.name);
  });
  var orphanIds = Object.keys(sole).map(Number);
  document.getElementById("graphOrphans").innerHTML =
    "<h2>Wastage liabilities &middot; " + orphanIds.length + "</h2>" +
    "<p class='lede' style='margin-top:7px'>Each is the only dish using at least one ingredient. " +
      "Cook it and you buy something nothing else will use up. Fine for a signature; a poor reason " +
      "to keep a dish nobody orders.</p>" +
    "<div class='grid g3' style='margin-top:18px'>" + orphanIds.slice(0,18).map(function(id){
      var d = null;
      for (var i = 0; i < DISHES.length; i++) if (DISHES[i].id === id) d = DISHES[i];
      if (!d) return "";
      return "<div class='card' style='padding:13px'>" +
        "<span style='font-weight:700;font-size:.875rem'>" + esc(d.name) + "</span>" +
        "<span class='mono' style='display:block;font-size:11px;color:var(--warn);margin-top:4px'><span>sole use of</span> " +
        sole[id].map(esc).join(", ") + "</span></div>";
    }).join("") + "</div>";
}
renderGraph();

// --- builder -------------------------------------------------------------
var tier = "plated", picked = [1, 2, 26, 77], serviceTime = "19:30";
var guestsEl = document.getElementById("guests");

document.getElementById("tierChips").innerHTML = Object.keys(TIERS).map(function(k){
  return "<button class='chip' data-tier='" + k + "' aria-pressed='" + (k===tier) + "'>" +
    esc(TIERS[k].name) + "</button>";
}).join("");

document.getElementById("tierChips").addEventListener("click", function(e){
  var b = e.target.closest("[data-tier]"); if (!b) return;
  tier = b.dataset.tier;
  [].forEach.call(this.querySelectorAll(".chip"), function(c){
    c.setAttribute("aria-pressed", String(c.dataset.tier === tier));
  });
  render();
});

guestsEl.addEventListener("input", function(){
  var v = parseInt(guestsEl.value, 10);
  if (!isFinite(v) || v < 1) v = 1;
  guestsEl.value = String(v);
  render();
});

// Venue state. Defaults to a San Isidro hotel at peak - the commonest job,
// and the one the old flat figure happened to over-charge for.
var eventMonth = new Date().getMonth() + 1;
var distIdx = Math.max(0, DISTRICTS.findIndex(function(d){ return d.id === "san-isidro"; }));
var venueIdx = Math.max(0, VENUES.findIndex(function(v){ return v.id === "hotel"; }));
var atPeak = true;

document.getElementById("distSel").innerHTML = DISTRICTS.map(function(d,i){
  return "<option value='" + i + "'" + (i===distIdx?" selected":"") + ">" + esc(d.name) +
    " \u00b7 " + d.driveMinutes + " min</option>";
}).join("");
document.getElementById("venueSel").innerHTML = VENUES.map(function(v,i){
  return "<option value='" + i + "'" + (i===venueIdx?" selected":"") + ">" + esc(v.name) + "</option>";
}).join("");

document.getElementById("monthSel").innerHTML = MONTHS.map(function(m, i){
  return "<option value='" + (i+1) + "'" + (i+1 === eventMonth ? " selected" : "") + ">" + m + "</option>";
}).join("");
document.getElementById("monthSel").addEventListener("change", function(e){
  eventMonth = Number(e.target.value); render();
});

document.getElementById("distSel").addEventListener("change", function(e){
  distIdx = Number(e.target.value); render();
});
document.getElementById("venueSel").addEventListener("change", function(e){
  venueIdx = Number(e.target.value); render();
});
document.getElementById("peakChk").addEventListener("change", function(e){
  atPeak = e.target.checked; render();
});

function venueCtx(){
  return { district: DISTRICTS[distIdx], venue: VENUES[venueIdx], peak: atPeak };
}

document.getElementById("pickBody").addEventListener("click", function(e){
  var b = e.target.closest("[data-id]"); if (!b) return;
  var id = Number(b.dataset.id), i = picked.indexOf(id);
  if (i > -1) picked.splice(i,1); else picked.push(id);
  render();
});

function render(){
  var t = TIERS[tier];
  var guests = Math.max(1, parseInt(guestsEl.value,10) || 1);
  var available = dishesAtTier(tier);
  var selected  = available.filter(function(d){ return picked.indexOf(d.id) > -1; });

  document.getElementById("minNote").textContent = "minimum " + t.minGuests + " for this tier";

  var dropped = picked.length - selected.length;
  document.getElementById("dropNote").innerHTML = dropped > 0
    ? "<p class='card' style='padding:11px 14px;font-size:.9rem;margin:0 0 20px'>" + dropped +
      " selected dish" + (dropped===1?"":"es") +
      " not offered at this tier — still saved if you switch back.</p>" : "";

  document.getElementById("pickBody").innerHTML = ORDER.map(function(cat){
    var rows = available.filter(function(d){ return d.category === cat; });
    if (!rows.length) return "";
    return "<section style='margin-bottom:26px'><h2 class='src h-sm' style=\"font-family:'IBM Plex Mono',monospace;" +
      "letter-spacing:.12em;text-transform:uppercase;margin:0 0 10px\">" + esc(LABELS[cat]) + "</h3>" +
      "<div class='picks'>" + rows.map(function(d){
        return "<button class='pick' data-id='" + d.id + "' aria-pressed='" +
          (picked.indexOf(d.id) > -1) + "'>" +
          "<span class='pick-top'><span class='pick-name'>" + esc(d.name) + "</span>" +
          "<span class='pick-price tnum'>" + soles(d.price) + "</span></span>" +
          "<span class='dna'><span class='u'>" + esc(d.origin) +
          "</span> <span style='color:var(--ink-3)'>→</span> <span class='p'>" + esc(d.subOrigin) +
          "</span></span></button>";
      }).join("") + "</div></section>";
  }).join("");

  document.getElementById("venueNote").textContent = VENUES[venueIdx].note;
  var q = buildQuote(selected, guests, tier, venueCtx());
  renderShop(selected, guests, tier);
  renderLegal(selected, eventMonth);
  var box = document.getElementById("quote");
  if (!q){
    box.innerHTML = "<h2 class='h-sm'>Your quote</h2><p class='muted' style='font-size:.9rem;margin-top:8px'>" +
      "Pick at least one dish to see the price.</p>";
    return;
  }
  function row(l,v,cls){ return "<div class='qrow " + (cls||"") + "'><span>" + l +
    "</span><span class='tnum'>" + v + "</span></div>"; }
  var conflicts = findConflicts(selected, tier);
  var blocked = {};
  conflicts.forEach(function(c){ if (c.severity === "blocker") blocked[c.title] = 1; });
  var sheet = buildRunSheet(selected, serviceTime);

  box.innerHTML = "<h2 class='h-sm'>Your quote</h2>" +
    "<p class='src' style='margin:4px 0 12px'>" + esc(q.tier.name) + " · " + q.guests +
      " guests · " + selected.length + " dishes</p>" +
    conflicts.map(function(c){
      var col = c.severity === "blocker" ? "var(--bad)" : "var(--warn)";
      return "<div style='border-left:2px solid " + col + ";background:var(--raised);" +
        "border-radius:0 6px 6px 0;padding:9px 11px;margin-top:10px'>" +
        "<p class='mono grouphead' style='margin:0;color:" + col + "'>" +
        "<span>" + (c.severity === "blocker" ? "Blocker" : "Warning") + "</span> &middot; <span>" +
        esc(c.kind) + "</span></p>" +
        "<p style='margin:2px 0 0;font-size:12px;font-weight:700'>" + esc(c.title) + "</p>" +
        "<p style='margin:2px 0 0;font-size:11px;line-height:1.5;color:var(--ink-2)'>" +
        esc(c.detail) + "</p></div>";
    }).join("") +
    q.warnings.map(function(w){ return "<p class='warn'>" + esc(w) + "</p>"; }).join("") +
    "<div style='margin-top:14px'>" +
      row("Menu, per guest", soles(q.menuValuePerGuest)) +
      q.serviceLines.map(function(l){ return row(esc(l.label), soles(l.perGuest), "dim"); }).join("") +
      row("Net, per guest", soles(q.netPerGuest), "tot") +
    "</div><div style='margin-top:16px;border-top:1px solid var(--line);padding-top:14px'>" +
      row("Net · " + q.guests + " guests", soles(q.netTotal)) +
      row("IGV at 18%", soles(q.igvTotal), "dim") +
      row("Client pays", soles(q.grossTotal), "tot") +
    "</div>" +
    "<div class='keep'><p class='lbl'>What you keep</p>" +
      "<p class='big tnum'>" + soles(q.contributionTotal) + "</p>" +
      "<p class='muted' style='font-size:.8rem;margin:4px 0 0'>" + soles(q.contributionPerGuest) +
      " per guest · " + Math.round(q.contributionRatio*100) +
      "% of net. Food and service costs are already out.</p></div>" +
    "<p class='note'>Kitchen rent, insurance and your own wage come out of this figure. " +
      "Estimates only — not a binding quote.</p>" +
    // The quote has to leave the app to be worth anything, and in Lima it
    // leaves on WhatsApp. Plain text, in the language the page is in, with
    // the estimate caveat carried along rather than left behind.
    "<div style='margin-top:17px;border-top:1px solid var(--line);padding-top:13px'>" +
      "<p class='mono grouphead' id='waLabel' style='margin:0 0 8px'>Send this quote</p>" +
      // The heading above is the label. Without the association a screen reader
      // announces this only as "edit text, read only".
      "<textarea id='waText' aria-labelledby='waLabel' readonly rows='8' class='mono' style='width:100%;resize:vertical;" +
        "background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:6px;" +
        "padding:9px 10px;font-size:11px;line-height:1.5'>" + esc(quoteText(q, selected)) + "</textarea>" +
      "<div style='display:flex;gap:8px;margin-top:8px;flex-wrap:wrap'>" +
        "<button class='btn' id='waCopy' type='button'>Copy the quote</button>" +
        "<a class='btn' id='waSend' target='_blank' rel='noopener' href='#'>Open in WhatsApp</a>" +
      "</div>" +
      "<p class='muted' style='font-size:.78rem;margin:8px 0 0'>Opens WhatsApp with the text " +
        "ready to send. Read it before you send it — it is an estimate, not a contract.</p>" +
    "</div>" +
    "<div style='margin-top:17px;border-top:1px solid var(--line);padding-top:13px'>" +
      "<div style='display:flex;justify-content:space-between;align-items:baseline;gap:8px'>" +
        "<span class='mono grouphead' style='margin:0'>Run sheet</span>" +
        "<label class='mono' style='font-size:10px;color:var(--ink-3);display:flex;gap:5px;align-items:center'>service" +
        "<input type='time' id='svcTime' value='" + serviceTime + "' aria-label='Service time' " +
        "class='mono tnum' style='background:var(--bg);color:var(--ink);border:1px solid var(--line);" +
        "border-radius:4px;padding:2px 5px;font-size:11px'></label></div>" +
      "<ol style='margin:10px 0 0;padding:0;list-style:none'>" + sheet.map(function(st){
        return "<li style='display:flex;gap:9px;margin-bottom:8px'>" +
          "<span class='mono tnum' style='font-size:11px;font-weight:600;color:var(--aji);flex-shrink:0'>" +
          st.clock + "</span><span style='min-width:0'>" +
          "<span class='mono grouphead' style='display:block;margin:0'><span>" + esc(st.station) +
          "</span>" + (st.offset >= 1440 ? " &middot; <span>day before</span>" : "") + "</span>" +
          "<span style='display:block;font-size:11px;color:var(--ink-2)'>" + esc(st.label) + "</span>" +
          (st.dishes.length ? "<span style='display:block;font-size:11px;color:var(--ink-3)'>" +
            st.dishes.map(esc).join(", ") + "</span>" : "") +
          "</span></li>";
      }).join("") + "</ol></div>";

  var copyBtn = document.getElementById("waCopy");
  var sendLink = document.getElementById("waSend");
  var text = quoteText(q, selected);
  if (sendLink) sendLink.href = "https://wa.me/?text=" + encodeURIComponent(text);
  if (copyBtn) copyBtn.addEventListener("click", function(){
    var ta = document.getElementById("waText");
    ta.focus(); ta.select();
    // navigator.clipboard needs a secure context and this file is opened from
    // disk, so the older API is the one that actually works here.
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    var label = copyBtn.textContent;
    copyBtn.textContent = ok ? (LANG === "es" ? "Copiado" : "Copied")
                             : (LANG === "es" ? "Presione Ctrl+C" : "Press Ctrl+C");
    setTimeout(function(){ copyBtn.textContent = label; }, 2200);
  });
}

/**
 * The quote as a message, not a screen.
 *
 * A quote nobody can send is not a quote, and in Lima it goes out on
 * WhatsApp. Head count, the menu by name, and the three numbers a client
 * actually asks about: per guest, IGV, and what they pay.
 */
function quoteText(q, selected){
  var es = LANG === "es";
  var L = es
    ? { head: "Aye, Si, Cena \u2014 cotizaci\u00f3n", guests: "invitados", menu: "Men\u00fa",
        per: "Por invitado (neto)", net: "Neto", igv: "IGV 18%", pay: "Total a pagar",
        note: "Estimado, no es un contrato. Precios sujetos a confirmar los insumos." }
    : { head: "Aye, Si, Cena \u2014 quote", guests: "guests", menu: "Menu",
        per: "Per guest (net)", net: "Net", igv: "IGV at 18%", pay: "Client pays",
        note: "An estimate, not a contract. Prices subject to confirming the ingredients." };
  var lines = [L.head, q.tier.name + " \u00b7 " + q.guests + " " + L.guests, "", L.menu + ":"];
  selected.forEach(function(d){ lines.push("\u2022 " + d.name); });
  lines.push("");
  lines.push(L.per + ": " + soles(q.netPerGuest));
  lines.push(L.net + ": " + soles(q.netTotal));
  lines.push(L.igv + ": " + soles(q.igvTotal));
  lines.push(L.pay + ": " + soles(q.grossTotal));
  lines.push("");
  lines.push(L.note);
  var text = lines.join("\n");
  // Written in the viewer's language here rather than by the dictionary
  // walker, so record it or the coverage figure reports Spanish as English.
  if (es) APPLIED[text.replace(/\s+/g, " ").trim()] = 1;
  return text;
}

document.getElementById("findQ").addEventListener("input", function(e){
  findQ = fold(e.target.value.trim());
  document.getElementById("findQClear").classList.toggle("on", !!e.target.value);
  renderFind(); applyLanguage();
});
document.getElementById("findQClear").addEventListener("click", function(){
  var i = document.getElementById("findQ");
  i.value = ""; findQ = ""; i.focus();
  document.getElementById("findQClear").classList.remove("on");
  renderFind(); applyLanguage();
});
renderFind();
renderDay();
syncMatrix();
renderRecDiets();
initQuickSearch();
initFilterBoxes();
recBadge();
navFade = initNavFade();
render();

/* ---- quick search -------------------------------------------------------
 *
 * One box that reaches everything: a dish, an ingredient, a recipe step, a
 * section of the app. Opens on "/" or Cmd-K from anywhere, arrows to move,
 * Enter to go. The point is that nobody has to know which pane a thing lives
 * on before they can look for it.
 */
var qsSel = 0, qsHits = [];

function qsIndex(){
  var out = [];
  DISHES.forEach(function(d){
    out.push({ kind: "dish", label: d.name, sub: LABELS[d.category] + " \u00b7 " + soles(d.price),
      hay: dishHaystack(d), go: function(){ goToDish(d); } });
  });
  INGS.forEach(function(i){
    out.push({ kind: "ingredient", label: i.name,
      sub: i.dishes.length + " " + (i.dishes.length === 1 ? "dish" : "dishes"),
      hay: fold(i.name + " " + i.note),
      go: function(){ show("seasonal"); } });
  });
  [["home","Home"],["moments","The evening"],["find","Find dishes"],["menu","The matrix"],
   ["seasonal","Season"],["compare","Compare"],["graph","Ingredients"],["recipes","Recipes"],
   ["day","The day"],["packages","Packages"],["builder","Build a menu"]].forEach(function(t){
    out.push({ kind: "section", label: t[1], sub: "", hay: fold(t[1] + " " + (ES[t[1]] || "")),
      go: function(){ show(t[0]); } });
  });
  return out;
}
var QS_ALL = null;

/** Send the reader to the dish itself, not merely to the pane it lives on. */
function goToDish(d){
  show("recipes");
  recClearAll();
  var box = document.getElementById("recSearch");
  box.value = d.name;
  recQuery = fold(d.name);
  document.getElementById("recQClear").classList.add("on");
  renderRecipes();
  applyLanguage();
}

function qsRender(){
  var el = document.getElementById("qsList");
  if (!qsHits.length){
    el.innerHTML = "<p class='qs-none'>Nothing matches that.</p>";
    return;
  }
  var last = "", html = "";
  qsHits.forEach(function(h, i){
    if (h.kind !== last){
      last = h.kind;
      html += "<p class='qs-grp'><span>" +
        (h.kind === "dish" ? "Dishes" : h.kind === "ingredient" ? "Ingredients" : "Sections") +
        "</span></p>";
    }
    html += "<button type='button' class='qs-item" + (i === qsSel ? " sel" : "") +
      "' role='option' aria-selected='" + (i === qsSel) + "' data-qs='" + i + "'>" +
      "<span class='qs-t'>" + esc(h.label) + "</span>" +
      (h.sub ? "<span class='qs-s'>" + esc(h.sub) + "</span>" : "") + "</button>";
  });
  el.innerHTML = html;
  [].forEach.call(el.querySelectorAll("[data-qs]"), function(b){
    b.addEventListener("click", function(){ qsGo(Number(b.dataset.qs)); });
  });
  var sel = el.querySelector(".sel");
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
}

function qsSearch(v){
  var q = fold(v.trim());
  QS_ALL = QS_ALL || qsIndex();
  if (!q){
    // An empty box is not an empty result: offer the sections, which is what
    // somebody who opened this by accident is looking for.
    qsHits = QS_ALL.filter(function(h){ return h.kind === "section"; });
  } else {
    var starts = [], contains = [];
    QS_ALL.forEach(function(h){
      var at = h.hay.indexOf(q);
      if (at === -1) return;
      (fold(h.label).indexOf(q) === 0 ? starts : contains).push(h);
    });
    qsHits = starts.concat(contains).slice(0, 40);
  }
  qsSel = 0;
  qsRender();
  applyLanguage();
}

function qsOpen(){
  var back = document.getElementById("qsBack");
  if (!back.hidden) return;
  back.hidden = false;
  var box = document.getElementById("qsQ");
  box.value = "";
  qsSearch("");
  box.focus();
}
function qsClose(){
  document.getElementById("qsBack").hidden = true;
}
function qsGo(i){
  var h = qsHits[i];
  if (!h) return;
  qsClose();
  h.go();
}

/** Show the fade only on the side that actually has more tabs. */
function initNavFade(){
  var wrap = document.querySelector(".navwrap");
  var nav = wrap.querySelector("nav");
  function upd(){
    var max = nav.scrollWidth - nav.clientWidth;
    wrap.classList.toggle("more-right", nav.scrollLeft < max - 2);
    wrap.classList.toggle("more-left", nav.scrollLeft > 2);
  }
  nav.addEventListener("scroll", upd, { passive: true });
  window.addEventListener("resize", upd);
  upd();
  return upd;
}
var navFade = null;

function initQuickSearch(){
  var back = document.getElementById("qsBack");
  var box = document.getElementById("qsQ");
  box.addEventListener("input", function(e){ qsSearch(e.target.value); });
  back.addEventListener("mousedown", function(e){ if (e.target === back) qsClose(); });
  box.addEventListener("keydown", function(e){
    if (e.key === "ArrowDown"){ e.preventDefault(); qsSel = Math.min(qsSel + 1, qsHits.length - 1); qsRender(); }
    else if (e.key === "ArrowUp"){ e.preventDefault(); qsSel = Math.max(qsSel - 1, 0); qsRender(); }
    else if (e.key === "Enter"){ e.preventDefault(); qsGo(qsSel); }
    else if (e.key === "Escape"){ e.preventDefault(); qsClose(); }
  });
  document.addEventListener("keydown", function(e){
    var t = e.target, tag = t && t.tagName;
    var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)){ e.preventDefault(); qsOpen(); }
    else if (e.key === "/" && !typing){ e.preventDefault(); qsOpen(); }
    else if (e.key === "Escape" && !back.hidden) qsClose();
  });
  [].forEach.call(document.querySelectorAll("[data-openqs]"), function(b){
    b.addEventListener("click", qsOpen);
  });
}

// Everything is painted; translate what is on screen and label the toggle.
applyLanguage();

/*
 * The client trim, last.
 *
 * Doing this at the top broke the page: the renderers below bind their handlers
 * to elements inside panes, and removing a pane before they run left them
 * calling addEventListener on null. Everything renders first, then the panes a
 * client does not get are taken out - not hidden, taken out, because an empty
 * pane still renders and a hidden tab is still reachable from a keyboard.
 *
 * There is nothing in them to protect by this point; the data was stripped
 * before the file was written. This is tidiness, not security.
 */
if (CLIENT_BUILD) {
  [].forEach.call(document.querySelectorAll(".tab[data-pane]"), function(t){
    if (PANES.indexOf(t.dataset.pane) === -1) t.remove();
  });
  [].forEach.call(document.querySelectorAll("[id^=pane-]"), function(el){
    if (PANES.indexOf(el.id.slice(5)) === -1) el.remove();
  });
  document.documentElement.setAttribute("data-client", "1");
  show("home");
}
})();
</script>
</body>
</html>
`;

// The page script is emitted from a template literal, which quietly eats one
// level of backslash: /\d+/ ships as /d+/, and /\([^)]*\)/ ships as
// /([^)]*)/ - a regex that matches empty everywhere. That has silently blanked
// the whole page once, broken the ingredient graph once, and zeroed the
// seasonal colouring once. Parse what we are about to write, and refuse to
// write it if it is not valid JavaScript.
function assertScriptParses(pageHtml) {
  const m = /<script>\n([\s\S]*?)<\/script>/.exec(pageHtml);
  if (!m) throw new Error("no inline script found in the built page");
  try {
    new Function(m[1]);
  } catch (err) {
    throw new Error(`the emitted page script is not valid JavaScript: ${err.message}`);
  }
}
assertScriptParses(html);

// The flag is not a filename. Default the client build to its own name so it
// can never overwrite the working file by accident.
const outArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const out = outArg || path.join(ROOT, CLIENT_BUILD ? "menu-for-clients.html" : "standalone.html");
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB, ${DISHES.length} dishes)`);
