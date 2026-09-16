"use client";

import { useMemo, useState } from "react";
import type { Dish, EventType, Flavour, ServiceFormat } from "@/lib/dishes";
import type { VisibleDish } from "@/lib/permissions";
import {
  CATEGORY_ORDER,
  FLAVOUR_AXES,
  FORMAT_LABEL,
  matchesEvent
} from "@/lib/dishes";
import { soles } from "@/lib/pricing";

interface Props {
  dishes: VisibleDish[];
  /**
   * Category names, already in the reader's language.
   *
   * Resolved on the server and handed over, because the copy book is a database
   * read and a client component cannot do one. Shipping the whole book to the
   * browser to translate seven words would be a strange trade.
   */
  categories: Record<string, string>;
  events: EventType[];
  flavours: Record<number, Flavour[]>;
}

export default function Finder({ dishes, events, flavours, categories }: Props) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Flavour[]>([]);
  /** "any" widens as you add flavours; "all" narrows. */
  const [mode, setMode] = useState<"any" | "all">("any");
  /** The second axis. Flavour alone answers "what tastes like this";
      flavour x format answers "what tastes like this AND can I serve it here". */
  const [formats, setFormats] = useState<ServiceFormat[]>([]);

  const activeEvent = events.find((e) => e.id === eventId) ?? null;

  const results = useMemo(() => {
    let out = dishes;
    if (activeEvent) out = out.filter((d) => matchesEvent(d, activeEvent.filter));
    if (picked.length > 0) {
      out = out.filter((d) => {
        const f = flavours[d.id] ?? [];
        return mode === "all"
          ? picked.every((p) => f.includes(p))
          : picked.some((p) => f.includes(p));
      });
    }
    if (formats.length > 0) out = out.filter((d) => formats.includes(d.format));
    return out;
  }, [dishes, activeEvent, picked, mode, flavours, formats]);

  // How many dishes each flavour would still yield, given the current event.
  const counts = useMemo(() => {
    let base = activeEvent
      ? dishes.filter((d) => matchesEvent(d, activeEvent.filter))
      : dishes;
    if (formats.length > 0) base = base.filter((d) => formats.includes(d.format));
    const c = {} as Record<Flavour, number>;
    for (const f of FLAVOUR_AXES) {
      c[f] = base.filter((d) => (flavours[d.id] ?? []).includes(f)).length;
    }
    return c;
  }, [dishes, activeEvent, flavours, formats]);

  const toggleFlavour = (f: Flavour) =>
    setPicked((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const formatCounts = useMemo(() => {
    const base = activeEvent
      ? dishes.filter((d) => matchesEvent(d, activeEvent.filter))
      : dishes;
    const c = {} as Record<ServiceFormat, number>;
    for (const f of Object.keys(FORMAT_LABEL) as ServiceFormat[]) {
      c[f] = base.filter((d) => d.format === f).length;
    }
    return c;
  }, [dishes, activeEvent]);

  const toggleFormat = (f: ServiceFormat) =>
    setFormats((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const clear = () => {
    setEventId(null);
    setPicked([]);
    setFormats([]);
  };

  const grouped = useMemo(() => {
    const g: Record<string, VisibleDish[]> = {};
    for (const d of results) (g[d.category] ??= []).push(d);
    return g;
  }, [results]);

  return (
    <div>
      <fieldset className="mb-8">
        <legend className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          What are you planning?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {events.map((e) => {
            const on = eventId === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setEventId(on ? null : e.id)}
                aria-pressed={on}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  on ? "border-aji bg-surface" : "border-line hover:border-ink-3"
                }`}
              >
                <span className="block text-sm font-bold leading-tight">{e.name}</span>
                <span className="mt-1 block text-xs text-ink-2">{e.blurb}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mb-8">
        <legend className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          Flavour compass
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          {FLAVOUR_AXES.map((f) => {
            const on = picked.includes(f);
            const n = counts[f];
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFlavour(f)}
                aria-pressed={on}
                disabled={n === 0 && !on}
                className={`rounded-full border px-4 py-2 text-sm capitalize disabled:cursor-not-allowed disabled:opacity-40 ${
                  on
                    ? "border-ink bg-ink font-bold text-bg"
                    : "border-line text-ink-2 hover:border-ink-3"
                }`}
              >
                {f}{" "}
                <span className={`tnum font-mono text-[11px] ${on ? "opacity-70" : "text-ink-3"}`}>
                  {n}
                </span>
              </button>
            );
          })}

          {picked.length > 1 && (
            <button
              type="button"
              onClick={() => setMode(mode === "any" ? "all" : "any")}
              className="rounded-full border border-line px-3 py-2 font-mono text-[11px] text-ink-2 hover:border-ink-3"
            >
              match: {mode === "any" ? "any" : "all"}
            </button>
          )}
        </div>
      </fieldset>

      <fieldset className="mb-8">
        <legend className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          Service format
        </legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FORMAT_LABEL) as ServiceFormat[]).map((f) => {
            const on = formats.includes(f);
            const n = formatCounts[f];
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFormat(f)}
                aria-pressed={on}
                disabled={n === 0 && !on}
                className={`rounded-full border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                  on
                    ? "border-ink bg-ink font-bold text-bg"
                    : "border-line text-ink-2 hover:border-ink-3"
                }`}
              >
                {FORMAT_LABEL[f]}{" "}
                <span className={`tnum font-mono text-[11px] ${on ? "opacity-70" : "text-ink-3"}`}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mb-6 flex flex-wrap items-baseline gap-3 border-t border-line pt-5">
        <p className="font-mono text-sm">
          <span className="tnum font-semibold">{results.length}</span>
          <span className="text-ink-2"> of {dishes.length} dishes</span>
        </p>
        {(activeEvent || picked.length > 0 || formats.length > 0) && (
          <button
            type="button"
            onClick={clear}
            className="font-mono text-[11px] text-ink-3 underline hover:text-ink"
          >
            clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-sm text-ink-2">
          Nothing matches that combination. Try switching the match mode to{" "}
          <strong>any</strong>, or drop a flavour.
        </p>
      ) : (
        CATEGORY_ORDER
          .filter((c) => grouped[c]?.length)
          .map((cat) => (
            <section key={cat} className="mb-8">
              <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {categories[cat] ?? cat} · {grouped[cat].length}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[cat].map((d) => (
                  <article key={d.id} className="rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-sm font-bold leading-tight">{d.name}</h4>
                      <span className="tnum shrink-0 font-mono text-xs text-ink-2">
                        {"price" in d ? soles(d.price) : null}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs">
                      <span className="font-bold text-thistle">{d.origin}</span>
                      <span className="text-ink-3"> → </span>
                      <span className="font-bold text-aji">{d.subOrigin}</span>
                    </p>
                    <p className="mt-2 flex flex-wrap gap-1">
                      {(flavours[d.id] ?? []).map((f) => (
                        <span
                          key={f}
                          className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] capitalize text-ink-3"
                        >
                          {f}
                        </span>
                      ))}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
