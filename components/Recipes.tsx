"use client";

import { useMemo, useState } from "react";
import type { Dish, Recipe } from "@/lib/dishes";
import type { KitchenDish } from "@/lib/permissions";
import { FORMAT_LABEL } from "@/lib/dishes";

export default function Recipes({
  dishes,
  recipes,
  categories
}: {
  dishes: KitchenDish[];
  recipes: Recipe[];
  categories: Record<string, string>;
}) {
  const byId = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes]);
  const written = useMemo(
    () => recipes.slice().sort((a, b) => a.dishId - b.dishId),
    [recipes]
  );
  const [openId, setOpenId] = useState<number | null>(written[0]?.dishId ?? null);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return written;
    return written.filter((r) => {
      const d = byId.get(r.dishId);
      const hay = [
        d?.name,
        d?.origin,
        ...r.ingredients.map((i) => i.item)
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [written, q, byId]);

  const open = written.find((r) => r.dishId === openId) ?? null;
  const openDish = open ? byId.get(open.dishId) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      {/* index */}
      <div>
        <label htmlFor="recipe-search" className="sr-only">
          Search dish or ingredient
        </label>
        <input
          id="recipe-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dish or ingredient…"
          className="mb-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <p className="mb-3 font-mono text-[11px] text-ink-3">
          <span className="tnum">{written.length}</span> of{" "}
          <span className="tnum">{dishes.length}</span> written
        </p>
        <ol className="space-y-1">
          {shown.map((r) => {
            const d = byId.get(r.dishId);
            const on = r.dishId === openId;
            return (
              <li key={r.dishId}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.dishId)}
                  aria-pressed={on}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    on ? "border-aji bg-surface font-bold" : "border-transparent hover:bg-surface"
                  }`}
                >
                  <span className="tnum mr-2 font-mono text-[11px] text-ink-3">
                    {String(r.dishId).padStart(3, "0")}
                  </span>
                  {d?.name}
                </button>
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-2">Nothing matches that.</li>
          )}
        </ol>
      </div>

      {/* the recipe */}
      {open && openDish && (
        <article>
          <header className="border-b border-line pb-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {categories[openDish.category] ?? openDish.category} · {FORMAT_LABEL[openDish.format]} ·{" "}
              {openDish.subOrigin}
            </p>
            <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">
              {openDish.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-2">{openDish.fusion}</p>
            <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-2 font-mono text-xs">
              <div>
                <dt className="inline text-ink-3">Yield </dt>
                <dd className="inline font-semibold">{open.yields}</dd>
              </div>
              <div>
                <dt className="inline text-ink-3">Hands-on </dt>
                <dd className="tnum inline font-semibold">{open.prepMin} min</dd>
              </div>
              <div>
                <dt className="inline text-ink-3">Cook </dt>
                <dd className="tnum inline font-semibold">{open.cookMin} min</dd>
              </div>
            </dl>
          </header>

          <div className="grid gap-8 py-6 md:grid-cols-[minmax(220px,280px)_1fr]">
            <section>
              <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                Ingredients
              </h3>
              <ul className="space-y-2.5">
                {open.ingredients.map((ing) => (
                  <li key={ing.item} className="text-sm">
                    <span className="tnum mr-2 font-mono text-xs font-semibold text-aji">
                      {ing.qty}
                    </span>
                    {ing.item}
                    {ing.note && (
                      <span className="mt-0.5 block text-xs text-ink-3">{ing.note}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                Method
              </h3>
              <ol className="space-y-3">
                {open.method.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed">
                    <span className="tnum shrink-0 font-mono text-xs font-semibold text-ink-3">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
            <div className="rounded-lg border-l-2 border-good bg-surface p-3.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-good">
                Make ahead
              </p>
              <p className="mt-1 text-sm text-ink-2">{open.makeAhead}</p>
            </div>
            <div className="rounded-lg border-l-2 border-warn bg-surface p-3.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-warn">
                How it holds
              </p>
              <p className="mt-1 text-sm text-ink-2">{open.holds}</p>
            </div>
            {open.scaling && (
              <div className="rounded-lg border-l-2 border-thistle bg-surface p-3.5 sm:col-span-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-thistle">
                  Scaling up
                </p>
                <p className="mt-1 text-sm text-ink-2">{open.scaling}</p>
              </div>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
