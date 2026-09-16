"use client";

import { useRouter } from "next/navigation";
import { rowRuns, type Label, type QrMatrix } from "@/lib/labels";

/**
 * The code, drawn as real SVG elements.
 *
 * No dangerouslySetInnerHTML: the library will hand back a finished SVG string
 * and taking it would put the first one of those in this repository, on a page
 * that prints. Drawing from the matrix costs ten lines, escapes nothing because
 * there is nothing to escape, and prints identically.
 *
 * shapeRendering="crispEdges" matters more than it looks — antialiased module
 * edges are exactly what a cheap scanner in a badly-lit function room fails on.
 */
function Qr({ matrix, title }: { matrix: QrMatrix; title: string }) {
  const quiet = 2;
  const span = matrix.size + quiet * 2;

  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      className="h-auto w-full"
    >
      <rect width={span} height={span} fill="#fff" />
      {Array.from({ length: matrix.size }, (_, y) =>
        rowRuns(matrix, y).map(([x, run]) => (
          <rect
            key={`${y}-${x}`}
            x={x + quiet}
            y={y + quiet}
            width={run}
            height={1}
            fill="#000"
          />
        ))
      )}
    </svg>
  );
}

/**
 * The sheet itself.
 *
 * Laid out in millimetres rather than rem, because this is the one screen in
 * the app whose output is physical. 65×45mm is a common sticker size in Lima
 * and fits 3×6 to an A4 sheet; @page sets the margins so the browser's own
 * headers do not push the grid off the second page.
 *
 * Everything but the grid carries `print:hidden` — a printed sheet with a
 * navigation bar across the top of it wastes the first row of stickers.
 */
export default function Sheet({
  labels, bookings, selected, baseMissing, labelsText
}: {
  labels: Label[];
  bookings: { id: string; label: string }[];
  selected: string;
  /** True when AUTH_URL is unset, so every code would point at nowhere. */
  baseMissing: boolean;
  labelsText: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          .print\\:hidden { display: none !important; }
          .sheet { gap: 0 !important; }
          .label { break-inside: avoid; border-color: #bbb !important; }
        }
      `}</style>

      <section className="border-b border-line py-12 print:hidden">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {labelsText.heading}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">{labelsText.lede}</p>

        {baseMissing && (
          <p role="alert" className="mt-4 rounded-lg border border-bad bg-bad/5 p-3 text-sm text-bad">
            AUTH_URL is not set, so every code below points at nothing. Set it
            before printing anything.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {labelsText.forEvent}
            </span>
            <select
              value={selected}
              onChange={(e) =>
                router.push(e.target.value ? `/labels?booking=${e.target.value}` : "/labels")
              }
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">{labelsText.wholeMenu}</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90"
          >
            {labelsText.print} · {labels.length}
          </button>
        </div>
      </section>

      <div className="sheet mt-8 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(65mm,1fr))]">
        {labels.map((l) => (
          <div
            key={l.dishId}
            className="label flex gap-3 rounded border border-line bg-surface p-2.5"
            style={{ minHeight: "45mm" }}
          >
            <div className="flex w-[22mm] shrink-0 flex-col items-center">
              <Qr matrix={l.qr} title={`${labelsText.scanToRead}: ${l.name}`} />
              <span className="mt-1 text-center font-mono text-[6px] uppercase leading-tight tracking-wider text-ink-3">
                {labelsText.scanToRead}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-display text-[11px] font-semibold leading-tight">{l.name}</p>

              {l.allergens.length > 0 ? (
                <p className="mt-1.5 text-[8px] font-bold uppercase leading-snug tracking-wide text-warn">
                  {labelsText.contains}: {l.allergens.join(" · ")}
                </p>
              ) : (
                <p className="mt-1.5 text-[8px] font-bold uppercase leading-snug tracking-wide text-good">
                  {labelsText.containsNone}
                </p>
              )}

              {l.suits.length > 0 && (
                <p className="mt-1 text-[7px] uppercase leading-snug tracking-wide text-ink-3">
                  {l.suits.slice(0, 5).join(" · ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
