# Aye, Si, Cena

Scottish-Peruvian catering, Lima. The name always leads; "yes, dinner" is
explanation, never a replacement.

## What this is

A Next.js app and a single-file HTML menu, built from one spreadsheet.
223 dishes, their recipes, their costs, and the rules for pricing an
event in Lima — IGV at 18%, transport by district and hour, the liquor
*giro especial*, and the *vedas*, the legal closed seasons for fish.

## Two front ends, one source

- `app/` — the server app. Logins, quotes, clients, bookings, verified
  prices, the admin screens. Needs Postgres.
- `standalone.html` — one file, no network, no server, everything
  embedded. Built by `scripts/build-standalone.mjs`. This is what goes on
  a phone in a market with no signal.
- `standalone.html --client` — the same file with every cost, supplier
  and quantity removed. Built and then *verified by reading the bytes*,
  because that is how a leak through the Spanish dictionary was found
  after the English had been stripped.

Both read `data/`, which is generated from `data/ayesicena-matrix.xlsx`.
The spreadsheet is the master. Do not hand-edit generated files in
`data/`; edit the sheet and run `npm run import-matrix`.

## The rules that matter

**Money is owner-only.** `cost`, `source`, `costVerified` and everything
derived from them. A chef sees no money at all; a client sees `price` and
nothing else. This is enforced in `lib/permissions.ts` *before anything is
serialised* — not in CSS, because a hidden column is still in the RSC
payload. Every dish that reaches a page goes through `visibleDish` or
`fullDishes`. `__tests__/route-guards.test.ts` bans the literal
`dishes={DISHES}` for this reason.

**Allergens are derived, never typed.** `lib/dietary.ts` reads the recipe.
There is no editable allergen field and there will not be one: the
repository shipped with hand-typed allergens once and they disagreed with
their own recipes on 165 of 223 dishes, offering 50 gluten-bearing dishes
as gluten-free.

**Both languages or neither.** Every phrase in `lib/copy.ts` carries `en`
and `es`. A save with an empty Spanish is refused by `lib/repo/copy.ts` —
refused, not warned about. The app sat at 0% Spanish for months because
nothing ever made the second column compulsory.

**A quote records what you charged.** Not what the menu says today.
Totals and per-dish prices are denormalised into `quotes` and
`quote_dishes` on purpose.

**Guarantees are structural, not remembered.** Prefer a test that bans a
syntax, refuses a stale generated file, or reads the output bytes, over a
convention somebody has to recall. Every serious bug in this repository's
history was found by measuring, not by reading.

## Commands

```
npm run validate           # typecheck + lint + 600 tests — run before every commit
npm run verify:standalone  # build the single file and drive it in a browser
npm run standalone:client  # build the client-safe file and read it for leaks
npm run import-matrix      # spreadsheet → data/ (then derive-allergens)
npm run db:generate        # a migration, to be read before it is run
npm run market-run         # tomorrow's shopping, grouped by stall
```

Tests use PGlite — Postgres compiled to WebAssembly — so `lib/repo`
runs against real SQL with no server. The schema is built by replaying
`db/migrations/*.sql`, which means a migration that no longer applies
breaks the test run.

## Conventions

- TypeScript strict. No `any` that could have been a type.
- Comments explain *why*, especially where the obvious approach is wrong.
  Several here record a bug that was actually shipped; leave them.
- Money in soles, `S/`, two decimals. `tnum` for anything in a column.
- Tailwind via CSS-variable tokens. Both themes, always.
- Node 22 (`.nvmrc`).

## Deploying

Netlify + Neon, both free tier. `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`.
Then `npm run user:create` — there is no sign-up, because every account
can see something a stranger should not.
