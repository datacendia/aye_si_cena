"use client";

import { useMemo, useState } from "react";
import type { PublicDish } from "@/lib/public";
import type { Category } from "@/lib/dishes";

/** Strip accents so "lucuma" finds "lúcuma". Same rule as the standalone. */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface Option { id: string; label: string }

export default function MenuBrowser({
  dishes, categories, allergens, diets, dietsByDish, labels
}: {
  dishes: PublicDish[];
  categories: Option[];
  /** Allergen names in the reader's language, resolved on the server. */
  allergens: Record<string, string>;
  diets: Option[];
  dietsByDish: Record<number, string[]>;
  labels: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [needed, setNeeded] = useState<string[]>([]);

  const shown = useMemo(() => {
    const needle = fold(q.trim());
    return dishes.filter((d) => {
      if (category && d.category !== category) return false;
      if (needed.length > 0) {
        const suits = dietsByDish[d.id] ?? [];
        if (!needed.every((n) => suits.includes(n))) return false;
      }
      if (!needle) return true;
      return (
        fold(d.name).includes(needle) ||
        fold(d.fusion).includes(needle) ||
        fold(d.keyIngredients).includes(needle) ||
        fold(d.origin).includes(needle)
      );
    });
  }, [dishes, q, category, needed, dietsByDish]);

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const chip =
    "cursor-pointer rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 " +
    "hover:border-ink-3 has-[:checked]:border-aji has-[:checked]:bg-aji/10 has-[:checked]:text-ink";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="carta-search"
            className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-3"
          >
            {labels.search}
          </label>
          <input
            id="carta-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.searchHint}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm
                       focus:border-aji focus:outline-none"
          />
        </div>
        <p
          aria-live="polite"
          className="tnum pb-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-3"
        >
          {shown.length} {labels.of} {dishes.length}
        </p>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          {labels.course}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <label key={c.id} className={chip}>
              <input
                type="radio" name="category" className="sr-only"
                checked={category === c.id}
                onChange={() => setCategory(category === c.id ? null : (c.id as Category))}
                onClick={() => category === c.id && setCategory(null)}
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          {labels.diets}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {diets.map((d) => (
            <label key={d.id} className={chip}>
              <input
                type="checkbox" className="sr-only"
                checked={needed.includes(d.id)}
                onChange={() => setNeeded((n) => toggle(n, d.id))}
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      {(q || category || needed.length > 0) && (
        <button
          type="button"
          onClick={() => { setQ(""); setCategory(null); setNeeded([]); }}
          className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-3
                     underline hover:text-ink"
        >
          {labels.clear}
        </button>
      )}

      {shown.length === 0 ? (
        <p className="mt-10 text-ink-2">{labels.nothing}</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => {
            const suits = dietsByDish[d.id] ?? [];
            return (
              <article key={d.id} className="rounded-xl border border-line bg-surface p-5">
                <h3 className="font-display text-lg font-semibold leading-tight">{d.name}</h3>
                <p className="mt-2 text-sm text-ink-2">{d.fusion}</p>
                <p className="mt-3 text-xs">
                  <span className="font-bold text-thistle">{d.origin}</span>
                  <span className="text-ink-3"> → </span>
                  <span className="font-bold text-aji">{d.subOrigin}</span>
                </p>

                {d.allergens.length > 0 ? (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-warn">
                    {labels.contains}: {d.allergens.map((a) => allergens[a] ?? a).join(" · ")}
                  </p>
                ) : (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-good">
                    {labels.noneOfThe14}
                  </p>
                )}

                {suits.length > 0 && (
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">
                    {diets.filter((x) => suits.includes(x.id)).map((x) => x.label).join(" · ")}
                  </p>
                )}

                {d.needsLicence && (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-thistle">
                    {labels.licence}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
