/**
 * Every environment variable the app reads is in .env.example.
 *
 * A variable added in code and not in the template is a deployment that works
 * on the machine it was written on and silently misbehaves everywhere else.
 * NEXT_PUBLIC_WHATSAPP was exactly that for an afternoon: absent, so every
 * public page's contact button pointed at a placeholder number.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const EXAMPLE = readFileSync(join(ROOT, ".env.example"), "utf8");

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const rel = join(dir, entry);
    if (statSync(join(ROOT, rel)).isDirectory()) sources(rel, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(rel);
  }
  return out;
}

/** Read in code but never configured by a person. */
const RUNTIME_ONLY = new Set(["NODE_ENV", "NODE_OPTIONS", "PORT", "CI"]);

/** Set by the person running a verifier, not by the deployment. */
const TOOLING = new Set(["VERIFY_EMAIL", "VERIFY_PASSWORD", "APP_URL"]);

describe(".env.example", () => {
  const used = new Set<string>();
  for (const dir of ["app", "lib", "db", "scripts", "components"]) {
    for (const rel of sources(dir)) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(m[1]);
    }
  }

  it("finds the variables at all", () => {
    expect(used.size).toBeGreaterThan(2);
    expect(used.has("DATABASE_URL")).toBe(true);
  });

  it("documents every variable the app actually reads", () => {
    const missing = [...used]
      .filter((v) => !RUNTIME_ONLY.has(v) && !TOOLING.has(v))
      .filter((v) => !EXAMPLE.includes(v))
      .sort();
    expect(missing).toEqual([]);
  });

  it("carries no real value — it is a template", () => {
    // A connection string with a host in it is somebody's database.
    expect(EXAMPLE).not.toMatch(/neon\.tech\/[a-z0-9]+\?.*password/i);
    expect(EXAMPLE).toMatch(/AUTH_SECRET=""/);
  });
});
