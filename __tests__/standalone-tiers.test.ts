/**
 * The standalone's copy of the tier rules is really a copy.
 *
 * scripts/build-standalone.mjs reimplements the quote maths in vanilla
 * JavaScript, on purpose: the single file has to work with no server, no build
 * step and no network, on a phone in a market. That duplication is the price of
 * it, and scripts/verify-standalone.mjs already drives the rendered file and
 * checks its figures against lib/pricing.ts.
 *
 * What that verifier could not catch is a tier that exists on one side and not
 * the other, because it only checks the quotes it is given. The app grew from
 * three tiers to five and the standalone's table said "mirrored from
 * lib/pricing.ts" while mirroring three of them — a comment that had quietly
 * become false.
 *
 * This reads both tables as text and requires them to agree, field by field.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TIERS } from "@/lib/pricing";
import { VAN_TRIPS, LOAD_CREW } from "@/lib/venues";

const SRC = readFileSync(
  join(__dirname, "..", "scripts", "build-standalone.mjs"), "utf8"
);

/** The object literal assigned to `name`, as a plain record. */
function literal(name: string): Record<string, Record<string, string | number>> {
  const start = SRC.indexOf(`const ${name} = {`);
  expect(start).toBeGreaterThan(-1);

  let depth = 0;
  let i = SRC.indexOf("{", start);
  const from = i;
  for (; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) break;
  }
  const body = SRC.slice(from, i + 1);

  const out: Record<string, Record<string, string | number>> = {};
  for (const m of body.matchAll(/(\w+):\s*\{([^}]*)\}/g)) {
    const fields: Record<string, string | number> = {};
    for (const f of m[2].matchAll(/(\w+):\s*("([^"]*)"|[\d.]+)/g)) {
      fields[f[1]] = f[3] !== undefined ? f[3] : Number(f[2]);
    }
    out[m[1]] = fields;
  }
  return out;
}

describe("the standalone mirrors lib/pricing.ts", () => {
  const mirrored = literal("TIERS");

  it("finds a table to check, so this cannot pass by reading nothing", () => {
    expect(Object.keys(mirrored).length).toBeGreaterThanOrEqual(3);
  });

  it("carries exactly the same tiers", () => {
    expect(Object.keys(mirrored).sort()).toEqual(Object.keys(TIERS).sort());
  });

  it.each(Object.keys(TIERS))("%s has identical rules on both sides", (id) => {
    const real = TIERS[id as keyof typeof TIERS] as unknown as Record<string, string | number>;
    for (const field of Object.keys(real)) {
      expect({ [field]: mirrored[id][field] }).toEqual({ [field]: real[field] });
    }
  });
});

describe("the standalone mirrors the transport tables too", () => {
  /** `vanTrips: { … }` sits inside a larger payload literal. */
  function inlineTable(name: string): Record<string, number> {
    const m = new RegExp(`${name}:\\s*\\{([^}]*)\\}`).exec(SRC);
    expect(m).not.toBeNull();
    const out: Record<string, number> = {};
    for (const f of m![1].matchAll(/(\w+)\s*:\s*(\d+)/g)) out[f[1]] = Number(f[2]);
    return out;
  }

  it("has a van-trip figure for every tier, matching lib/venues.ts", () => {
    expect(inlineTable("vanTrips")).toEqual({ ...VAN_TRIPS });
  });

  it("has a load-crew figure for every tier, matching lib/venues.ts", () => {
    expect(inlineTable("loadCrew")).toEqual({ ...LOAD_CREW });
  });
});

describe("the standalone derives the two new tiers by the same rule", () => {
  it("implements fitsTier rather than reading a tiers column for all five", () => {
    expect(SRC).toMatch(/function fitsTier\(d, tier\)/);
    expect(SRC).toMatch(/if \(tier === "ceilidh"\)/);
    expect(SRC).toMatch(/if \(tier === "ninos"\)/);
  });

  it("keeps the children's tier absolute about alcohol", () => {
    const fn = SRC.slice(SRC.indexOf("function fitsTier"), SRC.indexOf("function dishesAtTier"));
    expect(fn).toMatch(/d\.needsLicence/);
    expect(fn).toMatch(/kid-friendly/);
    // An unclassified ingredient claims nothing, here as in lib/tiers.ts.
    expect(fn).toMatch(/unknown\.length/);
  });

  it("asks through dishesAtTier everywhere, never the raw column", () => {
    // Three sites used `d.tiers.indexOf(tier)` directly, and that is what made
    // the two derived tiers report zero dishes available. Two uses are
    // legitimate and are excluded by position rather than by pattern: the
    // fallback inside fitsTier itself, and matchesEvent, which only ever sees
    // the three tiers the event filters name (asserted in tiers.test.ts).
    const fitsTier = SRC.slice(
      SRC.indexOf("function fitsTier"), SRC.indexOf("function dishesAtTier")
    );
    const matchesEvent = SRC.slice(
      SRC.indexOf("function matchesEvent"),
      SRC.indexOf("}", SRC.indexOf("function matchesEvent"))
    );

    const stray = [...SRC.matchAll(/d\.tiers\.indexOf\([^)]*\)/g)]
      .map((m) => m[0])
      .filter((hit) => !fitsTier.includes(hit) && !matchesEvent.includes(hit));
    expect(stray).toEqual([]);
  });
});
