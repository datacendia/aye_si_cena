import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCopy, allergenLabel, dietLabel, categoryLabel } from "@/lib/copy";
import { publicLocale } from "@/lib/public-locale";
import { publicMenu, publicDiets } from "@/lib/public";
import { ALLERGEN_LABEL, DIET_LABEL } from "@/lib/dietary";
import { CATEGORY_LABEL } from "@/lib/dishes";
import { WHATSAPP_HREF } from "../../contact";

/**
 * Where a QR code on a box lands.
 *
 * This is the only page in the app whose reader is holding food. They are
 * standing at a party with a box in one hand and a phone in the other, and they
 * want one thing: whether their child can eat it.
 *
 * So the declaration is first, above everything, and the answer to "contains
 * nuts?" is visible without scrolling. The lineage, the fusion story and the
 * link to the rest of the menu come after — they are why somebody books, but
 * they are not why somebody scanned.
 *
 * No price. A guest holding a canapé is not a buyer, and a number here would
 * read as what that one bite cost.
 *
 * Deliberately public and deliberately not signed in: a guest has no account,
 * and requiring one would mean the label is decorative.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const locale = await publicLocale();
  const dish = (await publicMenu(locale)).find((d) => String(d.id) === id);
  if (!dish) return { title: "—" };

  return {
    title: dish.name,
    description: dish.allergens.length
      ? `${dish.name} — contains ${dish.allergens.join(", ")}.`
      : `${dish.name} — none of the 14 declarable allergens.`
  };
}

export default async function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await publicLocale();
  const t = await loadCopy(locale);

  const dish = (await publicMenu(locale)).find((d) => String(d.id) === id);
  if (!dish) notFound();

  const suits = (await publicDiets())[dish.id] ?? [];

  return (
    <article className="mx-auto max-w-2xl py-10">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
        {categoryLabel(t, dish.category, CATEGORY_LABEL[dish.category])}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight">
        {dish.name}
      </h1>

      {/* The declaration, first and largest. It is why they scanned. */}
      <section
        aria-labelledby="declares"
        className={`mt-7 rounded-xl border p-5 ${
          dish.allergens.length > 0 ? "border-warn bg-warn/5" : "border-good bg-good/5"
        }`}
      >
        <h2 id="declares" className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
          {t("dish.declares")}
        </h2>

        {dish.allergens.length > 0 ? (
          <>
            <p className="mt-2 font-display text-2xl font-semibold text-warn">
              {t("dish.contains")}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {dish.allergens.map((a) => (
                <li
                  key={a}
                  className="rounded-full border border-warn px-3 py-1 text-sm font-medium text-warn"
                >
                  {allergenLabel(t, a, ALLERGEN_LABEL[a])}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 font-display text-2xl font-semibold text-good">
            {t("dish.containsNone")}
          </p>
        )}

        {dish.needsLicence && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-thistle">
            {t("dish.licence")}
          </p>
        )}
      </section>

      {suits.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
            {t("dish.suits")}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {suits.map((s) => (
              <li
                key={s}
                className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-2"
              >
                {dietLabel(t, s, DIET_LABEL[s as keyof typeof DIET_LABEL] ?? s)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
          {t("dish.made")}
        </h2>
        <p className="mt-2 text-ink-2">{dish.keyIngredients}</p>
        <p className="mt-4 text-ink-2">{dish.fusion}</p>
        <p className="mt-3 text-sm">
          <span className="font-bold text-thistle">{dish.origin}</span>
          <span className="text-ink-3"> → </span>
          <span className="font-bold text-aji">{dish.subOrigin}</span>
        </p>
      </section>

      <p className="mt-8 border-t border-line pt-4 text-[13px] text-ink-3">
        {t("dish.readFromRecipe")}
      </p>
      <p className="mt-3 text-[13px] text-ink-3">{t("dish.notAnAudit")}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/carta"
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-bold hover:border-ink-3"
        >
          {t("dish.backToMenu")}
        </Link>
        <a
          href={WHATSAPP_HREF}
          className="rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-bg hover:opacity-90"
        >
          {t("pub.whatsapp")}
        </a>
      </div>
    </article>
  );
}
