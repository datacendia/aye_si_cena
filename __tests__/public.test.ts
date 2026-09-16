/**
 * What a stranger may see, and everything they may not.
 *
 * The rest of the app strips owner-only fields by naming them:
 * `const { cost, source, costVerified, ...rest } = dish`. That is a blacklist,
 * and a blacklist is correct exactly until somebody adds a field to `Dish`.
 * Add `supplierNote` next spring and it flows through to every audience,
 * because nothing named it.
 *
 * For a signed-in chef that is a small risk. For pages anybody on the internet
 * can open it is not one worth taking, so lib/public.ts builds by picking
 * fields rather than dropping them — and the first test below is the one that
 * makes that mean something: it compares the whitelist against the real `Dish`
 * and fails when a new field appears, so somebody has to decide.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import {
  publicDish, publicDishes, PUBLIC_DISH_FIELDS, NEVER_PUBLIC
} from "@/lib/public";
import { DISHES } from "@/data/dishes";
import { PRICES } from "@/data/prices";

const ROOT = join(__dirname, "..");

describe("the whitelist", () => {
  it("is what publicDish actually returns, and nothing more", () => {
    for (const dish of DISHES) {
      expect(Object.keys(publicDish(dish)).sort())
        .toEqual([...PUBLIC_DISH_FIELDS].sort());
    }
  });

  it("carries none of the fields that reveal what you pay or make", () => {
    for (const field of NEVER_PUBLIC) {
      expect(PUBLIC_DISH_FIELDS as readonly string[]).not.toContain(field);
    }
  });

  it("fails when a field is added to Dish, so somebody has to decide", () => {
    // Deliberately brittle. A new field appearing on a dish is exactly the
    // moment to ask whether the internet should see it, and the answer is only
    // meaningful if somebody is made to give it.
    const everyField = Object.keys(DISHES[0]).sort();
    const decided = [...PUBLIC_DISH_FIELDS, ...NEVER_PUBLIC].sort();
    expect(everyField).toEqual(decided);
  });
});

describe("no public dish carries money, a supplier, or a margin", () => {
  const all = publicDishes(DISHES);

  it("covers the whole matrix, not a sample", () => {
    expect(all).toHaveLength(DISHES.length);
    expect(all.length).toBeGreaterThan(200);
  });

  it("has no cost, price, source or costVerified on any of them", () => {
    for (const d of all) {
      for (const field of NEVER_PUBLIC) {
        expect(d).not.toHaveProperty(field);
      }
    }
  });

  /**
   * The serialised check, which is the one that caught a real leak before.
   *
   * The client standalone build stripped supplier names from the recipes and
   * shipped them anyway, through the Spanish dictionary. Reading the object
   * graph found nothing; reading the bytes found it immediately.
   */
  it("names no supplier anywhere in the serialised payload", () => {
    const json = JSON.stringify(all);
    const suppliers = [...new Set(DISHES.map((d) => d.source).filter(Boolean))];
    expect(suppliers.length).toBeGreaterThan(5);

    const leaked = suppliers.filter((s) => json.includes(s));
    expect(leaked).toEqual([]);
  });

  it("carries no cost figure that could be read back out", () => {
    const json = JSON.stringify(all);
    // Every distinct cost, to two decimals, as it would be written.
    const costs = [...new Set(DISHES.map((d) => d.cost.toFixed(2)))];
    expect(costs.length).toBeGreaterThan(50);
    expect(costs.filter((c) => json.includes(c))).toEqual([]);
  });

  it("still carries what a customer is on the page to read", () => {
    for (const d of all) {
      expect(typeof d.name).toBe("string");
      expect(d.name.length).toBeGreaterThan(0);
      expect(Array.isArray(d.allergens)).toBe(true);
      expect(typeof d.fusion).toBe("string");
    }
    expect(Object.keys(PRICES).length).toBeGreaterThan(0);
  });
});

/* ────────────────────── the pages, read as source ────────────────────── */

function pagesUnder(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) pagesUnder(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const PUBLIC_DIR = join(ROOT, "app", "(public)");
const publicFiles = pagesUnder(PUBLIC_DIR).map((f) => ({
  rel: f.slice(ROOT.length + 1),
  src: readFileSync(f, "utf8")
}));

describe("the shop window reaches nothing it should not", () => {
  it("has pages to check", () => {
    expect(publicFiles.length).toBeGreaterThanOrEqual(5);
  });

  it("includes the page a QR code on a box lands on", () => {
    // The one page whose reader is holding food. A guest has no account and
    // never will, so requiring one would make the label decorative.
    expect(publicFiles.some((f) => f.rel.includes("carta") && f.rel.includes("[id]")))
      .toBe(true);
  });

  it("imports no dish data, no costing, and no repository but the three named", () => {
    /*
     * The rule is about the MENU, not about the word "repo".
     *
     * A public page must never reach the dish matrix, the price book or the
     * costing engine — lib/public.ts builds by whitelist and is the only way
     * in. Three repositories are allowed through, and each earns it:
     *
     *   repo/menu   lib/public.ts itself reads it, to pick up admin edits.
     *   repo/pack   the token-authorised read of one booking. It IS the
     *               feature; /evento/<token> has nothing else to do.
     *   repo/declarations
     *               a WRITE, not a read: the scan records what it served. It
     *               reads no dish data at all.
     */
    const allowedRepos = /from "@\/lib\/repo\/(menu|pack|declarations)"/;

    const banned: [RegExp, string][] = [
      [/from "@\/data\/dishes"/, "the raw dish matrix"],
      [/from "@\/data\/prices"/, "the price book"],
      [/from "@\/lib\/costing"/, "the costing engine"],
      [/\brequireViewer\b|\brequireCan\b/, "a guard these pages must not have"]
    ];

    const found: string[] = [];
    for (const f of publicFiles) {
      for (const [pattern, why] of banned) {
        if (pattern.test(f.src)) found.push(`${f.rel} imports ${why}`);
      }
      for (const m of f.src.matchAll(/from "@\/lib\/repo\/[\w-]+"/g)) {
        if (!allowedRepos.test(m[0])) found.push(`${f.rel} imports ${m[0]}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("never names a money field in its own source", () => {
    const found: string[] = [];
    for (const f of publicFiles) {
      // `fromPerGuest` is the one advertised figure and is allowed by name.
      const src = f.src.replace(/fromPerGuest/g, "").replace(/publicPackages/g, "");
      for (const field of ["\\.cost\\b", "\\.price\\b", "costVerified", "\\.source\\b",
                           "foodCostRatio", "STAFF_SHIFT_COST", "CHEF_SHIFT_COST"]) {
        if (new RegExp(field).test(src)) found.push(`${f.rel} → ${field}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("sends signed-in staff to their own version of each page", () => {
    /*
     * Not for secrecy — for usefulness. A chef landing on the customer menu has
     * lost the recipes; the redirect puts them where their tools are.
     *
     * Two exceptions, and both are pages where being redirected would be the
     * bug rather than the fix:
     *
     * /carta/[id] is where a QR code on a box lands. A chef scanning one at 6am
     * to check whether it contains celery should see exactly what the guest
     * sees — the same words, off the same recipe. Bouncing them somewhere else
     * would defeat the label. The recipe is one tap away instead.
     *
     * /evento/[token] is the link sent to a client. When the owner opens it to
     * check what was sent, showing them something different would defeat the
     * only reason to look.
     */
    const noStaffVersion = [`carta${sep}[id]`, `evento${sep}[token]`];

    for (const f of publicFiles.filter((x) => x.rel.endsWith(`${sep}page.tsx`))) {
      if (noStaffVersion.some((x) => f.rel.includes(x))) {
        expect(f.src).not.toMatch(/redirect\(/);
        continue;
      }
      expect(f.src).toMatch(/if \(await viewer\(\)\) redirect\(/);
    }
  });

  it("reads the signed-in reader's own language, not the cookie", () => {
    /*
     * publicLocale() answers from a cookie, which is right for a stranger and
     * wrong for staff: a signed-in person has a locale on their user row, and
     * reading the cookie for them produced a page whose header said English and
     * whose body was Spanish. A chef whose account is English scanned a box and
     * got Spanish.
     *
     * readerLocale() prefers the account. Every public page must use it.
     */
    const wrong = publicFiles
      .filter((f) => /page\.tsx$/.test(f.rel))
      .filter((f) => /\bpublicLocale\(/.test(f.src))
      .map((f) => f.rel);
    expect(wrong).toEqual([]);

    const missing = publicFiles
      .filter((f) => /page\.tsx$/.test(f.rel))
      .filter((f) => !/\breaderLocale\(/.test(f.src))
      .map((f) => f.rel);
    expect(missing).toEqual([]);
  });

  it("is reachable with JavaScript off where it can be", () => {
    // The landing, packages and events pages are server-rendered lists with no
    // client component at all. A shop window that needs hydration to show a
    // menu is a shop window with a blind down for the first second.
    const serverOnly = publicFiles.filter((f) =>
      /page\.tsx$/.test(f.rel) && !f.rel.includes("carta"));
    for (const f of serverOnly) expect(f.src).not.toMatch(/"use client"/);
  });
});
