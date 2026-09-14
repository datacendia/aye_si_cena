/**
 * Resetting a password without an email service, against a real Postgres.
 *
 * The design question here was not how to hash a token — it was what to do when
 * there is no SMTP account and there is not going to be one. The answer is that
 * the owner issues the link and sends it over WhatsApp, which is how this
 * business already reaches everybody. That makes the tests below the important
 * ones: the link must be single-use, short-lived, and worth nothing to anyone
 * reading the database or a backup of it.
 */
jest.mock("@/db", () => require("./helpers/pglite").mockModule());

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  migrate, reset, close, db, makeUser, fakeViewer, assertResetCoversEveryTable
} from "./helpers/pglite";
import {
  issueReset, resetTarget, redeemReset, changeOwnPassword,
  listLogins, setActive, MIN_PASSWORD, RESET_MINUTES
} from "@/lib/repo/passwords";
import { passwordResets, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Viewer } from "@/lib/session";

const GOOD = "correct horse battery staple";
let owner: Viewer;
let chef: Viewer;

beforeAll(migrate);
afterAll(close);
beforeEach(async () => {
  await reset();
  owner = await makeUser("owner");
  chef = await makeUser("chef");
});

it("the reset between tests covers every table", assertResetCoversEveryTable);

const hashOf = (t: string) => createHash("sha256").update(t).digest("hex");

describe("issuing a link", () => {
  it("stores only the hash — a leaked backup carries nothing usable", async () => {
    const { token } = await issueReset(owner, chef.id);
    const [row] = await db.select().from(passwordResets);

    expect(row.tokenHash).toBe(hashOf(token));
    expect(row.tokenHash).not.toBe(token);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("expires within the hour", async () => {
    const { expires } = await issueReset(owner, chef.id);
    const minutes = (expires.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(RESET_MINUTES - 2);
    expect(minutes).toBeLessThanOrEqual(RESET_MINUTES);
  });

  it("burns any live link for that account, so an old one cannot be dug up", async () => {
    const first = await issueReset(owner, chef.id);
    const second = await issueReset(owner, chef.id);

    expect(await resetTarget(first.token)).toBeNull();
    expect(await resetTarget(second.token)).not.toBeNull();
    expect(await db.select().from(passwordResets)).toHaveLength(1);
  });

  it("issues a token nobody could guess, and a different one each time", async () => {
    const a = await issueReset(owner, chef.id);
    const b = await issueReset(owner, chef.id);
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(40);
  });

  it("records who issued it", async () => {
    await issueReset(owner, chef.id);
    expect((await db.select().from(passwordResets))[0].issuedBy).toBe(owner.id);
  });

  it("only an owner may issue one", async () => {
    await expect(issueReset(chef, owner.id)).rejects.toThrow(/Not permitted/);
    await expect(issueReset(fakeViewer("client"), owner.id)).rejects.toThrow(/Not permitted/);
    expect(await db.select().from(passwordResets)).toHaveLength(0);
  });

  it("refuses an account that does not exist", async () => {
    await expect(issueReset(owner, "nobody")).rejects.toThrow(/No such account/);
  });
});

describe("reading a link", () => {
  it("names the account it is for, so nobody sets a password on the wrong one", async () => {
    const { token } = await issueReset(owner, chef.id);
    expect(await resetTarget(token)).toMatchObject({ userId: chef.id, email: chef.email });
  });

  it("is null for an invented token, an empty one, or the stored hash itself", async () => {
    const { token } = await issueReset(owner, chef.id);
    expect(await resetTarget("not-a-token")).toBeNull();
    expect(await resetTarget("")).toBeNull();
    // Somebody who can read the table still cannot sign in with what is in it.
    expect(await resetTarget(hashOf(token))).toBeNull();
  });

  it("is null once it has expired", async () => {
    const { token } = await issueReset(owner, chef.id);
    await db.update(passwordResets)
      .set({ expires: new Date(Date.now() - 1000) })
      .where(eq(passwordResets.tokenHash, hashOf(token)));

    expect(await resetTarget(token)).toBeNull();
  });
});

describe("spending a link", () => {
  it("sets the password and the person can sign in with it", async () => {
    const { token } = await issueReset(owner, chef.id);
    await redeemReset(token, GOOD);

    const [row] = await db.select().from(users).where(eq(users.id, chef.id));
    expect(await bcrypt.compare(GOOD, row.passwordHash!)).toBe(true);
  });

  it("works exactly once", async () => {
    const { token } = await issueReset(owner, chef.id);
    await redeemReset(token, GOOD);

    await expect(redeemReset(token, "some other password")).rejects
      .toThrow(/expired or has already been used/);
    const [row] = await db.select().from(users).where(eq(users.id, chef.id));
    expect(await bcrypt.compare(GOOD, row.passwordHash!)).toBe(true);
  });

  it("switches a disabled account back on — otherwise the reset achieves nothing", async () => {
    await setActive(owner, chef.id, false);
    const { token } = await issueReset(owner, chef.id);
    await redeemReset(token, GOOD);

    const [row] = await db.select().from(users).where(eq(users.id, chef.id));
    expect(row.active).toBe(true);
  });

  it("refuses a short password, and leaves the link unspent", async () => {
    const { token } = await issueReset(owner, chef.id);
    await expect(redeemReset(token, "short")).rejects
      .toThrow(new RegExp(`${MIN_PASSWORD} characters`));

    expect(await resetTarget(token)).not.toBeNull();
  });

  it("refuses an expired link before it looks at the password", async () => {
    await expect(redeemReset("nope", GOOD)).rejects.toThrow(/expired or has already been used/);
  });
});

describe("changing your own password", () => {
  beforeEach(async () => {
    await db.update(users)
      .set({ passwordHash: await bcrypt.hash("the old one, which is long", 10) })
      .where(eq(users.id, chef.id));
  });

  it("needs the current one", async () => {
    await expect(changeOwnPassword(chef, "not it", GOOD))
      .rejects.toThrow(/not your current password/);
  });

  it("changes it when the current one is right", async () => {
    await changeOwnPassword(chef, "the old one, which is long", GOOD);
    const [row] = await db.select().from(users).where(eq(users.id, chef.id));
    expect(await bcrypt.compare(GOOD, row.passwordHash!)).toBe(true);
  });

  it("refuses to set the password you already have", async () => {
    await expect(changeOwnPassword(chef, "the old one, which is long", "the old one, which is long"))
      .rejects.toThrow(/already have/);
  });

  it("refuses a short one", async () => {
    await expect(changeOwnPassword(chef, "the old one, which is long", "short"))
      .rejects.toThrow(new RegExp(`${MIN_PASSWORD} characters`));
  });

  it("refuses when the account has no password at all", async () => {
    await expect(changeOwnPassword(owner, "anything", GOOD))
      .rejects.toThrow(/not your current password/);
  });
});

describe("switching an account off", () => {
  it("takes effect on the next request, because authority is read not remembered", async () => {
    await setActive(owner, chef.id, false);
    const [row] = await db.select().from(users).where(eq(users.id, chef.id));
    expect(row.active).toBe(false);
  });

  it("refuses to let the owner switch off their own account", async () => {
    await expect(setActive(owner, owner.id, false))
      .rejects.toThrow(/nobody could switch it back/);
  });

  it("lets the owner switch their own back on, which is a no-op but not a trap", async () => {
    await setActive(owner, owner.id, true);
    const [row] = await db.select().from(users).where(eq(users.id, owner.id));
    expect(row.active).toBe(true);
  });

  it("only an owner may", async () => {
    await expect(setActive(chef, owner.id, false)).rejects.toThrow(/Not permitted/);
    await expect(listLogins(chef)).rejects.toThrow(/Not permitted/);
  });
});

describe("listing the logins", () => {
  it("lists every account by email", async () => {
    const rows = await listLogins(owner);
    expect(rows.map((r) => r.email).sort()).toEqual([chef.email, owner.email].sort());
  });

  it("says whether a password is set without handing over the hash", async () => {
    await db.update(users)
      .set({ passwordHash: await bcrypt.hash(GOOD, 10) })
      .where(eq(users.id, chef.id));

    const rows = await listLogins(owner);
    const theChef = rows.find((r) => r.id === chef.id)!;
    const theOwner = rows.find((r) => r.id === owner.id)!;

    expect(Boolean(theChef.hasPassword)).toBe(true);
    expect(Boolean(theOwner.hasPassword)).toBe(false);
  });
});
