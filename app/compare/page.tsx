import { fullDishes } from "@/lib/permissions";
import { requireCan, CAN } from "@/lib/session";
import type { Metadata } from "next";
import Compare from "@/components/Compare";
import { menu } from "@/lib/repo/menu";
import { eligibleIdsByTier } from "@/lib/tiers";
import { RECIPES } from "@/data/recipes";
import { TIERS } from "@/lib/pricing";

export const metadata: Metadata = { title: "Compare tiers" };

export default async function ComparePage() {
  const me = await requireCan(CAN.seeMoney, "see what the money buys");
  const dishes = await menu(me.locale);
  const TIER_IDS = Object.keys(TIERS) as (keyof typeof TIERS)[];
  const eligible = eligibleIdsByTier(dishes, TIER_IDS, RECIPES);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          What the money buys
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          The same event at every tier, side by side. Set the head count and the difference
          between a children&rsquo;s box and the Ceilidh Table stops being a sentence and becomes
          a number.
        </p>
      </section>
      <section className="py-10">
        <Compare eligible={eligible} dishes={fullDishes(dishes, me.role)} />
      </section>
    </>
  );
}
