"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ask, type Answer } from "./actions";

const field =
  "w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm focus:border-aji focus:outline-none";
const tag = "font-mono text-[10px] uppercase tracking-wider text-ink-3";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={pending}
      className="mt-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

export interface Option { id: string; name: string }

export default function TakeForm({ tiers, districts, venues, today, labels }: {
  tiers: Option[]; districts: Option[]; venues: Option[]; today: string;
  labels: Record<string, string>;
}) {
  const [answer, action] = useActionState<Answer | undefined, FormData>(ask, undefined);

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <form action={action} className="h-fit rounded-xl border border-line bg-surface p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={tag}>{labels.date}</span>
            <input name="date" type="date" required defaultValue={today} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={tag}>{labels.time}</span>
            <input name="time" type="time" required defaultValue="19:00" className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={tag}>{labels.hours}</span>
            <input name="hours" type="number" step="0.5" min="0.5" max="12"
              required defaultValue={3} className={`tnum ${field}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={tag}>{labels.guests}</span>
            <input name="guests" type="number" min="1" max="500"
              required defaultValue={60} className={`tnum ${field}`} />
          </label>
        </div>

        <div className="mt-3 grid gap-3">
          <label className="flex flex-col gap-1">
            <span className={tag}>{labels.tier}</span>
            <select name="tier" defaultValue={tiers[0]?.id} className={field}>
              {tiers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={tag}>{labels.district}</span>
            <select name="district" defaultValue="san-isidro" className={field}>
              {districts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={tag}>{labels.venue}</span>
            <select name="venue" defaultValue="hotel" className={field}>
              {venues.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="mt-5 border-t border-line pt-4">
          <legend className={tag}>{labels.kit}</legend>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {([
              ["planchas", labels.planchas, 1],
              ["fryers", labels.fryers, 1],
              ["ovens", labels.ovens, 1],
              ["vans", labels.vans, 1],
              ["crew", labels.crew, 4]
            ] as const).map(([name, label, value]) => (
              <label key={name} className="flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-ink-3">
                  {label}
                </span>
                <input
                  name={name} type="number" min={name === "crew" ? 1 : 0} max={name === "crew" ? 60 : 20}
                  defaultValue={value}
                  className="tnum w-full rounded-md border border-line bg-bg px-1.5 py-1 text-sm"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <Submit label={labels.ask} />
      </form>

      <div aria-live="polite">
        {answer === undefined ? (
          <p className="text-sm text-ink-3">{labels.lede}</p>
        ) : answer.ok === null ? (
          <p role="alert" className="text-sm text-warn">{answer.why}</p>
        ) : (
          <div
            className={`rounded-xl border p-6 ${
              answer.ok ? "border-good bg-good/5" : "border-bad bg-bad/5"
            }`}
          >
            <p
              className={`font-display text-3xl font-semibold tracking-tight ${
                answer.ok ? "text-good" : "text-bad"
              }`}
            >
              {answer.ok ? labels.yes : labels.no}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {answer.against === 0
                ? labels.alone
                : `${labels.against} ${answer.against}`}
            </p>

            {answer.clashes.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm text-ink-2">
                {answer.clashes.map((c, i) => (
                  <li key={i}>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-bad">
                      {c.kind}
                    </span>{" "}
                    {c.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
