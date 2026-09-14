"use client";

import { useMemo, useState } from "react";
import type { Dish } from "@/lib/dishes";
import type { VisibleDish } from "@/lib/permissions";
import { buildIngredientGraph, orphanDishes, buyList } from "@/lib/graph";
import { soles } from "@/lib/pricing";

/**
 * Radial layout rather than a force simulation: with one ingredient per node
 * and a fixed dataset, physics adds jitter and no information. Node area
 * encodes how many dishes the ingredient unlocks.
 */
export default function Graph({ dishes }: { dishes: VisibleDish[] }) {
  const graph = useMemo(() => buildIngredientGraph(dishes), [dishes]);
  const top = useMemo(() => buyList(graph, 24), [graph]);
  const orphans = useMemo(() => orphanDishes(dishes, graph), [dishes, graph]);
  const [hover, setHover] = useState<string | null>(null);

  const size = 620;
  const cx = size / 2;
  const cy = size / 2;
  const maxReach = Math.max(...top.map((n) => n.dishes.length), 1);

  const nodes = top.map((n, i) => {
    const angle = (i / top.length) * Math.PI * 2 - Math.PI / 2;
    // One ring, uniform radius. Encoding reach in both size and distance
    // crowded the high-reach nodes into each other and read as noise.
    const radius = 205;
    return {
      ...n,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      // Area, not diameter, tracks reach — sqrt keeps big nodes honest.
      r: 6 + Math.sqrt(n.dishes.length / maxReach) * 16,
      // Labels sit outside the ring, pushed along their own radius.
      lx: cx + Math.cos(angle) * (radius + 34),
      ly: cy + Math.sin(angle) * (radius + 34),
      // Annotated, not inferred: React 19's SVG types narrowed textAnchor to
      // the four values SVG actually accepts, and a widened `string` no longer
      // fits. The annotation is the honest version of what this always was.
      anchor: (Math.cos(angle) > 0.25
        ? "start"
        : Math.cos(angle) < -0.25
          ? "end"
          : "middle") as "start" | "end" | "middle"
    };
  });

  const active = hover ? nodes.find((n) => n.name === hover) : null;

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[620px_1fr]">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            role="img"
            aria-label="Ingredients sized by how many dishes each unlocks"
            className="max-w-full"
          >
            {nodes.map((n) => (
              <line
                key={`l-${n.name}`}
                x1={cx}
                y1={cy}
                x2={n.x}
                y2={n.y}
                stroke="rgb(var(--line))"
                strokeWidth={hover === n.name ? 1.5 : 0.6}
              />
            ))}
            <circle cx={cx} cy={cy} r={26} fill="rgb(var(--raised))" stroke="rgb(var(--line))" />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              className="fill-ink-3 font-mono"
              fontSize="10"
            >
              {dishes.length}
            </text>
            {nodes.map((n) => (
              <g
                key={n.name}
                onMouseEnter={() => setHover(n.name)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={hover === n.name ? "rgb(var(--aji))" : "rgb(var(--surface))"}
                  stroke={hover === n.name ? "rgb(var(--aji))" : "rgb(var(--ink-3))"}
                  strokeWidth="1.2"
                />
                <text
                  x={n.lx}
                  y={n.ly + 3}
                  textAnchor={n.anchor}
                  fontSize="9.5"
                  className="fill-ink-2 font-mono"
                >
                  {n.name.length > 16 ? `${n.name.slice(0, 15)}…` : n.name}
                </text>
              </g>
            ))}
          </svg>
          <p className="mt-2 font-mono text-[11px] text-ink-3">
            {active
              ? `${active.name} · ${active.dishes.length} dishes · ${soles(active.value)} of menu`
              : "Node size and distance from centre both track reach. Hover for detail."}
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Buy these first
          </h2>
          <p className="mt-1.5 max-w-prose text-sm text-ink-2">
            Ranked by how much of the menu each one unlocks. The top of this list is your standing
            order; the bottom is what you buy for a specific booking.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[380px] border-collapse">
              <thead>
                <tr className="bg-raised">
                  <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-ink-3">
                    Ingredient
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-ink-3">
                    Dishes
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-ink-3">
                    Menu unlocked
                  </th>
                </tr>
              </thead>
              <tbody>
                {top.map((n) => (
                  <tr
                    key={n.name}
                    className="border-t border-line"
                    onMouseEnter={() => setHover(n.name)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <td className="px-3 py-2 text-sm capitalize">{n.name}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-sm">
                      {n.dishes.length}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-sm text-ink-2">
                      {soles(n.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Wastage liabilities · {orphans.length}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-2">
          Each of these is the only dish in the matrix using at least one ingredient. Cook one and
          you buy something nothing else will use up. That is fine for a signature; it is a poor
          reason to keep a dish nobody orders.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {orphans.slice(0, 18).map(({ dish, soleUseOf }) => (
            <div key={dish.id} className="rounded-lg border border-line p-3">
              <span className="block text-sm font-bold leading-tight">{dish.name}</span>
              <span className="mt-1 block font-mono text-[11px] text-warn">
                sole use of {soleUseOf.join(", ")}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
