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
    const same = ["prices.soles", "bookings.provisional", "admin.spanish", "take.planchas"];
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
