import { visibleDishes } from "@/lib/permissions";
import { requireViewer } from "@/lib/session";
import type { Metadata } from "next";
import Moments from "@/components/Moments";
import { menu } from "@/lib/repo/menu";
import { MOMENTS } from "@/data/moments";

export const metadata: Metadata = { title: "The evening" };

export default async function MomentsPage() {
  const me = await requireViewer();
  const dishes = await menu(me.locale);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          The evening
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Point at the part of the night you are trying to fill. The bar under each moment shows
          how much of the matrix serves it — which is also where the gaps are.
        </p>
      </section>
      <section className="py-10">
        <Moments dishes={visibleDishes(dishes, me.role)} moments={MOMENTS} />
      </section>
    </>
  );
}
