import { visibleDishes } from "@/lib/permissions";
import { requireCan, CAN } from "@/lib/session";
import type { Metadata } from "next";
import Seasonal from "@/components/Seasonal";
import { menu } from "@/lib/repo/menu";
import { INGREDIENTS } from "@/data/ingredients";

export const metadata: Metadata = { title: "Season" };

export default async function SeasonalPage() {
  const me = await requireCan(CAN.seeKitchen, "see the season and the vedas");
  const dishes = await menu(me.locale);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          What the market has
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          You buy all year, so the menu moves with the market. Pick a month to see what is worth
          buying, what is out of window, and — the part that matters when you are quoting — which
          dishes you cannot properly build until it comes back.
        </p>
      </section>
      <section className="py-10">
        <Seasonal dishes={visibleDishes(dishes, me.role)} ingredients={INGREDIENTS} />
      </section>
    </>
  );
}
