/**
 * The client records, against a real Postgres.
 *
 * Two things are worth a test here and the rest follows from them. First, the
 * diets column is filtered on the way in: a free-text allergy stored against a
 * client would look like a check and be nothing of the kind, because
 * lib/dietary.ts cannot answer for a string it has never heard of. Second, a
 * client login may read its own record and no other — which is the same
 * scoping question as quotes, asked of a different table.
 *
 * The counts are SQL rather than JavaScript (`count(distinct …)::int` across two
 * left joins), so they are tested against a real planner. Counting quotes and
 * logins in one query with two joins is exactly where a row multiplies.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import { migrate, reset, close, makeUser, makeClient, fakeViewer, db } from "./helpers/pglite";
import {
  listClients, getClient, createClient, updateClient, dietClashes
} from "@/lib/repo/clients";
import { createQuote } from "@/lib/repo/quotes";
import { clients } from "@/db/schema";
import { DISHES } from "@/data/dishes";
import { dietaryIndex, dishesFor } from "@/lib/dietary";
import { RECIPES } from "@/data/recipes";
import type { Viewer } from "@/lib/session";

let owner: Viewer;
let chef: Viewer;

beforeAll(migrate);
afterAll(close);
beforeEach(async () => {
  await reset();
  owner = await makeUser("owner");
  chef = await makeUser("chef");
});

describe("writing a client", () => {
  it("keeps only diets lib/dietary.ts can actually answer for", async () => {
    const id = await createClient(owner, {
      name: "Ferguson",
      diets: ["gluten-free", "allergic to bees", "vegan", "", "GLUTEN-FREE"]
    });
    expect((await getClient(owner, id))!.diets).toEqual(["gluten-free", "vegan"]);
  });

  it("refuses a client with no name", async () => {
    await expect(createClient(owner, { name: "   " })).rejects.toThrow(/needs a name/);
    expect(await db.select().from(clients)).toHaveLength(0);
  });

  it("trims contact details and stores a blank as null, not as an empty string", async () => {
    const id = await createClient(owner, {
      name: "  Ferguson  ", contact: "  Ana  ", phone: "   ", notes: ""
    });
    const c = (await getClient(owner, id))!;
    expect(c.name).toBe("Ferguson");
    expect(c.contact).toBe("Ana");
    expect(c.phone).toBeNull();
    expect(c.notes).toBeNull();
  });

  it("edits in place, and re-filters the diets on the way back in", async () => {
    const id = await createClient(owner, { name: "Ferguson", diets: ["vegan"] });
    await updateClient(owner, id, { name: "Ferguson & Co", diets: ["nut-free", "nonsense"] });

    const c = (await getClient(owner, id))!;
    expect(c.name).toBe("Ferguson & Co");
    expect(c.diets).toEqual(["nut-free"]);
  });

  it("only an owner may add or edit", async () => {
    await expect(createClient(chef, { name: "Ferguson" })).rejects.toThrow(/Not permitted/);
    await expect(updateClient(chef, "x", { name: "Ferguson" })).rejects.toThrow(/Not permitted/);
  });
});

describe("counting, in SQL", () => {
  it("counts quotes per client without multiplying them by the logins", async () => {
    const a = await makeClient("Ferguson");
    await createQuote(owner, { name: "One", guests: 20, tier: "scran", clientId: a, dishIds: [DISHES[0].id] });
    await createQuote(owner, { name: "Two", guests: 20, tier: "scran", clientId: a, dishIds: [DISHES[1].id] });
    // Two logins against one client is exactly the shape that doubles a naive count.
    await makeUser("client", { clientId: a });
    await makeUser("client", { clientId: a });

    const [row] = await listClients(owner);
    expect(row.quoteCount).toBe(2);
    expect(row.hasLogin).toBe(true);
    expect((await getClient(owner, a))!.quoteCount).toBe(2);
  });

  it("a client with nothing yet counts zero and has no login", async () => {
    const a = await makeClient("Ferguson");
    const [row] = await listClients(owner);
    expect(row).toMatchObject({ quoteCount: 0, hasLogin: false });
    expect(await getClient(owner, a)).toMatchObject({ quoteCount: 0, hasLogin: false });
  });

  it("lists newest first", async () => {
    await makeClient("First");
    await new Promise((r) => setTimeout(r, 5));
    await makeClient("Second");
    expect((await listClients(owner)).map((c) => c.name)).toEqual(["Second", "First"]);
  });
});

describe("who may read", () => {
  it("a client may open their own record", async () => {
    const mine = await makeClient("Ferguson");
    const me = await makeUser("client", { clientId: mine });
    expect((await getClient(me, mine))!.name).toBe("Ferguson");
  });

  it("a client may not open anyone else's, and is told it does not exist", async () => {
    const mine = await makeClient("Ferguson");
    const theirs = await makeClient("Banco de Crédito");
    const me = await makeUser("client", { clientId: mine });
    expect(await getClient(me, theirs)).toBeNull();
  });

  it("a client may not list clients at all", async () => {
    await expect(listClients(fakeViewer("client"))).rejects.toThrow(/Not permitted/);
  });

  it("a chef may see the list — allergies are a kitchen matter", async () => {
    await makeClient("Ferguson");
    expect(await listClients(chef)).toHaveLength(1);
  });

  it("a missing client is null, not a crash", async () => {
    expect(await getClient(owner, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("dietClashes", () => {
  const index = dietaryIndex(RECIPES);
  /** A dish that genuinely is not vegan, per the same engine the app uses. */
  const notVegan = DISHES.find((d) => !dishesFor([d], index, ["vegan"]).length)!;
  const vegan = DISHES.find((d) => dishesFor([d], index, ["vegan"]).length === 1)!;

  it("names the dish, the diet and the reason", () => {
    const [clash] = dietClashes({ diets: ["vegan"] }, [notVegan]);
    expect(clash.diet).toBe("vegan");
    expect(clash.dietLabel).toBeTruthy();
    expect(clash.dishes.map((d) => d.id)).toEqual([notVegan.id]);
    expect(Array.isArray(clash.dishes[0].because)).toBe(true);
  });

  it("says nothing when the menu is already safe", () => {
    expect(dietClashes({ diets: ["vegan"] }, [vegan])).toEqual([]);
  });

  it("ignores a diet it cannot answer for rather than guessing", () => {
    expect(dietClashes({ diets: ["allergic to bees"] }, [notVegan])).toEqual([]);
  });

  it("a client with no diets recorded clashes with nothing", () => {
    expect(dietClashes({ diets: [] }, DISHES.slice(0, 20))).toEqual([]);
  });

  it("agrees with lib/dietary.ts on the whole menu, not just a sample", () => {
    const clashes = dietClashes({ diets: ["gluten-free"] }, DISHES);
    const flagged = new Set(clashes[0]?.dishes.map((d) => d.id) ?? []);
    const safe = new Set(dishesFor(DISHES, index, ["gluten-free"]).map((d) => d.id));

    for (const d of DISHES) {
      expect(flagged.has(d.id)).toBe(!safe.has(d.id));
    }
  });
});
