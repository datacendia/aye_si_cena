import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { COPY, staticCopy } from "@/lib/copy";

/**
 * Both languages, always.
 *
 * The standalone reached 100% Spanish and this app sat at 0% for months, and
 * the reason is simply that nothing ever forced the second column to be filled
 * in. A translation that is somebody's good intention is a translation that
 * rots. So: every phrase carries both languages, the admin screen refuses a save
 * with an empty Spanish, and this fails the build if either slips.
 */
describe("every phrase exists in both languages", () => {
  const keys = Object.keys(COPY);

  it("has a decent number of them, so this cannot pass by checking nothing", () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  it("carries a non-empty English and Spanish for every key", () => {
    const broken = keys.filter((k) => !COPY[k].en?.trim() || !COPY[k].es?.trim());
    expect(broken).toEqual([]);
  });

  it("gives every phrase a section, so the admin screen can group it", () => {
    expect(keys.filter((k) => !COPY[k].section?.trim())).toEqual([]);
  });

  /**
   * A Spanish string identical to its English is usually a forgotten
   * translation rather than a word that happens to be the same. The genuine
   * cases are few enough to name.
   */
  it("does not quietly leave English in the Spanish column", () => {
    // Words that really are the same in both. "Plancha" is Spanish that English
    // kitchens borrowed whole; translating it would be inventing a word.
    const same = ["prices.soles", "bookings.provisional", "admin.spanish", "take.planchas",
      "nav.home", "cat.bowl",
      // Words that are the same in both languages.
      "allg.gluten", "allg.soya", "allg.alcohol", "kitchen.minutes"];
    const suspect = keys.filter((k) => COPY[k].en === COPY[k].es && !same.includes(k));
    expect(suspect).toEqual([]);
  });

  it("keys on ids, never on the English text", () => {
    // Keying on English is what the standalone does; it works there because the
    // whole page is rebuilt at once. Here, editing a heading would orphan its
    // translation without a word.
    for (const k of keys) expect(k).toMatch(/^[a-z]+\.[A-Za-z]+$/);
  });
});

describe("no page asks for a phrase that does not exist", () => {
  const APP = join(__dirname, "..", "app");
  const COMPONENTS = join(__dirname, "..", "components");

  function sources(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) sources(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  const used = new Set<string>();
  for (const f of [...sources(APP), ...sources(COMPONENTS)]) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bt\(\s*"([a-z]+\.[A-Za-z]+)"\s*\)/g)) used.add(m[1]);
  }

  it("resolves every key the pages actually use", () => {
    const missing = [...used].filter((k) => !COPY[k]);
    expect(missing).toEqual([]);
  });

  it("returns a visible marker rather than a blank for an unknown key", () => {
    // A missing phrase must look wrong on the page, not merely be absent.
    expect(staticCopy("es")("nope.notAKey")).toBe("⟨nope.notAKey⟩");
  });
});

/**
 * The two label sets that were English only.
 *
 * CATEGORY_LABEL and DIET_LABEL had lived in lib/dishes.ts and lib/dietary.ts
 * since the beginning, in English, and every page rendered them straight. It
 * was invisible for as long as the pages around them were English too — and
 * then a Spanish shop window put "Canapés & bites" and "Coeliac / gluten-free"
 * under a Spanish heading, for customers in Lima.
 *
 * The English records stay where they are as the code default and the
 * standalone's source. These tests make sure the copy book covers every one of
 * them, and that no page renders the record directly any more.
 */
describe("category and diet labels carry both languages", () => {
  const { CATEGORY_LABEL, CATEGORY_ORDER } = require("@/lib/dishes");
  const { DIET_LABEL, DIETS } = require("@/lib/dietary");
  const camel = (id: string) =>
    id.split("-").map((w: string, i: number) =>
      i === 0 ? w : w[0].toUpperCase() + w.slice(1)).join("");

  it("has a phrase for every category", () => {
    for (const c of CATEGORY_ORDER) expect(COPY[`cat.${camel(c)}`]).toBeDefined();
  });

  it("has a phrase for every diet", () => {
    for (const d of DIETS) expect(COPY[`diet.${camel(d)}`]).toBeDefined();
  });

  it("has a phrase for every declarable allergen", () => {
    const { ALLERGENS, ALLERGEN_LABEL } = require("@/data/allergens");
    expect(ALLERGENS.length).toBeGreaterThanOrEqual(14);
    for (const a of ALLERGENS) {
      expect(COPY[`allg.${camel(a)}`]).toBeDefined();
      expect(COPY[`allg.${camel(a)}`].en).toBe(ALLERGEN_LABEL[a]);
    }
  });

  it("keeps the English in step with the code default", () => {
    // The copy book's English and the record must say the same thing, or the
    // two disagree the moment somebody edits one of them.
    for (const c of CATEGORY_ORDER) expect(COPY[`cat.${camel(c)}`].en).toBe(CATEGORY_LABEL[c]);
    for (const d of DIETS) expect(COPY[`diet.${camel(d)}`].en).toBe(DIET_LABEL[d]);
  });

  it("has no phrase for a category or diet that no longer exists", () => {
    const live = new Set([
      ...CATEGORY_ORDER.map((c: string) => `cat.${camel(c)}`),
      ...DIETS.map((d: string) => `diet.${camel(d)}`)
    ]);
    const orphans = Object.keys(COPY).filter((k) => /^(cat|diet)\./.test(k) && !live.has(k));
    expect(orphans).toEqual([]);
  });

  it("is rendered through the helper, never straight out of the record", () => {
    const { readdirSync, readFileSync, statSync } = require("node:fs");
    const { join } = require("node:path");
    const ROOT = join(__dirname, "..");

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(ROOT, dir))) {
        const rel = join(dir, e);
        if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
        else if (/\.tsx$/.test(e)) files.push(rel);
      }
    };
    walk("app");
    walk("components");

    const raw: string[] = [];
    for (const rel of files) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      // Indexing the record is how the English got onto a Spanish page. Passing
      // it to the helper as the fallback is the one legitimate use.
      for (const m of src.matchAll(/(CATEGORY_LABEL|DIET_LABEL)\[[^\]]+\]/g)) {
        const before = src.slice(Math.max(0, m.index! - 60), m.index!);
        if (!/(categoryLabel|dietLabel)\([^)]*$/.test(before)) {
          raw.push(`${rel} → ${m[0]}`);
        }
      }
    }
    expect(raw).toEqual([]);
  });
});
