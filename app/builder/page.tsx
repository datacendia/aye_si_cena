import { fullDishes } from "@/lib/permissions";
import { requireCan, CAN } from "@/lib/session";
import type { Metadata } from "next";
import MenuBuilder from "@/components/MenuBuilder";
import { menu } from "@/lib/repo/menu";
import { eligibleIdsByTier } from "@/lib/tiers";
import { RECIPES } from "@/data/recipes";
import { TIERS } from "@/lib/pricing";
import { loadCopy, categoryLabel } from "@/lib/copy";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/dishes";

export const metadata: Metadata = { title: "Build a menu" };

export default async function BuilderPage() {
  const me = await requireCan(CAN.writeQuotes, "build and price a menu");
  const dishes = await menu(me.locale);
  const t = await loadCopy(me.locale);
  const TIER_IDS = Object.keys(TIERS) as (keyof typeof TIERS)[];
  const eligible = eligibleIdsByTier(dishes, TIER_IDS, RECIPES);

  const categories = Object.fromEntries(
    CATEGORY_ORDER.map((c) => [c, categoryLabel(t, c, CATEGORY_LABEL[c])])
  );


  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Build a menu
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Choose a tier, set the head count, pick dishes. The price updates as you go — including
          menaje, staff, transport and IGV, so the number at the bottom is the one the client
          actually pays.
        </p>
      </section>
      <section className="py-10">
        <MenuBuilder eligible={eligible} categories={categories} dishes={fullDishes(dishes, me.role)} />
      </section>
    </>
  );
}
