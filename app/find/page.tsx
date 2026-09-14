import { visibleDishes } from "@/lib/permissions";
import { requireViewer } from "@/lib/session";
import type { Metadata } from "next";
import Finder from "@/components/Finder";
import { menu } from "@/lib/repo/menu";
import { EVENTS } from "@/data/events";
import { FLAVOURS } from "@/data/flavours";

export const metadata: Metadata = { title: "Find dishes" };

export default async function FindPage() {
  const me = await requireViewer();
  const dishes = await menu(me.locale);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Find dishes
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Start from the event or start from the palate. Pick what you are planning and the matrix
          narrows to what actually works for it — then filter by flavour to land on a shortlist.
        </p>
      </section>
      <section className="py-10">
        <Finder dishes={visibleDishes(dishes, me.role)} events={EVENTS} flavours={FLAVOURS} />
      </section>
    </>
  );
}
