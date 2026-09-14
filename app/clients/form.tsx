"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addClient } from "./actions";
import { DIETS, DIET_LABEL } from "@/lib/dietary";
import { DISTRICTS } from "@/data/venues";

const field =
  "rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm focus:border-aji focus:outline-none";
const label = "font-mono text-[10px] uppercase tracking-wider text-ink-3";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={pending}
      className="mt-1 rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
    >
      {pending ? "Saving…" : "Add this client"}
    </button>
  );
}

export default function ClientForm() {
  const [error, action] = useActionState(addClient, undefined);

  return (
    <form action={action} className="h-fit rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-semibold tracking-tight">A new client</h2>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Name</span>
          <input name="name" required maxLength={120} className={field} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Email</span>
          <input name="contact" type="email" className={field} />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>Phone</span>
            <input name="phone" className={field} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>District</span>
            <select name="district" defaultValue="" className={field}>
              <option value="">—</option>
              {DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="min-w-0">
          <legend className={label}>What they cannot eat</legend>
          <p className="mt-1 text-[11px] text-ink-3">
            Recorded once. Every menu quoted for them is checked against this.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DIETS.map((d) => (
              <label
                key={d}
                className="cursor-pointer rounded border border-line px-2 py-1 text-[11px]
                           text-ink-2 has-[:checked]:border-thistle has-[:checked]:text-thistle"
              >
                <input type="checkbox" name="diets" value={d} className="sr-only" />
                {DIET_LABEL[d]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Notes</span>
          <textarea name="notes" rows={3} className={field} />
        </label>

        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Submit />
      </div>
    </form>
  );
}
