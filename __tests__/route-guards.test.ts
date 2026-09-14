import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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

  it("actually calls the chokepoint on the pages that render dishes", () => {
    for (const route of ["/find", "/moments", "/graph", "/recipes", "/seasonal"]) {
      const page = found.find((p) => p.route === route);
      expect(page).toBeDefined();
      expect(page!.src).toMatch(/visibleDishes\(\s*DISHES\s*,\s*me\.role\s*\)/);
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

  it("lists what is public rather than what is private", () => {
    // An allow-list of private routes would leave every new page open. This
    // must be the other way round.
    expect(middleware).toMatch(/const PUBLIC\s*=/);
    expect(middleware).not.toMatch(/const PRIVATE\s*=/);
  });

  it("lets nothing through but the login page and the auth endpoints", () => {
    const list = /const PUBLIC = \[([^\]]*)\]/.exec(middleware)![1];
    const entries = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(entries).toEqual(["/api/auth", "/login"]);
  });
});
