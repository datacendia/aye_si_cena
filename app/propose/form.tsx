"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { askForMenu, type ProposeResult } from "./actions";
import { REASON_LABEL, CONSTRAINT_LABEL } from "@/lib/propose";

const field =
  "w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm focus:border-aji focus:outline-none";
const tag = "font-mono text-[10px] uppercase tracking-wider text-ink-3";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={pending}
      className="mt-3 w-full rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg
                 disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

export interface ClientOption { id: string; name: string }

export default function ProposeForm({ clients, months, equipment, thisMonth, es, labels }: {
  clients: ClientOption[];
  months: string[];
  equipment: string[];
  thisMonth: number;
  es: boolean;
  labels: Record<string, string>;
}) {
  const [result, action] = useActionState<ProposeResult | undefined, FormData>(
    askForMenu, undefined
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <form action={action} className="h-fit rounded-xl border border-line bg-surface p-5">
        <label className="flex flex-col gap-1">
          <span className={tag}>{labels.month}</span>
          <select name="month" defaultValue={thisMonth} className={field}>
            {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className={tag}>{labels.client}</span>
          <select name="clientId" defaultValue="" className={field}>
            <option value="">{labels.noClient}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className={tag}>{labels.dishes}</span>
          <input name="want" type="number" min="1" max="40" defaultValue={8}
            className={`tnum ${field}`} />
        </label>

        <fieldset className="mt-4 border-t border-line pt-3">
          <legend className={tag}>{labels.kit}</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {equipment.map((e) => (
              <label
                key={e}
                className="cursor-pointer rounded border border-line px-2 py-1 text-[11px]
                           text-ink-2 has-[:checked]:border-thistle has-[:checked]:text-thistle"
              >
                <input type="checkbox" name="equipment" value={e} defaultChecked className="sr-only" />
                {e}
              </label>
            ))}
          </div>
        </fieldset>

        <Submit label={labels.go} />
        <p className="mt-3 text-[11px] text-ink-3">{labels.draft}</p>
      </form>

      <div aria-live="polite">
        {result === undefined ? (
          <p className="text-sm text-ink-3">{labels.lede}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {months[result.month - 1]}
                {result.clientName && ` · ${result.clientName}`}
              </h2>
              <span className="tnum font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {(result.proposal.britishShare * 100).toFixed(0)}% {labels.british}
              </span>
              {result.diets.length > 0 && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-thistle">
                  {labels.diets}: {result.diets.join(", ")}
                </span>
              )}
            </div>

            {result.proposal.compromise && (
              <p role="status" className="mt-3 rounded-lg border border-warn bg-warn/5 p-3
                                          text-sm text-ink-2">
                {result.proposal.compromise}
              </p>
            )}

            <ol className="mt-5 divide-y divide-line/60">
              {result.proposal.menu.map((m) => (
                <li key={m.dish.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                  <span className="min-w-0 flex-1 text-sm">{m.dish.name}</span>
                  <span className="tnum font-mono text-[11px] text-ink-3">
                    {(m.foodCost * 100).toFixed(0)}% {labels.foodCost}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {m.reasons.map((r) => (
                      <span
                        key={r}
                        className="rounded border border-line px-1.5 py-0.5 font-mono
                                   text-[10px] uppercase tracking-wider text-ink-3"
                      >
                        {es ? REASON_LABEL[r].es : REASON_LABEL[r].en}
                      </span>
                    ))}
                  </span>
                  {m.peaking.length > 0 && (
                    <span className="w-full font-mono text-[10px] text-aji">
                      {m.peaking.join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ol>

            {result.proposal.rejected.length > 0 && (
              <div className="mt-10 border-t border-line pt-6">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {labels.rejected}
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-ink-2">{labels.rejectedLede}</p>

                {result.proposal.rejected.map((group) => (
                  <div key={group.constraint} className="mt-5">
                    <h4 className={tag}>
                      {es ? CONSTRAINT_LABEL[group.constraint].es
                          : CONSTRAINT_LABEL[group.constraint].en}
                      {" · "}{group.dishes.length}
                    </h4>
                    <ul className="mt-1.5 space-y-0.5 text-sm text-ink-3">
                      {group.dishes.slice(0, 8).map((d) => (
                        <li key={d.id}>
                          {d.name} — {d.because}
                        </li>
                      ))}
                      {group.dishes.length > 8 && (
                        <li className="font-mono text-[10px] uppercase tracking-wider">
                          +{group.dishes.length - 8}
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
