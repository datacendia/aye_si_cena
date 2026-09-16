import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { publicLocale } from "@/lib/public-locale";
import { publicMenu, publicDiets } from "@/lib/public";
import { DIETS, DIET_LABEL, ALLERGENS, ALLERGEN_LABEL } from "@/lib/dietary";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/dishes";
import { categoryLabel, dietLabel, allergenLabel } from "@/lib/copy";
import MenuBrowser from "./browser";

export const metadata: Metadata = {
  title: "The menu",
  description:
    "Every dish we cook, with what is in it and which diets it suits — read " +
    "straight off the recipe."
};

/**
 * The menu, for somebody who has not met you yet.
 *
 * It carries no price, and that is deliberate rather than coy. A per-dish price
 * on a public page is a negotiating position set months ago for a different
 * event in a different district, and every conversation then starts by
 * explaining why the real number is not that one. /paquetes advertises a
 * per-guest figure instead, which is what a caterer actually sells.
 *
 * What it does carry is the allergens and the diets, because those are the
 * questions somebody is actually on this page to answer — and because they come
 * from lib/dietary.ts reading the recipe, so the filter a customer uses here
 * and the sheet the chef reads on the day cannot disagree.
 */
export default async function CartaPage() {
  if (await viewer()) redirect("/find");

  const locale = await publicLocale();
  const t = await loadCopy(locale);
  const dishes = await publicMenu(locale);
  const dietsByDish = await publicDiets();

  /*
   * Resolved here rather than in the browser. The copy book is a database read
   * and a client component cannot do one — and shipping the whole book to the
   * browser to translate seven words would be a strange trade.
   */
  const categories = CATEGORY_ORDER.map((c) => ({
    id: c, label: categoryLabel(t, c, CATEGORY_LABEL[c])
  }));

  /*
   * Allergen names matter more than the other labels on this page. Somebody
   * scanning for "APIO" and reading "CELERY" has not been told anything, and
   * celery is on the declarable list precisely because it puts people in
   * hospital.
   */
  const allergens = Object.fromEntries(
    ALLERGENS.map((a) => [a, allergenLabel(t, a, ALLERGEN_LABEL[a])])
  );

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("pub.menuHeading")}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">{t("pub.menuLede")}</p>
        <p className="mt-3 max-w-2xl text-sm text-ink-3">{t("pub.menuPricesNote")}</p>
      </section>

      <section className="py-10">
        <MenuBrowser
          dishes={dishes}
          dietsByDish={dietsByDish}
          categories={categories}
          allergens={allergens}
          diets={DIETS.map((d) => ({ id: d, label: dietLabel(t, d, DIET_LABEL[d]) }))}
          labels={{
            search: t("pub.search"), searchHint: t("pub.searchHint"),
            of: t("pub.of"), course: t("pub.course"), diets: t("pub.diets"),
            clear: t("pub.clear"), nothing: t("pub.nothing"),
            contains: t("pub.contains"), noneOfThe14: t("pub.noneDeclarable"),
            licence: t("pub.licence")
          }}
        />
      </section>

      <section className="border-t border-line py-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {t("pub.allergens")}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-ink-2">{t("pub.allergensLede")}</p>
      </section>
    </>
  );
}
