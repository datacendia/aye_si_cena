/**
 * The database.
 *
 * Everything the standalone file cannot do: remember a quote, know who is
 * asking, and carry a price that changed this morning at the market.
 *
 * What is NOT here is as important as what is. The 223 dishes, their recipes,
 * their allergens and the costing rules stay in data/ and lib/ - version
 * controlled, code reviewed, and covered by 431 tests. The database holds only
 * what a person did: who they are, what they quoted, what they booked, and
 * which prices they have since verified with their own eyes at a stall.
 *
 * A dish is therefore never copied into a row. A quote stores dish IDs and the
 * price each dish carried at the moment of quoting - so a quote you sent in
 * March still says what you actually charged, even after the menu is repriced.
 */
import {
  pgTable, text, timestamp, integer, boolean, primaryKey, real, jsonb, index, uniqueIndex
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

/* ─────────────────────────── who is asking ─────────────────────────── */

/**
 * Three roles, and the gap between them is money.
 *
 *   owner  - everything: cost, margin, food-cost %, supplier
 *   chef   - recipes, quantities, allergens, the run sheet. No cost, ever.
 *   client - their own quote and menu. No cost, no other client.
 *
 * Enforced in lib/permissions.ts on the server, before anything is serialised.
 * A role is not a CSS class; if a figure reaches the browser it has leaked.
 */
export const ROLES = ["owner", "chef", "client"] as const;
export type Role = (typeof ROLES)[number];

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  /** Argon/bcrypt hash. Null for a user who has never set one (invited, not yet joined). */
  passwordHash: text("password_hash"),
  role: text("role", { enum: ROLES }).notNull().default("client"),
  /** Set for role = "client": which client record this login speaks for. */
  clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  /**
   * Which language this person reads. Defaults to Spanish because the kitchen
   * does, and the pages a chef uses were the ones in English.
   */
  locale: text("locale", { enum: ["es", "en"] }).notNull().default("es"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow()
});

/* Auth.js tables. Shapes are fixed by @auth/drizzle-adapter - do not rename. */

export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state")
}, (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }));

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull()
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull()
}, (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }));

/* ───────────────────────────── the words ───────────────────────────── */

/**
 * Every heading and paragraph on the site, in both languages.
 *
 * The English in the code is the fallback and the seed; a row here supersedes
 * it. That makes the copy editable without a deploy - and, more importantly, it
 * makes the Spanish a column rather than an afterthought.
 *
 * Both languages are NOT NULL. A save with an empty Spanish is refused, which
 * is the only way a translation stays current: the app went months at 100%
 * Spanish on the standalone and 0% here precisely because nothing ever forced
 * the second column to be filled in.
 */
export const siteCopy = pgTable("site_copy", {
  /** Stable id, e.g. "menu.heading". Never the English text - that changes. */
  key: text("key").primaryKey(),
  en: text("en").notNull(),
  es: text("es").notNull(),
  /** Where it appears, so the admin screen can group it usefully. */
  section: text("section").notNull().default("general"),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow()
});

/**
 * Editorial changes to a dish.
 *
 * Name, description, menu price, category, tiers, licence - business decisions,
 * so they belong to whoever runs the business rather than to a deploy.
 *
 * What is NOT here, and never will be: allergens and the vegetarian flag. Those
 * are derived from the recipe by lib/dietary.ts. A hand-editable allergen field
 * is exactly what this repository already shipped once - it disagreed with its
 * own recipe on 165 of 223 dishes and offered 50 gluten-bearing dishes as
 * gluten-free. Change the recipe and the allergens follow; there is no screen
 * that lets anybody type over them.
 */
export const dishEdits = pgTable("dish_edits", {
  dishId: integer("dish_id").primaryKey(),
  name: text("name"),
  nameEs: text("name_es"),
  fusion: text("fusion"),
  fusionEs: text("fusion_es"),
  price: real("price"),
  category: text("category"),
  needsLicence: boolean("needs_licence"),
  tiers: jsonb("tiers").$type<string[]>(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow()
});

/* ───────────────────────────── the people ───────────────────────────── */

export const clients = pgTable("clients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  contact: text("contact"),
  phone: text("phone"),
  /** A Lima district id, matching data/venues.ts - drives the transport cost. */
  district: text("district"),
  /**
   * Allergies and diets this client has told you about, as diet ids from
   * lib/dietary.ts. Kept against the client, not the quote, because it is a
   * fact about the people eating and it must survive into the next event.
   */
  diets: jsonb("diets").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow()
}, (t) => ({ byName: index("clients_name_idx").on(t.name) }));

/* ───────────────────────────── the quotes ───────────────────────────── */

export const QUOTE_STATUS = ["draft", "sent", "won", "lost"] as const;
export type QuoteStatus = (typeof QUOTE_STATUS)[number];

export const quotes = pgTable("quotes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  /** Human reference, e.g. "Ferguson wedding, 120". */
  name: text("name").notNull(),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  status: text("status", { enum: QUOTE_STATUS }).notNull().default("draft"),

  guests: integer("guests").notNull(),
  /** "scran" | "buffet" | "plated" — a ServiceTier from lib/pricing.ts. */
  tier: text("tier").notNull(),
  district: text("district"),
  venue: text("venue"),
  /** 1-12. The month decides which vedas apply, so it is part of the quote. */
  month: integer("month"),
  peak: boolean("peak").notNull().default(false),
  eventDate: timestamp("event_date", { mode: "date" }),

  /**
   * The totals as quoted, in soles, ex-IGV where the name says net.
   *
   * Denormalised on purpose. Re-deriving them later would silently reprice a
   * quote you already sent when the menu moves under it, and "the app says
   * something different now" is not a conversation to have with a client.
   */
  netTotal: real("net_total").notNull(),
  grossTotal: real("gross_total").notNull(),
  foodCostTotal: real("food_cost_total").notNull(),

  notes: text("notes"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow()
}, (t) => ({
  byClient: index("quotes_client_idx").on(t.clientId),
  byStatus: index("quotes_status_idx").on(t.status)
}));

/**
 * The dishes on a quote, with the figures they carried at the time.
 *
 * dishId points at data/dishes.ts and is never a copy of the dish. The two
 * prices are copies, deliberately: they are what you charged, not what the
 * menu says today.
 */
export const quoteDishes = pgTable("quote_dishes", {
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  dishId: integer("dish_id").notNull(),
  priceAtQuote: real("price_at_quote").notNull(),
  costAtQuote: real("cost_at_quote").notNull()
}, (t) => ({ pk: primaryKey({ columns: [t.quoteId, t.dishId] }) }));

/* ──────────────────────────── the calendar ──────────────────────────── */

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  quoteId: text("quote_id").references(() => quotes.id, { onDelete: "set null" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  /** Minutes from midnight, matching lib/capacity.ts. */
  serviceMinutes: integer("service_minutes").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(180),
  eventDate: timestamp("event_date", { mode: "date" }).notNull(),
  guests: integer("guests").notNull(),
  tier: text("tier").notNull(),
  district: text("district"),
  venue: text("venue"),
  /** Dish ids, so lib/capacity.ts can answer from real bookings. */
  dishIds: jsonb("dish_ids").$type<number[]>().notNull().default([]),
  confirmed: boolean("confirmed").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow()
}, (t) => ({ byDate: index("bookings_date_idx").on(t.eventDate) }));

/* ──────────────────────────── the market ────────────────────────────── */

/**
 * A price someone actually verified, standing over the stall.
 *
 * data/prices.ts stays the seed and the fallback; every row in it is an
 * estimate and the whole matrix still says costVerified: false. A row here
 * overrides one key at runtime, so a market run on Tuesday reaches every
 * device on Tuesday instead of waiting for a rebuild and a redistributed file.
 *
 * Never edited in place - a new row supersedes the last, so what you paid in
 * March is still answerable in September.
 */
export const priceOverrides = pgTable("price_overrides", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  /** The canonical key from lib/ingredient-key.ts. Must canonicalise to itself. */
  ingredientKey: text("ingredient_key").notNull(),
  soles: real("soles").notNull(),
  /** "kg" | "L" | "each" | "bunch" … matching data/prices.ts. */
  per: text("per").notNull(),
  unitGrams: real("unit_grams"),
  /** Where it was bought. "Surquillo N.1", "Terminal Pesquero VMT". */
  source: text("source"),
  note: text("note"),
  verifiedBy: text("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { mode: "date" }).notNull().defaultNow(),
  /** Cleared when a newer row for the same key arrives. */
  current: boolean("current").notNull().default(true)
}, (t) => ({
  byKey: index("price_overrides_key_idx").on(t.ingredientKey),
  oneCurrentPerKey: uniqueIndex("price_overrides_current_idx")
    .on(t.ingredientKey).where(sql`current`)
}));

/* ─────────────────────────── the front door ─────────────────────────── */

/**
 * Every attempt to sign in, so that guessing can be made expensive.
 *
 * Without this the login accepted unlimited attempts at an unlimited rate, and
 * a bcrypt hash at cost 12 is only about 250ms of protection: a fortnight of
 * quiet requests is tens of millions of guesses against an account that can see
 * the whole cost base. There are three logins and no sign-up page, so nobody
 * will ever notice a limit that is generous by ordinary standards.
 *
 * It is a table rather than a counter in memory because the app runs in Netlify
 * functions: each request may be a fresh process, so an in-memory counter would
 * reset itself and protect nothing. Shared state has to be somewhere shared.
 *
 * Rows carry the email attempted, not whether it exists. Recording the failure
 * against an unknown address is the point — that is what a list being tried
 * looks like.
 */
export const loginAttempts = pgTable("login_attempts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  /** Lower-cased, as typed. An address that does not exist is still recorded. */
  email: text("email").notNull(),
  /** From x-forwarded-for, or "unknown" when there is no proxy in front. */
  ip: text("ip").notNull().default("unknown"),
  ok: boolean("ok").notNull(),
  at: timestamp("at", { mode: "date" }).notNull().defaultNow()
}, (t) => ({
  byEmail: index("login_attempts_email_idx").on(t.email, t.at),
  byIp: index("login_attempts_ip_idx").on(t.ip, t.at)
}));

/**
 * A password reset, issued by the owner and carried by hand.
 *
 * There is no email service here and there is not going to be one: this app
 * costs S/0 a month to run and an SMTP account is the first thing that would
 * change that. So a reset is a link the owner generates and sends over
 * WhatsApp, which is how this business already talks to everybody.
 *
 * Only the SHA-256 of the token is stored. A leaked backup then contains
 * nothing usable, which is the whole reason not to store the token itself.
 */
export const passwordResets = pgTable("password_resets", {
  /** sha256(token), hex. The token itself is shown once and never stored. */
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  issuedBy: text("issued_by").references(() => users.id, { onDelete: "set null" }),
  issuedAt: timestamp("issued_at", { mode: "date" }).notNull().defaultNow()
}, (t) => ({ byUser: index("password_resets_user_idx").on(t.userId) }));
