# Aye Si Cena

Scottish-Peruvian catering in Lima. Next.js 14 (App Router), TypeScript, Tailwind.

The name always leads. "Aye, Si, Cena" is the business; *dinner* is the
explanation, not the title.

## Picking this up on another machine

```
git clone https://github.com/datacendia/aye_si_cena.git
cd aye_si_cena
npm install
npm run dev          # http://localhost:3000
```

Needs Node 20 or newer (built on 22). The spreadsheet importer additionally
needs Python 3 with `openpyxl` — `pip install openpyxl` — but only if you are
re-importing the matrix. Everything else runs on Node alone.

Before you start work: `npm run validate`. It should say 480 passing.

## Where things stand

- 223 dishes, ids 1-223, all in the spreadsheet
- 223 recipes, one per dish — complete, 1,729 ingredient lines, all priced
- 426 tests passing
- Spanish is 100% of every pane, recipes included
- **Every cost is an unverified estimate.** Nothing is quotable until a
  market run replaces them. The tests assert they stay flagged.
- **The veda dates are estimates too.** They move every year by resolución
  ministerial. Check gob.pe/produce before selling crab, scallop, corvina,
  chita, bonito or anchoveta.

## What's here

| Route | Purpose |
|---|---|
| `/` | Landing — the name, the three tiers, the signature dishes |
| `/menu` | All 223 dishes with cost, menu value and food-cost % |
| `/packages` | The three service tiers and the rates behind the quote maths |
| `/builder` | Pick a tier, head count and dishes; live quote, conflicts, run sheet |
| `/find` | Filter by event type, flavour axis and service format |
| `/moments` | The evening as a sequence — arrival, sit-down, late |
| `/compare` | The same menu costed across all three tiers side by side |
| `/recipes` | Ingredients and method for every dish |
| `/seasonal` | What comes off the menu each month, and why |
| `/graph` | Which dishes share ingredients, and which stand alone |

## Two products, one engine

There are two front ends, and they are not rivals.

`standalone.html` is the tool you carry. One file, no server, opens offline in
under 100ms from a phone in a market. It is complete - all fourteen modules in
`lib/` - and it is the one to use when you are standing at a stall.

The Next.js app is the one with a lock on it. It has logins, a database and
roles, because it does what a single file structurally cannot: remember a quote,
tell one person from another, and carry a price that changed this morning.

**Never send `standalone.html` to a client.** It carries all 223 costs, all 223
suppliers and every food-cost percentage. It is your commercial position in one
file. The WhatsApp quote export is the client-facing artefact; that is why it
exists.

## The file you can actually send someone

`standalone.html` must never go to a client. It carries 223 costs, 223 supplier
names, every food-cost percentage and every recipe — your commercial position in
one file. This is the version that can:

```
npm run standalone:client        # writes menu-for-clients.html, then checks it
```

Stripped at the DATA level, not hidden in CSS. A hidden column is still in the
document, one keystroke from view, and there is no point sending somebody a file
and relying on them not to look:

| | standalone.html | menu-for-clients.html |
|---|---|---|
| Dish cost, supplier, FC% | yes | **removed from the data** |
| The three price tables | yes | **emptied** |
| Recipe method, quantities, notes | yes | **removed** |
| Ingredient names | yes | kept — the allergen engine reads them |
| Panes | 11 | 5: home, the evening, find, menu, packages |
| Spanish | full | full, minus the recipe dictionary |

The dietary engine works untouched, so a guest can still filter for coeliac or
check what is in a dish. What they cannot see is what it cost you, who you buy
from, or how it is made.

`scripts/verify-client-build.mjs` reads the bytes rather than the page, and it
earned its place immediately: the first build stripped the recipe notes and
still shipped their **Spanish translations**, which carry the same text —
"Terminal Pesquero; smoke it yourself over tea and sugar if you can". The
dictionary keys are the English strings, suppliers and all. Nothing that looks
at the rendered page would have caught that.

## Who can see what

Three roles, and the gap between them is money.

| | owner | chef | client |
|---|---|---|---|
| Cost, margin, food-cost %, supplier | yes | **no** | **no** |
| Menu price | yes | no | their own quote |
| Recipes, quantities, run sheet | yes | yes | no |
| Build and price a quote | yes | no | no |
| Record a verified market price | yes | yes | no |
| Other clients' work | yes | yes | **no** |

This is enforced on the server, in `lib/permissions.ts`, before anything is
serialised. It is not a display concern: hiding a column in CSS leaves the
number in the payload, and the payload is one keystroke away in devtools. Every
dish that reaches a page goes through `visibleDishes(DISHES, role)` or
`fullDishes(DISHES, role)`, and three tests hold that shut:

- `__tests__/permissions.test.ts` — no cost value survives into a chef or
  client payload, for any of the 223 dishes.
- `__tests__/route-guards.test.ts` — every page checks the viewer, no page
  passes `DISHES` raw, and nothing is prerendered.
- Both fail loudly if the chokepoint is bypassed. They were written by
  breaking it on purpose and watching them fail.

The nav hides links a role cannot use. That protects nothing — a typed URL
skips it — and the pages check again regardless.

## Quotes, and prices that change

Two things the standalone file cannot do, and the reasons the server exists.

**A quote keeps.** Price a menu on the builder, name it, and it is saved with
its dish list and the totals as quoted. Reopen it in March and it still says
what you charged, because the price and cost each dish carried at the moment of
quoting are written down beside it — a quote is not recalculated when the menu
is repriced under it. Mark it sent, won or lost. A client with a login sees
their own quotes and gets a 404 on anyone else's.

The totals are never accepted from the browser. The figures beside the save
button were computed client-side and are deliberately not submitted; the server
prices the dish ids again with the same `lib/pricing.ts`. A number that travels
through a form is a number somebody can edit.

**A price you verified applies immediately.** Every figure in `data/prices.ts`
is an estimate — the whole matrix still says `costVerified: false`. Come back
from Surquillo, put what you paid into `/prices`, and every cost in the app
moves: no rebuild, nothing to redownload. The page shows what you paid against
what the app guessed, so a wrong estimate stands out.

```
butter/kg   S/ 41.50   estimate S/ 32.00   +30%   Makro, 5kg block
```

Rows are never edited in place — a new price supersedes the last — so what you
paid in March is still answerable in September, which is the only way to see a
supplier drifting upward.

Both the owner and a chef may record a price, because a chef does the buying.
An ingredient the recipes do not name is refused with the nearest matches, since
a price for something nothing buys would never reach a dish.

## Clients, and the calendar

**A diet recorded once catches the dish forever after.** An allergy is a fact
about the people eating, not about one event — "didn't we do a coeliac last
time?" is not a food safety process. Note it against the client and every menu
quoted for them is checked against it, naming the ingredient:

```
Ferguson cannot eat 4 of these
  COELIAC / GLUTEN-FREE
    Haggis Bonbons              — pinhead oat, flour, panko
    Morcilla & Apple Empanadas  — empanada dough, pinhead oat
```

The check asks `lib/dietary.ts` — the same engine behind the fifteen filters and
the allergen declarations — so this warning and the `/find` filter can never
disagree about the same dish. A test asserts exactly that. Only diets the engine
can answer for are stored; free text would look like a check and be nothing of
the kind.

**The day check reads from real bookings.** `lib/capacity.ts` always knew
whether one kitchen, one van and one crew could deliver two jobs — it just had
nothing real to ask about, and compared examples typed into a form. Now it reads
the calendar:

```
SATURDAY 12 SEPTEMBER · 2 jobs
  CREW  13 people needed across both at once; you have 4.
  VAN   One van cannot load in at San Isidro and La Molina in the same window.
```

A booking with no district comes back as *unjudgeable* rather than being
defaulted to somewhere plausible. Guessing San Isidro would produce a confident
answer about a journey nobody is making, which is the kind of wrong that reads
as right.

## Both languages, or it does not save

The app used to be English only while the standalone was at 100% Spanish —
exactly backwards, since the chef reads Spanish and the chef pages were the
English ones. The cause was never that translating is hard. It was that nothing
made the second column compulsory, and an optional translation is an
out-of-date one.

Every phrase now lives in `lib/copy.ts` with both languages and a stable key,
and `site_copy` in the database supersedes it. **A save with an empty Spanish is
refused** — in the repository, where a second caller cannot skip it. Verified by
stripping the `required` attribute in devtools and posting anyway; the server
still says no.

Keys are ids, never the English text. The standalone keys on English and gets
away with it because the whole page is rebuilt at once; here, editing a heading
would orphan its translation without a word. A missing phrase renders as
`⟨key⟩`, so it looks wrong on the page rather than merely being absent.

The language is stored on the account, not in a cookie — it is a fact about a
person, not a browser. Default Spanish. `npm test` fails if any phrase is
missing either language.

## Admin

`/admin` edits the words on the site and the editorial fields of a dish — name,
description, menu price, category, licence, tier — without a deploy. Renaming a
dish requires its Spanish name; rewriting a description requires its Spanish.
Changing a price does not, because there is no Spanish for 42.

**What Admin deliberately cannot edit: allergens and the vegetarian flag.** They
are read from the recipe by `lib/dietary.ts`. A hand-editable allergen field is
precisely what this repository shipped once — it disagreed with its own recipe on
165 of 223 dishes and offered 50 gluten-bearing dishes as gluten-free. Change the
recipe and the allergens follow. The screen says so where somebody would
otherwise go looking for the field.

## Hosting it

Netlify for the app, Neon for the database. Both free tiers permit commercial
use, which matters: Vercel's Hobby tier does not, and a catering business on it
would owe US$20 a month.

```
# 1. a database
#    neon.tech → new project → Connection Details → the POOLED string
# 2. locally
cp .env.example .env.local        # paste DATABASE_URL, set AUTH_SECRET
npm run db:migrate                # eleven tables
npm run user:create owner you@example.com "Your Name"
npm run dev

# 3. on Netlify
#    Site configuration → Environment variables:
#      DATABASE_URL   the same Neon string
#      AUTH_SECRET    openssl rand -base64 32
#      AUTH_URL       https://your-site.netlify.app
```

There is no sign-up page. Every account is made with `npm run user:create`,
because every account can see something a stranger should not. The password is
read from stdin rather than an argument, so it stays out of your shell history.

A local Postgres works too — the driver follows the URL, so you do not need a
Neon account to run the whole thing on your own machine:

```
DATABASE_URL="postgresql://postgres@localhost:5432/ayesicena"
```

Neon's free tier suspends a database that has been idle a few minutes, so the
first page load after a quiet spell pays a second or two of cold start.

### Forgotten passwords

There is no email service here and there is not going to be one — an SMTP
account is the first line item that would stop this costing S/0 a month, and a
link sitting in a spam folder on a Saturday afternoon is not a recovery path
anyway.

So the owner issues the link and sends it over WhatsApp, the way the first
password was sent. **Admin → Logins → New password link.** It is shown once, it
works for one hour, it works once, and only its SHA-256 reaches the database —
so a leaked backup carries nothing anybody can sign in with.

Anyone who simply wants a better password does it themselves at **Account**,
without involving the owner at all.

### Wrong passwords

The login is rate limited: ten failures against one address in fifteen minutes,
or thirty from one address on the network, and it stops answering. The refusal
is silent — saying "too many attempts" would confirm that the address is worth
attacking, and the person locked out is almost never the person guessing.
Getting it right clears the count, so one typo after a bad run is not a lockout.

The counters live in a table rather than in memory because the app runs in
Netlify functions, where each request may be a fresh process and an in-memory
counter would reset itself and protect nothing.

### Who can see what

There are two sites here, on one deployment.

**The shop window** — `/`, `/carta`, `/paquetes`, `/eventos` — is open to
anybody. It carries the 223 dishes with their allergens and diets, three
packages with a per-guest figure to start from, and a WhatsApp link. It carries
no cost, no supplier, no margin, no recipe and no per-dish price.

The shop window needs **no database at all** — it is checked that way in CI.
Neon's free tier suspends an idle database, and when it does the quotes and the
recipes can wait; the page a customer found on Instagram cannot.

**Everything else** is behind the login: the matrix, the recipes, the quotes,
the clients, the bookings, the verified prices, the admin. Signing in lands you
on `/panel`.

The separation is structural rather than remembered. Public pages read
`lib/public.ts`, which builds each dish by **picking** fields from a whitelist
rather than dropping the sensitive ones — so a field added to `Dish` next spring
reaches the internet only when somebody puts it on that list on purpose, in a
commit somebody reviews. `__tests__/public.test.ts` fails the moment `Dish`
grows a field nobody has classified, and `npm run verify:app` opens each public
page with no cookie at all and reads the bytes for supplier names and cost
figures.

Set `NEXT_PUBLIC_WHATSAPP` to your number, digits only, international form.

### Checking it

```
npm run validate           # typecheck, lint, 770 tests
npm run verify:standalone  # the single file, driven in Chromium
npm run standalone:client  # the client file, read byte by byte for leaks
npm run verify:app         # the app itself, signed in, in Chromium
npm run verify:nodb        # the shop window with DATABASE_URL unset
```

`verify:app` needs the app running and an owner to sign in as:

```
export DATABASE_URL=… AUTH_SECRET=… AUTH_URL=http://localhost:3300
npm run db:migrate && npm run user:create owner you@example.com "You"
npm run build && npx next start -p 3300 &
VERIFY_EMAIL=you@example.com VERIFY_PASSWORD=… npm run verify:app
```

It exists because the unit tests cover `lib/` and the standalone verifier covers
the single file, and between them sat the pages themselves — where a server
action meets a form. Everything it found on its first run was invisible from
reading the code: five ticked checkboxes arriving as one, an untouched price box
parsed as zero and refusing a rename, a licence flag that could be switched on
and never off, and three pages scrolling sideways at 390px.

### Backups

Neon's free tier has no point-in-time recovery, and there is no `pg_dump` in a
serverless function. So the backup runs from your laptop:

```
npm run backup                    # → backups/ayesicena-20260914T0412Z.json
npm run restore -- backups/ayesicena-20260914T0412Z.json
```

It saves only what exists nowhere else — clients, quotes, bookings, verified
prices, and the words you rewrote on the site. The 223 dishes and their recipes
are in `data/`, generated from the spreadsheet and held in git; they are already
backed up by something better than this.

Password hashes are included, because a restore that leaves everybody unable to
sign in is not a restore. That makes the file as sensitive as the database —
keep it where you would keep the database. `backups/` is gitignored.

`restore` refuses to run against a database that already has rows in it, unless
you pass `--force`. A restore is something you reach for at the worst possible
moment, and the failure worth designing against is not "it did not work" but
"it ran against the live database".

## The spreadsheet is the master

`data/ayesicena-matrix.xlsx` is the source of truth for dishes, costs and
sourcing. Edit it, then regenerate:

```
npm run import-matrix
```

That rewrites `data/dishes.ts`, `data/flavours.ts` and `data/sourcing.ts`. Do
not hand-edit those three — they carry a GENERATED header and your changes
will be overwritten on the next import.

The import runs in two steps, and the second one matters. The spreadsheet no
longer carries an allergen column: `scripts/import-matrix.py` writes
`allergens: []` on every row and `npm run derive-allergens` fills it in from
the recipes, through `lib/dietary.ts`. `npm run import-matrix` chains both, so
you only need the second command if you edited a recipe rather than the
spreadsheet.

The column used to be hand-typed, derived by regex from each dish's marketing
copy. It disagreed with the recipe on 165 of 223 dishes — of the 103 the menu
offered as gluten-free, 50 contained gluten — and it could not name celery,
mustard, sesame, soya, sulphites or lupin at all. Two tests in
`__tests__/dietary.test.ts` fail if the derived file is ever left stale, so
this cannot silently come apart again.

After a market run, the loop is: update the cost column, flip "Cost verified?"
to Yes, re-import, run the tests. Anything the new price pushes over the
food-cost ceiling fails immediately and by name.

## Where the event is

`lib/venues.ts` costs transport against the actual venue: drive time from the
kitchen, what Lima rush hour adds to it, fuel, load-in crew, and a generator
when a live station has no mains power. `data/venues.ts` holds twelve districts
and seven venue types.

The tiers used to carry a flat transport figure — S/60 for boxes, S/300 for
plated — the same whether the van went ten minutes down the road or ninety-five
minutes south to Asia. At the far end that understated the line by S/818 on one
event. It also over-charged every near job, which loses work.

Pass `district` and `venue` to `buildQuote` and it costs the real run. Omit them
and it falls back to the flat figure and labels itself an estimate on the line,
so an unset venue is visible rather than silently wrong.

Every rate in that module is UNVERIFIED. Drive the districts you actually work
in and replace the numbers.

## What a recipe actually costs

`lib/costing.ts` prices every one of the 1,729 ingredient lines from
`data/prices.ts`, multiplies the batch out and divides by the yield, then
compares the answer with the cost the matrix claims. It never overwrites
either figure — which of the two is wrong is a question for a market run.

The gap is large and it runs mostly one way. Hand-checked example: 103
Highland Toffee is 1.5 kg sugar, 400 g butter and 400 ml condensed milk —
S/24.80 for 120 shards, so **S/0.21 a shard against a claimed S/1.20.** The
bakery is systematically over-costed, because sugar and flour are cheap and
the estimates assumed otherwise.

Prices in `data/prices.ts` are Lima estimates and are flagged unverified,
exactly like the dish costs. The point is not that the numbers are now right;
it is that they are now *checkable*, and the report says which to check first.

## Scaling to a real event

`lib/scaling.ts` takes a menu, a head count and a tier, and scales each recipe
to what the event needs — whole batches only, because half a batch of
shortbread is a different biscuit. `shoppingList()` then adds the scaled lines
together across the menu, so butter appears once with a total and a price, and
every row names the dishes that want it.

Canapés scale by bites per guest using the same rule `lib/pricing.ts` prices
by, so the shopping list and the quote cannot disagree about how much food is
being made.

## The kitchen book

```
npm run book
```

Writes `kitchen-book.html` — all 223 recipes, indexed by course, with page
breaks set so a recipe never splits across a page. Print to PDF from a
browser. Generated from the same data as the app, so it cannot drift.

`npm run book:es` writes `kitchen-book-es.html`: the same book with the market
names a Lima stallholder actually uses, so it can be handed to a cook or taken
shopping. `beef shin` is *osobuco*, `spring onion` is *cebolla china*, `ginger`
is *kion*.

## Spanish

The buyers are Peruvian, so **Spanish is the default** and English is the
toggle, not the other way round. The choice is remembered per browser.

`data/i18n.ts` holds the dictionary. Strings the app composes at render time —
"Staff — 2 waiters, 1 chef" is a different string every time — are matched by
shape in `ES_PATTERNS` instead, with the numbers carried through untouched.

Two things stay in English on purpose, and the coverage figure knows it:
**dish names**, because "Haggis Bonbons" is the product and translating it
sells a different thing; and **supplier names**, because Surquillo N.1 is
Surquillo N.1.

Four files carry it: `data/i18n.ts` (interface and dish descriptions),
`data/i18n-ingredients.ts` (what to ask for at the stall),
`data/i18n-recipes.ts` (every method step, yield, make-ahead note and hold
time — 2,079 strings), and `data/i18n-prep.ts`, which is the half of an
ingredient line that comes after the comma. That last one exists because
"300 g butter, softened" is an ingredient *and* an instruction, and
translating only the first half produced "mantequilla, softened", which is
worse than either language on its own.

`npm run verify:standalone` reports coverage per pane. **Every pane reads
100%**, recipes included.

The translator works on whole text nodes, so a label the renderer glues into
a longer string is invisible to it. Where that happens the fix is structural —
give the label its own `<span>` — not another dictionary entry. There is a
test holding the standalone's copy of the category labels to `lib/dishes.ts`,
because those were once stored pre-escaped for innerHTML ("Canapés &amp;
bites") and two of the seven categories silently stayed English for months.

## The pricing rules

`lib/pricing.ts` is the only place money is calculated, and it exists to
enforce three rules that are easy to get wrong and expensive to get wrong:

1. **IGV (18%) is explicit.** Quotes are stated net; IGV is added on top.
   Quoting gross while budgeting as if it were net loses about S/ 61 per guest
   at a S/ 400 head price.
2. **Canapes are priced per guest as a bite count**, never per piece. The
   per-piece figure in the data is a costing device only.
3. **Per-event costs come off before anything is called profit.** Menaje,
   staff, transport and packaging are deducted, so `contribution` is the real
   number.

`__tests__/pricing.test.ts` locks all three down.

## Fusion runs both ways

The matrix started as one move only: a British or European dish rebuilt with
Peruvian produce. Fifty dishes now run it the other way — a Peruvian dish as
the base, with the Scottish or European swap made on top of it. Causa with
haggis in it, ceviche with a dill leche de tigre, lomo saltado with chips
fried in dripping, a chupe de cangrejo thickened with oats the way a partan
bree is.

`__tests__/matrix.test.ts` holds that block to at least twenty dishes across
four categories, and requires every entry to actually name its European move.

**Scottish stays above half.** The rule was relaxed once, to "Scottish is the
largest line", on the grounds that Scottish-above-half and a real
Peruvian-base block were incompatible. They were only incompatible on a
191-dish menu. Growing the matrix was the honest fix rather than moving the
line: **Scottish 112 of 223 (50.2%), Peruvian 50 (22.4%).** If this test ever
fails, the answer is to cook more Scottish dishes.

## The standalone build

`npm run standalone` writes a single self-contained `standalone.html` — the
whole thing, no server, openable from a USB stick or emailed to a client.

It re-implements the quote maths in vanilla JS, which is a real risk of drift,
so `npm run verify:standalone` drives it in a headless browser and checks its
rendered figures against `lib/pricing.ts`. Run that after any pricing change.
It needs Playwright's Chromium available locally.

Self-contained means self-contained: the three typefaces are subsetted to the
characters the page uses and embedded, and the verifier fails the build if the
page asks the network for anything. It used to link Google Fonts from its head,
which cost 13.2 seconds to first paint when that request failed — the exact
situation the file exists for. It now paints in under 100 ms with no connection
at all. `npm run fetch-fonts` refreshes the committed `.woff2` files, and is
only needed after adding a language or a symbol the page did not use before.

The verifier also holds the browser ports of the canonicaliser, the costing,
the dietary rules, the vedas and the substitution planner to their TypeScript
originals. They drifted once and the shopping list asked a butcher for two
litres of lamb.

The builder writes the quote as a WhatsApp message — head count, the menu by
name, per guest, IGV, and what the client pays — with a copy button and a
`wa.me` link. The verifier checks the total in the message is the same number
the panel shows.

## Commands

```
npm install
npm run dev                # local dev
npm run test               # pricing, matrix, recipes, seasonal, graph, conflicts
npm run typecheck
npm run validate           # typecheck + test — run this before committing
npm run build
npm run import-matrix      # regenerate data files from the spreadsheet, then derive allergens
npm run derive-allergens   # re-read allergens off the recipes (after a recipe edit)
npm run fetch-fonts        # re-subset and re-commit the three embedded typefaces
npm run standalone         # build the single-file HTML
npm run verify:standalone  # build it, then check it in a real browser
npm run book               # the kitchen book, English
npm run book:es            # the kitchen book, Spanish market names
```

## Allergies and diets

`lib/dietary.ts` answers fifteen questions a real guest asks — the fourteen EU
declarable allergens plus pork and alcohol, and diets from vegan through
coeliac, low-FODMAP, lower-carb, halal and kosher on ingredients, children and
soft texture.

It reads the **recipe**, not the marketing copy, and it walks into
sub-preparations. Every ingredient the recipes use is explicitly classified in
`data/ingredient-attributes.ts`; an unclassified one fails the build rather
than being assumed safe, and voids the dish's answers rather than guessing.

Two of these are deliberately cautious about what they are not: halal here is
ingredients only and says nothing about slaughter, and lower-carb is a filter
rather than a nutrition panel. Read the notes before repeating either to a
guest.

## Vedas

`data/vedas.ts` holds Peru's legal closed seasons for the six species the
matrix uses. A veda is not a seasonality note: selling inside one is an
offence, so the planner blocks the dish outright rather than warning about it.

The dates encoded are the usual shape of the year and nothing more. They move
by resolución ministerial, sometimes twice in a year, and scallop vedas are
set bank by bank. `verified: false` on every row means nobody has checked.

## The market run

```
npm run market-run        # market-run.html
npm run market-run:es     # market-run-es.html, with the stall names
```

152 of 223 dishes are more than 40% away from their claimed cost, and checking
380 ingredients alphabetically is a wasted morning — a third of them are a
spoon of spice and move the answer by pennies.

So the sheet ranks by **exposure**: what the matrix would spend on an
ingredient if it cooked one batch of every dish that uses it. Butter is first
because it is in 86 dishes; corvina is second because it is dear. The printed
sheet covers the top 80% of spend in 88 lines, with the current estimate, the
name to ask for at the stall, and a blank to write the real price in. There is
a rule under row 30: verify that much and the portfolio figure stops being a
guess.

It costs through `lib/costing.ts` rather than its own copy of the unit rules.
The first draft had its own, which was stricter than the real thing: it read
"600 g berros" against a per-bunch price, reported nineteen honest recipe
lines as broken, and ranked watercress first. `scripts/ts-alias.mjs` is what
lets a plain Node script import the app's TypeScript, so there is one costing
implementation rather than two.

## Still to do

Everything left needs somebody in Lima. None of it can be done from a laptop.

- Verify all 223 costs against real Lima suppliers. `npm run market-run`
  prints the order to do it in — the 88 ingredient lines that carry 80% of the
  spend, butter first. `costVariance()` reports 152 of 223 dishes more than
  40% out, and the gap runs mostly one way.
- Replace the estimates in `data/prices.ts` with real invoice prices
- Time the drive to the districts you actually work in, and replace the
  estimates in `data/venues.ts`
- Confirm the 19 seasonal windows against the market, and the eight *vedas*
  against the current resolución ministerial at gob.pe/produce
- A real allergen audit. What `lib/dietary.ts` reports is read off the recipe,
  which is a far better starting point than dish text was, but it is still not
  a legal audit and the ingredient table is unverified against actual products
- Netlify is not connected to this repo — deploys are still manual. There is a
  `netlify.toml` ready for it; connecting it needs the account.

The React app under `app/` and the single-file `standalone.html` are two
implementations of the same data. The standalone is what gets sent to a
client; the React app is the development surface. `/find`, `/graph` and
`/builder` have drifted — the standalone has the diet chips, a real force
simulation and the shopping list, and the React pages do not. Reconciling
them means either porting three pages or retiring them, and that is a
decision about which surface is the product.
