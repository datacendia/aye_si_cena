import { fullDishes } from "@/lib/permissions";
import { requireCan, CAN } from "@/lib/session";
import type { Metadata } from "next";
import Compare from "@/components/Compare";
import { menu } from "@/lib/repo/menu";

export const metadata: Metadata = { title: "Compare tiers" };

export default async function ComparePage() {
  const me = await requireCan(CAN.seeMoney, "see what the money buys");
  const dishes = await menu(me.locale);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          What the money buys
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          The same event at all three tiers, side by side. Set the head count and the difference
          between a boxed lunch and a plated dinner stops being a sentence and becomes a number.
        </p>
      </section>
      <section className="py-10">
        <Compare dishes={fullDishes(dishes, me.role)} />
      </section>
    </>
  );
}
