"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCopy, resetCopy } from "./actions";

const field =
  "w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm focus:border-aji focus:outline-none";

function Submit({ label, saved }: { label: string; saved: string }) {
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

export default function CopyEditor({
  row, labels
}: {
  row: { key: string; en: string; es: string; edited: boolean };
  labels: { en: string; es: string; save: string; saved: string; revert: string };
}) {
  const [state, action] = useActionState(updateCopy.bind(null, row.key), undefined);
  const ok = state === "saved";

  return (
    <form action={action} className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <code className="font-mono text-[11px] text-ink-3">{row.key}</code>
        <span className="flex items-center gap-3">
          {row.edited && (
            <button
              type="button" formAction={() => resetCopy(row.key)}
              className="font-mono text-[10px] uppercase tracking-wider text-ink-3 hover:text-bad"
            >
              {labels.revert}
            </button>
          )}
          {ok && <span className="font-mono text-[10px] uppercase text-good">{labels.saved}</span>}
          <Submit label={labels.save} saved={labels.saved} />
        </span>
      </div>

      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
            {labels.en}
          </span>
          <textarea name="en" defaultValue={row.en} rows={2} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
            {labels.es}
          </span>
          <textarea name="es" defaultValue={row.es} rows={2} required className={field} />
        </label>
      </div>

      {state && state !== "saved" && (
        <p role="alert" className="mt-1.5 text-sm text-bad">{state}</p>
      )}
    </form>
  );
}
