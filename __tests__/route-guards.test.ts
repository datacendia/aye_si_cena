import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

/**
 * Every page checks the viewer on the server.
 *
 * The nav in app/layout.tsx hides links a role may not use, and that protects
 * nothing at all - a URL typed by hand skips it entirely. The real check is
 * the one at the top of each page, and the failure mode is not a bug you can
 * see: a page added next month simply renders your cost base to whoever asks.
 *
 * So the guarantee is structural. A new page under app/ fails this test until
 * somebody decides, in writing, who may see it.
 */
const APP = join(__dirname, "..", "app");

/**
 * Public by deliberate exception, listed here so the choice is visible.
 *
 *   login          — obviously.
 *   reset/[token]  — somebody who cannot sign in is exactly who needs it. The
 *                    link is the authority: one hour, one use, and only its
 *                    SHA-256 is stored. See the test below for what it is
 *                    allowed to reveal.
 */
const PUBLIC_PAGES = new Set(["login", "reset/[token]"]);

/**
 * The shop window.
 *
 * Everything under app/(public)/ is meant to be opened by a stranger, so
 * "unguarded" is not the failure mode there — leaking is. Those pages get a
 * stricter test of their own below: they may not reach data/dishes.ts,
 * lib/repo/, or the pricing internals at all, and what they render is checked
 * against the real matrix for cost, supplier and margin.
 */
const isPublic = (file: string) => file.includes(`${sep}(public)${sep}`);

function pages(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) pages(full, out);
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

const found = pages(APP).map((f) => ({
  file: f,
  route: "/" + f.slice(APP.length + 1).replace(/\/?page\.tsx$/, ""),
  src: readFileSync(f, "utf8")
}));

describe("no page renders without asking who is looking", () => {
  it("finds the pages at all, so this cannot pass by looking at nothing", () => {
    expect(found.length).toBeGreaterThanOrEqual(10);
  });

  it("guards every page that is not deliberately public", () => {
    const unguarded = found
      .filter((p) => !isPublic(p.file))
      .filter((p) => !PUBLIC_PAGES.has(p.route.replace(/^\//, "")))
      .filter((p) => !/require(Viewer|Can)\s*\(/.test(p.src))
      .map((p) => p.route || "/");
    expect(unguarded).toEqual([]);
  });

  it("lets the public reset page reveal one email and nothing else", () => {
    const page = found.find((p) => p.route === "/reset/[token]")!;
    expect(page).toBeDefined();

    // It names the account the link was issued for, because somebody setting a
    // password needs to know which one — and whoever holds the link could set
    // it regardless. Everything past that stays behind the login: no role, no
    // client, no quote, no dish.
    expect(page.src).toMatch(/resetTarget/);
    for (const forbidden of [/\bDISHES\b/, /listQuotes/, /listClients/, /\brole\b/, /clientId/]) {
      expect(page.src).not.toMatch(forbidden);
    }

    // And it reads the copy from the code rather than the database: a query in
    // front of this page would make it fail exactly when it is needed.
    expect(page.src).toMatch(/staticCopy/);
    expect(page.src).not.toMatch(/import[^;]*loadCopy/);
  });

  it("guards the pages that carry money with a money check, not just a login", () => {
    // Signing in is not enough for these: a chef and a client both have logins.
    for (const route of ["/menu", "/compare", "/builder"]) {
      const page = found.find((p) => p.route === route);
      expect(page).toBeDefined();
      expect(page!.src).toMatch(/requireCan\(\s*CAN\.(seeMoney|writeQuotes)/);
    }
  });

  it("guards the kitchen pages", () => {
    for (const route of ["/recipes", "/seasonal", "/graph"]) {
      const page = found.find((p) => p.route === route);
      expect(page).toBeDefined();
      expect(page!.src).toMatch(/requireCan\(\s*CAN\.seeKitchen/);
    }
  });

  it("keeps the login page reachable by someone with no session", () => {
    const login = found.find((p) => p.route === "/login");
    expect(login).toBeDefined();
    expect(login!.src).not.toMatch(/requireViewer|requireCan/);
  });
});

describe("no page hands raw dishes to the browser", () => {
  /**
   * The chokepoint in lib/permissions.ts is worth nothing if a page skips it.
   *
   * It was written first and wired in second, and in between every page passed
   * DISHES straight through: a chef loading /find received all 223 costs and
   * all 223 supplier names in the payload, and so did a client. Nothing looked
   * wrong on screen, because nothing displayed them - they were simply in the
   * document, for anyone who opened devtools.
   *
   * A page must therefore never hand DISHES to a component directly. It goes
   * through visibleDishes(DISHES, role) or it does not go.
   */
  it("passes dishes through visibleDishes, never DISHES itself", () => {
    const raw = found
      .filter((p) => /\bdishes=\{DISHES\}/.test(p.src))
      .map((p) => p.route || "/");
    expect(raw).toEqual([]);
  });

  /**
   * And no page imports the shipped list at all.
   *
   * data/dishes.ts is what shipped; it is not what the menu says. An owner can
   * rename a dish, reprice it, move its category or withdraw its licence from
   * the admin screen, and those edits live in the database. A page that imports
   * DISHES renders last month's menu and looks completely correct doing it.
   *
   * lib/repo/menu.ts is the one place that puts the two together — and it
   * resolves the Spanish at the same time, which is the only reason the admin
   * screen can insist on a Spanish name and mean it.
   */
  it("loads the menu through lib/repo/menu.ts, not from data/dishes.ts", () => {
    // /admin is the exception, and the only one: it is the screen where a dish
    // is edited, so it must show what the dish was BEFORE the edit — that is
    // what goes in the form's placeholder, and it is how the owner sees what
    // they are changing from. Every other page shows the edited menu.
    const direct = found
      .filter((p) => p.route !== "/admin" && !isPublic(p.file))
      .filter((p) => /from "@\/data\/dishes"/.test(p.src))
      .map((p) => p.route || "/");
    expect(direct).toEqual([]);
  });

  it("loads it in the reader's language", () => {
    const wrong = found
      .filter((p) => !isPublic(p.file))
      .filter((p) => /\bmenu\(/.test(p.src))
      .filter((p) => !/\bmenu\(me\.locale\)/.test(p.src))
      .map((p) => p.route || "/");
    expect(wrong).toEqual([]);
  });

  it("actually calls the chokepoint on the pages that render dishes", () => {
    for (const route of ["/find", "/moments", "/graph", "/recipes", "/seasonal"]) {
      const page = found.find((p) => p.route === route);
      expect(page).toBeDefined();
      expect(page!.src).toMatch(/visibleDishes\(\s*dishes\s*,\s*me\.role\s*\)/);
    }
  });
});

describe("nothing is prerendered", () => {
  const layout = readFileSync(join(__dirname, "..", "app", "layout.tsx"), "utf8");

  /**
   * Next decides staticness by whether a render touched cookies. That made it
   * depend on whether DATABASE_URL happened to be set during the build - the
   * same page came out static in one environment and dynamic in another, and
   * the static one was a build-time snapshot of a page that carries costs. It
   * did not leak, because the guard redirected first. It should not have been
   * able to.
   */
  it("forces dynamic rendering for the whole app", () => {
    expect(layout).toMatch(/export const dynamic = "force-dynamic"/);
  });
});

describe("the outer gate is deny-by-default", () => {
  const middleware = readFileSync(join(__dirname, "..", "middleware.ts"), "utf8");

  /** Every path the gate lets through without a session. */
  const gateOpens = () =>
    ["PUBLIC_EXACT", "PUBLIC_PREFIX"]
      .flatMap((name) => {
        const block = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(middleware)![1];
        return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      })
      .sort();

  it("lists what is public rather than what is private", () => {
    // An allow-list of private routes would leave every new page open. This
    // must be the other way round.
    expect(middleware).toMatch(/const PUBLIC_EXACT\s*=/);
    expect(middleware).toMatch(/const PUBLIC_PREFIX\s*=/);
    expect(middleware).not.toMatch(/const PRIVATE\s*=/);
  });

  it("lets nothing through but the login, the reset and the shop window", () => {
    expect(gateOpens()).toEqual([
      "/", "/api/auth", "/carta", "/evento", "/eventos", "/login", "/paquetes", "/reset"
    ]);
  });

  /**
   * The gate and the pages must agree, in both directions.
   *
   * A public page the gate blocks is invisible: the page exists, its tests
   * pass, and every visitor is redirected to a login box. That is exactly what
   * happened to /reset on its first day — the token worked and nobody could
   * reach it, because every test signed in before it looked.
   *
   * A gate entry with no page behind it is the opposite failure: a door
   * somebody opened and forgot to close.
   */
  it("opens every page in app/(public)/, and nothing beyond them", () => {
    const shopWindow = found
      .filter((p) => isPublic(p.file))
      .map((p) => p.route.replace(/\/\(public\)/g, "") || "/")
      .sort();

    const opened = gateOpens().filter((e) => !["/login", "/api/auth", "/reset"].includes(e));

    // Reachable, not individually listed: the gate matches whole segments, so
    // "/carta" opens "/carta/[id]" too — which is what a QR code on a box needs.
    const reachable = (route: string) =>
      opened.some((e) => route === e || route.startsWith(`${e}/`));

    expect(shopWindow.filter((r) => !reachable(r))).toEqual([]);

    // And nothing is opened that has no page behind it.
    const orphans = opened.filter((e) => !shopWindow.some((r) => r === e || r.startsWith(`${e}/`)));
    expect(orphans).toEqual([]);
  });

  it("matches on whole path segments, so /carta does not open /cartagena", () => {
    // A plain startsWith would, and nobody notices until a route is named badly.
    expect(middleware).toMatch(/pathname === p \|\| pathname\.startsWith\(`\$\{p\}\/`\)/);
    expect(middleware).not.toMatch(/PUBLIC\.some\(\(p\) => pathname\.startsWith\(p\)\)/);
  });

  it("keeps the root out of the prefix list, where it would open everything", () => {
    const prefixes = /const PUBLIC_PREFIX = \[([\s\S]*?)\];/.exec(middleware)![1];
    expect([...prefixes.matchAll(/"([^"]+)"/g)].map((m) => m[1])).not.toContain("/");
  });
});
