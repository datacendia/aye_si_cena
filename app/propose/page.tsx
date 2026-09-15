import type { Metadata } from "next";
import { requireCan, CAN } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { listClients } from "@/lib/repo/clients";
import { menu } from "@/lib/repo/menu";
import { MONTH_NAMES } from "@/lib/dishes";
import ProposeForm from "./form";

export const metadata: Metadata = { title: "Propose a menu" };

/**
 * Six constraints, six modules that already existed.
 *
 * None of the reasoning behind this page is new — vedas, seasonality, the
 * food-cost band, the diet engine, the capacity kit and the Scottish half have
 * all been in the repository for months, and each has had its own screen. What
 * nobody had done is ask all six at once, which is exactly what a person does
 * in their head while a client is still on the phone.
 *
 * The rejections are shown as prominently as the menu, deliberately. A proposal
 * that cannot say what it ruled out is worth nothing to somebody about to send
 * it to a client — and the sentence "four dishes are out because the corvina
 * veda is on" is more useful than any menu.
 */
export default async function ProposePage() {
  const me = await requireCan(CAN.writeQuotes, "propose a menu");
  const t = await loadCopy(me.locale);
  const clients = await listClients(me);
  const dishes = await menu(me.locale);

  // Offered from the dishes themselves rather than hard-coded, so a new piece
  // of kit in the matrix appears here without anyone editing this file.
  const equipment = [...new Set(dishes.flatMap((d) => d.equipment))].sort();

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("propose.heading")}
        </h1>
        <p className="mt-4 max-w-3xl text-ink-2">{t("propose.lede")}</p>
      </section>

      <section className="py-10">
        <ProposeForm
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          months={MONTH_NAMES}
          equipment={equipment}
          thisMonth={new Date().getMonth() + 1}
          es={me.locale === "es"}
          labels={{
            lede: t("propose.lede"), month: t("propose.month"),
            client: t("propose.client"), noClient: t("propose.noClient"),
            dishes: t("propose.dishes"), kit: t("propose.kit"),
            go: t("propose.go"), why: t("propose.why"),
            rejected: t("propose.rejected"), rejectedLede: t("propose.rejectedLede"),
            british: t("propose.british"), draft: t("propose.draft"),
            diets: t("propose.diets"), foodCost: t("propose.foodCost")
          }}
        />
      </section>
    </>
  );
}
