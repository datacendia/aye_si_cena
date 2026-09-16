import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan, CAN } from "@/lib/session";
import { loadCopy, allergenLabel } from "@/lib/copy";
import { menu } from "@/lib/repo/menu";
import { listBookings } from "@/lib/repo/bookings";
import { RECIPES } from "@/data/recipes";
import { ALLERGEN_LABEL } from "@/lib/dietary";
import { portionsNeeded, scaleRecipe } from "@/lib/scaling";
import type { ServiceTier } from "@/lib/dishes";

export const metadata: Metadata = { title: "In the kitchen" };

/**
 * The same sticker, the other side of it.
 *
 * A guest scanning a box gets /carta/<id>: what is in it, in plain words. A
 * chef scanning the same box — signed in, on the kitchen's phone — wants the
 * recipe, the quantities for today's job, and how long it holds. One sticker,
 * two readers, and the link on the box never changes.
 *
 * The quantities are the point. A recipe that says "50 pieces" is useless at
 * 6am when the question is "how much do I make for the Ferguson wedding", and
 * lib/scaling.ts has answered that since it was written — it just had no way to
 * be asked from a box.
 *
 * ?booking= scales it. Without one the page shows the batch as written, because
 * inventing a guest count would be worse than asking.
 */
export default async function KitchenPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ booking?: string }>;
  }
) {
  const me = await requireCan(CAN.seeKitchen, "read a recipe");
  const t = await loadCopy(me.locale);
  const { id } = await params;
  const { booking } = await searchParams;

  const dishes = await menu(me.locale);
  const dish = dishes.find((d) => String(d.id) === id);
  if (!dish) notFound();

  const recipe = RECIPES.find((r) => r.dishId === dish.id) ?? null;
  const bookings = await listBookings(me);
  const chosen = bookings.find((b) => b.id === booking) ?? null;

  /*
   * Portions needed for that job, not for the whole menu.
   *
   * portionsNeeded() divides the tier's bites across the canapés actually
   * chosen, so making this dish for a 120-guest wedding with six canapés on it
   * is not 120 of each — it is the share the guest actually eats.
   */
  const needed =
    chosen && recipe
      ? portionsNeeded(
          dish,
          dishes.filter((d) => chosen.dishIds.includes(d.id)),
          chosen.guests,
          chosen.tier as ServiceTier
        )
      : null;

  const scaled = recipe && needed ? scaleRecipe(recipe, dish, needed) : null;

  return (
    <article className="mx-auto max-w-2xl py-10">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
        {t("kitchen.heading")} · {String(dish.id).padStart(3, "0")}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight">
        {dish.name}
      </h1>

      {dish.allergens.length > 0 && (
        <p className="mt-4 rounded-lg border border-warn bg-warn/5 p-3 font-mono text-[11px]
                      uppercase tracking-wide text-warn">
          {dish.allergens.map((a) => allergenLabel(t, a, ALLERGEN_LABEL[a])).join(" · ")}
        </p>
      )}

      {!recipe ? (
        <p className="mt-8 text-ink-2">{t("kitchen.noRecipe")}</p>
      ) : (
        <>
          <section className="mt-7">
            <form className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                  {t("kitchen.forBooking")}
                </span>
                <select
                  name="booking"
                  defaultValue={chosen?.id ?? ""}
                  className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {bookings
                    .filter((b) => b.dishIds.includes(dish.id))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.eventDate.toLocaleDateString("en-GB", {
                          day: "numeric", month: "short"
                        })} · {b.clientName ?? b.quoteName ?? "—"} · {b.guests}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg"
              >
                ↻
              </button>
            </form>

            {scaled ? (
              <p className="mt-4 font-mono text-sm text-ink-2">
                <span className="tnum text-ink">{scaled.batches}</span>{" "}
                {t("kitchen.batches")} · <span className="tnum text-ink">{scaled.produced}</span>{" "}
                / <span className="tnum">{scaled.needed}</span>
              </p>
            ) : (
              <p className="mt-4 text-sm text-ink-3">{t("kitchen.pickBooking")}</p>
            )}
          </section>

          <section className="mt-7">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {t("kitchen.yields")} · {recipe.yields}
            </h2>
            <ul className="mt-3 divide-y divide-line/60">
              {(scaled?.lines ?? recipe.ingredients).map((l, i) => (
                <li key={`${l.item}-${i}`} className="flex gap-4 py-1.5 text-sm">
                  <span className="tnum w-24 shrink-0 font-mono text-ink">{l.qty}</span>
                  <span className="text-ink-2">
                    {l.item}
                    {l.note && <span className="ml-2 text-ink-3">— {l.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-7">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {t("kitchen.method")} · {t("kitchen.prep")} {recipe.prepMin}{" "}
              {t("kitchen.minutes")} · {t("kitchen.cook")} {recipe.cookMin}{" "}
              {t("kitchen.minutes")}
            </h2>
            <ol className="mt-3 space-y-2 text-sm text-ink-2">
              {recipe.method.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="tnum shrink-0 font-mono text-[11px] text-ink-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-7 rounded-lg border border-line bg-surface p-4">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {t("kitchen.holds")}
            </h2>
            <p className="mt-1.5 text-sm text-ink-2">{recipe.holds}</p>
            <p className="mt-2 text-sm text-ink-3">{recipe.makeAhead}</p>
          </section>
        </>
      )}

      <p className="mt-8 border-t border-line pt-4">
        <Link href={`/carta/${dish.id}`} className="text-sm text-aji underline hover:text-ink">
          {t("kitchen.asGuestSees")} →
        </Link>
      </p>
    </article>
  );
}
