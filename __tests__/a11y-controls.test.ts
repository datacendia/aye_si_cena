/**
 * Every control the app renders has a name, and the name is the visible words.
 *
 * The standalone file has been checked for this since the first audit, but the
 * check read the rendered HTML — and the React app renders nothing until a
 * browser runs it, so it was never covered. Three controls had drifted: the
 * recipe search was named "Search recipes" while its placeholder said "Search
 * dish or ingredient", and the two guest boxes were each a lone <input> inside
 * a <fieldset>, which is a group element with one member.
 *
 * Reading the source rather than a rendered page is deliberate. It costs no
 * browser, runs in milliseconds, and it catches the control that is added next
 * week to a page nobody wrote a Playwright script for. The cost of that choice
 * is that this file reasons about JSX with regular expressions, so it is
 * written to be conservative: anything it cannot read confidently, it treats as
 * named rather than failing the build on a shape it did not anticipate.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...sources(rel));
    else if (/\.tsx$/.test(entry)) out.push(rel);
  }
  return out;
}

interface Control { tag: string; attrs: string; index: number; line: number }

const FILES = [...sources("app"), ...sources("components")].map((rel) => {
  const src = readFileSync(join(ROOT, rel), "utf8");
  return { rel, src, labelledIds: labelTargets(src), controls: controls(src) };
});

/** Ids that some <label htmlFor> in the same file points at. */
function labelTargets(src: string): Set<string> {
  return new Set([...src.matchAll(/htmlFor=["{]+([\w-]+)/g)].map((m) => m[1]));
}

/**
 * Read the opening tag, honouring braces and quotes.
 *
 * `[^>]*` is the obvious way to do this and it is wrong here: half the props in
 * this app are arrow functions, so `onChange={(e) => setQ(…)}` ends the match
 * at the arrow and everything after it — including the aria-label or the
 * placeholder — is never seen. The first version of this file did exactly that
 * and quietly checked half of each tag.
 */
function controls(src: string): Control[] {
  const out: Control[] = [];
  const re = /<(input|select|textarea)(?=[\s/>])/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote: string | null = null;

    for (; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
      if (ch === "{") { depth++; continue; }
      if (ch === "}") { depth--; continue; }
      if (ch === ">" && depth === 0) break;
    }

    out.push({
      tag: m[1],
      attrs: src.slice(m.index + m[0].length, i),
      index: m.index,
      line: src.slice(0, m.index).split("\n").length
    });
  }
  return out;
}

/**
 * Whether the control sits inside a <label> that has not closed yet.
 *
 * This repo's forms are written as `<label><span>Soles</span><input …/></label>`,
 * which names the input by containment and needs no id at all.
 */
function insideLabel(src: string, at: number): boolean {
  const before = src.slice(0, at);
  return before.lastIndexOf("<label") > before.lastIndexOf("</label>");
}

function named(file: (typeof FILES)[number], c: Control): boolean {
  if (/\baria-label[=\s]/.test(c.attrs)) return true;
  if (/\baria-labelledby[=\s]/.test(c.attrs)) return true;
  if (/\btype="hidden"/.test(c.attrs)) return true;
  const id = /\bid="([\w-]+)"/.exec(c.attrs)?.[1];
  if (id !== undefined && file.labelledIds.has(id)) return true;
  return insideLabel(file.src, c.index);
}

describe("every control has an accessible name", () => {
  it("finds controls to check, so this cannot pass by checking nothing", () => {
    expect(FILES.reduce((n, f) => n + f.controls.length, 0)).toBeGreaterThan(20);
  });

  it("names every input, select and textarea", () => {
    const unnamed = FILES.flatMap((f) =>
      f.controls.filter((c) => !named(f, c)).map((c) => `${f.rel}:${c.line} <${c.tag}>`)
    );
    expect(unnamed).toEqual([]);
  });

  it("never leaves a placeholder doing a label's job alone", () => {
    // A placeholder disappears the moment somebody types. It is a hint, and it
    // has never been a name.
    const only = FILES.flatMap((f) =>
      f.controls
        .filter((c) => /\bplaceholder=/.test(c.attrs) && !named(f, c))
        .map((c) => `${f.rel}:${c.line}`)
    );
    expect(only).toEqual([]);
  });

  it("uses a fieldset only for a group, never for a single control", () => {
    const lonely: string[] = [];

    for (const f of FILES) {
      const re = /<fieldset[\s\S]*?<\/fieldset>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.src))) {
        // A .map() renders as many controls as there are items, whatever the
        // source shows, so those fieldsets are groups by construction.
        if (/\.map\(/.test(m[0])) continue;
        if (controls(m[0]).length === 1) {
          lonely.push(`${f.rel}:${f.src.slice(0, m.index).split("\n").length}`);
        }
      }
    }

    // A fieldset announces "group of N" to a screen reader. With one control in
    // it the announcement is noise, and the legend is not the control's name.
    expect(lonely).toEqual([]);
  });

  it("gives every fieldset a legend", () => {
    const bare: string[] = [];
    for (const f of FILES) {
      const re = /<fieldset[\s\S]*?<\/fieldset>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.src))) {
        if (!/<legend/.test(m[0])) {
          bare.push(`${f.rel}:${f.src.slice(0, m.index).split("\n").length}`);
        }
      }
    }
    expect(bare).toEqual([]);
  });

  it("gives every htmlFor an input that actually carries that id", () => {
    const dangling: string[] = [];
    for (const f of FILES) {
      const ids = new Set(
        f.controls.map((c) => /\bid="([\w-]+)"/.exec(c.attrs)?.[1]).filter(Boolean)
      );
      for (const target of f.labelledIds) {
        if (!ids.has(target)) dangling.push(`${f.rel} → #${target}`);
      }
    }
    // A label pointing at nothing looks correct in the source and names nothing
    // in the browser, which is the worst of both.
    expect(dangling).toEqual([]);
  });
});
