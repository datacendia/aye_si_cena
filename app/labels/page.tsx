import type { Metadata } from "next";
import { requireCan, CAN } from "@/lib/session";
import { loadCopy, allergenLabel, dietLabel } from "@/lib/copy";
import { menu } from "@/lib/repo/menu";
import { listBookings } from "@/lib/repo/bookings";
import { publicDiets } from "@/lib/public";
import { labelsFor } from "@/lib/labels";
import { ALLERGENS, ALLERGEN_LABEL, DIETS, DIET_LABEL } from "@/lib/dietary";
import Sheet from "./sheet";

export const metadata: Metadata = { title: "Box labels" };

/**
 * The labels that go on the boxes.
 *
 * A kitchen page, not a public one — but everything it prints resolves to a
 * public page, because a guest holding a box has no account and never will.
 *
 * The default is one label per dish on a chosen booking rather than all 223:
 * printing the whole matrix is 223 stickers nobody needs, and the thing that
 * actually happens at 6am is "what is going in today's boxes".
 *
 * A chef may print these. They are the person packing.
 */
export default async function LabelsPage(
  { searchParams }: { searchParams: Promise<{ booking?: string }> }
) {
  const me = await requireCan(CAN.seeKitchen, "print the box labels");
  const t = await loadCopy(me.locale);
  const { booking } = await searchParams;

  const dishes = await menu(me.locale);
  const bookings = await listBookings(me);
  const chosen = bookings.find((b) => b.id === booking) ?? null;

  const forPrinting = chosen
    ? dishes.filter((d) => chosen.dishIds.includes(d.id))
    : dishes;

  /*
   * The absolute URL is baked into every code, so it has to be the deployment's
   * own address rather than a relative path — a QR cannot resolve "/carta/7"
   * against nothing. AUTH_URL is already required for Auth.js to work at all,
   * so there is no second thing to configure and forget.
   */
  const base = (process.env.AUTH_URL ?? "").replace(/\/+$/, "");

  const labels = labelsFor(forPrinting, base, {
    allergens: Object.fromEntries(
      ALLERGENS.map((a) => [a, allergenLabel(t, a, ALLERGEN_LABEL[a])])
    ),
    diets: Object.fromEntries(DIETS.map((d) => [d, dietLabel(t, d, DIET_LABEL[d])])),
    suitsByDish: await publicDiets()
  });

  return (
    <Sheet
      labels={labels}
      baseMissing={base === ""}
      bookings={bookings.map((b) => ({
        id: b.id,
        label: `${b.eventDate.toLocaleDateString("en-GB", {
          day: "numeric", month: "short"
        })} · ${b.clientName ?? b.quoteName ?? "—"} · ${b.dishIds.length}`
      }))}
      selected={chosen?.id ?? ""}
      labelsText={{
        heading: t("labels.heading"), lede: t("labels.lede"),
        print: t("labels.print"), forEvent: t("labels.forEvent"),
        wholeMenu: t("labels.wholeMenu"), scanToRead: t("labels.scanToRead"),
        contains: t("dish.contains"), containsNone: t("dish.containsNone")
      }}
    />
  );
}
