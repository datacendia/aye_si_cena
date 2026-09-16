/**
 * What the label said, and when.
 *
 * The QR on a box resolves to a page generated live from the recipe, which is
 * exactly right for a guest standing at a party: it cannot be stale. It is
 * exactly wrong six months later, when somebody asks what the label on that box
 * said on the fourteenth of March — because the live page answers for today,
 * and by then the recipe may have changed.
 *
 * That gap is the difference between a nice feature and a record. A record has
 * to be able to say "on that date, this dish declared eggs, gluten and milk,
 * and here is the row written at the time".
 *
 * So every distinct declaration is written down once, keyed by a fingerprint of
 * its own content. Re-declaring the same thing touches `lastSeen`. Changing a
 * recipe's allergens writes a new row and leaves the old one standing, forever.
 * Nothing here is ever updated in place and nothing is ever deleted — a table
 * you can edit is not evidence of anything.
 *
 * Writing happens on read. The scan itself records the declaration it served,
 * which is the only moment you can be sure what somebody was actually shown.
 */
import { createHash } from "node:crypto";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db, declarations } from "@/db";
import { CAN, assertCan } from "@/lib/permissions";
import type { Viewer } from "@/lib/session";

export interface Declared {
  dishId: number;
  name: string;
  allergens: string[];
  suits: string[];
}

/**
 * The content, reduced to one string.
 *
 * Sorted before hashing so the order the arrays happen to arrive in cannot
 * create a second row for an identical declaration. The name is in the
 * fingerprint because a renamed dish is a different label, and somebody
 * checking a box against a record needs the name to match.
 */
export function fingerprint(d: Declared): string {
  const canonical = JSON.stringify({
    dishId: d.dishId,
    name: d.name.trim(),
    allergens: [...d.allergens].sort(),
    suits: [...d.suits].sort()
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Write down what was just served to somebody, if it is not already written.
 *
 * Deliberately swallows its own failures. This runs on a page a guest is
 * looking at with a box in their hand: if the database is asleep, they must
 * still see the allergens. Losing one audit row is bad; showing a blank page to
 * somebody checking for nuts is worse, and the two are not close.
 */
export async function noteDeclaration(d: Declared): Promise<void> {
  try {
    const hash = fingerprint(d);
    await db.insert(declarations).values({
      dishId: d.dishId,
      fingerprint: hash,
      name: d.name.trim(),
      allergens: [...d.allergens].sort(),
      suits: [...d.suits].sort()
    }).onConflictDoUpdate({
      target: [declarations.dishId, declarations.fingerprint],
      set: { lastSeen: new Date() }
    });
  } catch {
    // See above. The page renders either way.
  }
}

/** Every declaration ever made for one dish, oldest first. */
export async function historyFor(me: Viewer, dishId: number) {
  assertCan(CAN.seeKitchen, me.role, "read the declaration history");
  return db.select().from(declarations)
    .where(eq(declarations.dishId, dishId))
    .orderBy(asc(declarations.firstSeen));
}

/**
 * What this dish declared on a given date.
 *
 * The row that was current then: the latest one first seen on or before that
 * day. Null when nothing had been declared yet, which is itself the honest
 * answer — it means no label was printed from this system.
 */
export async function declaredOn(me: Viewer, dishId: number, when: Date) {
  assertCan(CAN.seeKitchen, me.role, "read the declaration history");
  const [row] = await db.select().from(declarations)
    .where(and(eq(declarations.dishId, dishId), lte(declarations.firstSeen, when)))
    .orderBy(desc(declarations.firstSeen))
    .limit(1);
  return row ?? null;
}

/** Dishes whose declaration has changed, newest change first. For the owner. */
export async function changed(me: Viewer) {
  assertCan(CAN.seeKitchen, me.role, "read the declaration history");
  const all = await db.select().from(declarations).orderBy(desc(declarations.firstSeen));

  const seen = new Map<number, number>();
  for (const row of all) seen.set(row.dishId, (seen.get(row.dishId) ?? 0) + 1);

  return all.filter((r) => (seen.get(r.dishId) ?? 0) > 1);
}
