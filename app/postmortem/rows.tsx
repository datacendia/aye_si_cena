"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveActuals, shareBooking, unshareBooking } from "./actions";

const field =
  "w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm focus:border-aji focus:outline-none";
const tag = "font-mono text-[10px] uppercase tracking-wider text-ink-3";

export interface Row {
  bookingId: string;
  when: string;
  name: string;
  guestsQuoted: number;
  guestsServed: number | null;
  quotedNet: number | null;
  spentTotal: number | null;
  contribution: number | null;
  quotedFoodCostRatio: number | null;
  actualFoodCostRatio: number | null;
  foodCostGap: number | null;
  recorded: boolean;
  shared: boolean;
  spent: {
    food: number | null; staff: number | null; transport: number | null; other: number | null;
  };
  note: string | null;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={pending}
      className="rounded-md border border-line px-3 py-1 font-mono text-[11px] uppercase
                 tracking-wider text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(0)}%`);
const money = (n: number | null) => (n === null ? "—" : `S/ ${n.toFixed(0)}`);

export default function Rows({ rows, labels }: { rows: Row[]; labels: Record<string, string> }) {
  return (
    <div className="divide-y divide-line/60">
      {rows.map((r) => <Line key={r.bookingId} row={r} labels={labels} />)}
    </div>
  );
}

function Line({ row, labels }: { row: Row; labels: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [state, action] = useActionState(saveActuals.bind(null, row.bookingId), undefined);

  /*
   * The gap, not the ratio, is what gets the colour.
   *
   * A 34% food cost is fine on a job quoted at 34% and a disaster on one quoted
   * at 25%. Colouring the absolute number would flag the wrong events.
   */
  const gap = row.foodCostGap;
  const tone = gap === null ? "text-ink-3" : gap > 0.03 ? "text-bad" : gap < -0.03 ? "text-good" : "text-ink-2";

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className={`${tag} mr-2`}>{row.when}</span>
          {row.name}
          {row.guestsServed !== null && row.guestsServed !== row.guestsQuoted && (
            <span className="ml-2 font-mono text-[10px] text-warn">
              {row.guestsServed} {labels.servedNot} {row.guestsQuoted}
            </span>
          )}
        </span>

        {row.recorded ? (
          <span className="flex shrink-0 items-baseline gap-4 font-mono text-[11px]">
            <span className="tnum text-ink-3">{money(row.quotedNet)}</span>
            <span className="tnum text-ink-2">−{money(row.spentTotal)?.replace("S/ ", "")}</span>
            <span className="tnum font-semibold text-ink">{money(row.contribution)}</span>
            <span className={`tnum ${tone}`}>
              {pct(row.actualFoodCostRatio)}
              {gap !== null && (
                <span className="ml-1">
                  ({gap > 0 ? "+" : ""}{(gap * 100).toFixed(0)})
                </span>
              )}
            </span>
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-warn">
            {labels.notRecorded}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-line bg-bg/40 p-3">
          <form action={action} className="grid gap-2 sm:grid-cols-5">
            {([
              ["foodSpend", labels.food, row.spent.food],
              ["staffSpend", labels.staff, row.spent.staff],
              ["transportSpend", labels.transport, row.spent.transport],
              ["otherSpend", labels.other, row.spent.other],
              ["guestsServed", labels.served, row.guestsServed]
            ] as const).map(([name, label, value]) => (
              <label key={name} className="flex flex-col gap-1">
                <span className={tag}>{label}</span>
                <input
                  name={name} type="number" step="0.01" min="0"
                  defaultValue={value ?? ""}
                  placeholder={name === "guestsServed" ? String(row.guestsQuoted) : "—"}
                  className={`tnum ${field}`}
                />
              </label>
            ))}

            <label className="flex flex-col gap-1 sm:col-span-4">
              <span className={tag}>{labels.note}</span>
              <input name="note" defaultValue={row.note ?? ""} className={field} />
            </label>

            <div className="flex items-end gap-3">
              <Submit label={labels.record} />
              {state === "saved" && (
                <span className="font-mono text-[10px] uppercase text-good">{labels.saved}</span>
              )}
              {state && state !== "saved" && (
                <span role="alert" className="text-[11px] text-bad">{state}</span>
              )}
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <button
              type="button"
              onClick={async () => {
                const out = await shareBooking(row.bookingId);
                setLink(typeof out === "string" ? out : out.url);
              }}
              className="text-sm text-thistle hover:underline"
            >
              {labels.share}
            </button>
            {row.shared && (
              <button
                type="button"
                onClick={() => unshareBooking(row.bookingId)}
                className="text-sm text-bad hover:underline"
              >
                {labels.revoke}
              </button>
            )}
            {link && (
              <p className="w-full rounded border border-thistle/40 bg-thistle/5 p-2">
                <span className="block text-[11px] text-ink-2">{labels.copyOnce}</span>
                <code className="mt-1 block break-all font-mono text-[11px]">{link}</code>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
