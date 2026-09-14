"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { savePrice } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={pending}
      className="mt-1 rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
    >
      {pending ? "Saving…" : "Record this price"}
    </button>
  );
}

const field = "rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-aji focus:outline-none";
const label = "font-mono text-[10px] uppercase tracking-wider text-ink-3";

export default function PriceForm() {
  const [error, action] = useActionState(savePrice, undefined);

  return (
    <form action={action} className="h-fit rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-semibold tracking-tight">Just back from the market</h2>
      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Ingredient</span>
          <input name="ingredientKey" required placeholder="butter" className={field} />
          <span className="text-[11px] text-ink-3">
            As the shopping list names it, lower case.
          </span>
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>Soles</span>
            <input name="soles" type="number" step="0.01" min="0.01" required className={field} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>Per</span>
            <select name="per" defaultValue="kg" className={field}>
              <option value="kg">kg</option>
              <option value="L">litre</option>
              <option value="each">each</option>
              <option value="bunch">bunch</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Where</span>
          <input name="source" placeholder="Surquillo N.1" className={field} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Note</span>
          <input name="note" placeholder="roe on, ask for Rosa" className={field} />
        </label>

        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Submit />
      </div>
    </form>
  );
}
