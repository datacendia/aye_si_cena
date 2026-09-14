import { visibleDishes } from "@/lib/permissions";
import { requireCan, CAN } from "@/lib/session";
import type { Metadata } from "next";
import Graph from "@/components/Graph";
import { menu } from "@/lib/repo/menu";

export const metadata: Metadata = { title: "Ingredient graph" };

export default async function GraphPage() {
  const me = await requireCan(CAN.seeKitchen, "see the ingredient network");
  const dishes = await menu(me.locale);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          What unlocks what
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Every ingredient in the matrix, sized by how much menu it opens up. Answers two buying
          questions at once: what belongs on a standing order, and which dishes are carrying an
          ingredient nothing else uses.
        </p>
      </section>
      <section className="py-10">
        <Graph dishes={visibleDishes(dishes, me.role)} />
      </section>
    </>
  );
}
