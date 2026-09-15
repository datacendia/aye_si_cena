"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateDish, resetDish } from "./actions";

const field =
  "w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm focus:border-aji focus:outline-none";
const tag = "font-mono text-[10px] uppercase tracking-wider text-ink-3";

export interface DishRow {
  id: number;
  /** As it shipped, so the form can show what is being changed from. */
  name: string;
  fusion: string;
  price: number;
  category: string;
  needsLicence: boolean;
  /** The override, if there is one. */
  edit: {
    name: string | null; nameEs: string | null;
    fusion: string | null; fusionEs: string | null;
    price: number | null; category: string | null; needsLicence: boolean | null;
  } | null;
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

export default function DishEditor({ row, categories, labels }: {
  row: DishRow;
  categories: { id: string; label: string }[];
  labels: {
    en: string; es: string; save: string; saved: string; revert: string;
    needsSpanish: string; derived: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updateDish.bind(null, row.id), undefined);
  const e = row.edit;
  const edited = Boolean(e);

  return (
    <div className="py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-baseline justify-between gap-3 text-left"
      >
        <span className="min-w-0 truncate text-sm">
          <span className={`${tag} mr-2`}>{row.id}</span>
          {e?.name ?? row.name}
          {edited && <span className="ml-2 font-mono text-[10px] text-aji">edited</span>}
        </span>
        <span className={tag}>{e?.category ?? row.category}</span>
      </button>

      {open && (
        <form action={action} className="mt-3 rounded-lg border border-line bg-bg/40 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={tag}>{labels.en}</span>
              <input name="name" defaultValue={e?.name ?? ""} placeholder={row.name} className={field} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={tag}>{labels.es}</span>
              <input name="nameEs" defaultValue={e?.nameEs ?? ""} className={field} />
            </label>

            <label className="flex flex-col gap-1 sm:col-span-1">
              <span className={tag}>{labels.en}</span>
              <textarea name="fusion" rows={3} defaultValue={e?.fusion ?? ""}
                placeholder={row.fusion} className={field} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-1">
              <span className={tag}>{labels.es}</span>
              <textarea name="fusionEs" rows={3} defaultValue={e?.fusionEs ?? ""} className={field} />
            </label>
          </div>

          <p className="mt-2 text-[11px] text-ink-3">{labels.needsSpanish}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className={tag}>S/</span>
              <input name="price" type="number" step="0.5" min="0.5"
                defaultValue={e?.price ?? ""} placeholder={String(row.price)} className={field} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={tag}>category</span>
              <select name="category" defaultValue={e?.category ?? ""} className={field}>
                <option value="">— {row.category} —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pt-5">
              {/*
                * The hidden field sends "false" when the box is unticked. Without
                * it an unticked box sends nothing, which is the same thing the
                * form sends for "I did not touch this" — so the licence could be
                * switched on and never off again.
                */}
              <input type="hidden" name="needsLicence" value="false" />
              <input name="needsLicence" type="checkbox" value="true"
                defaultChecked={e?.needsLicence ?? row.needsLicence} />
              <span className="text-sm text-ink-2">giro especial</span>
            </label>
          </div>

          {/*
            * Said out loud rather than silently absent. Somebody looking for the
            * allergen field should find the reason it is not here, not conclude
            * it was forgotten.
            */}
          <p className="mt-3 border-t border-line/60 pt-2 text-[11px] text-ink-3">
            {labels.derived}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <Submit label={labels.save} />
            {edited && (
              <button
                type="button" onClick={() => resetDish(row.id)}
                className="font-mono text-[10px] uppercase tracking-wider text-ink-3 hover:text-bad"
              >
                {labels.revert}
              </button>
            )}
            {state === "saved" && (
              <span className="font-mono text-[10px] uppercase text-good">{labels.saved}</span>
            )}
            {state && state !== "saved" && (
              <span role="alert" className="text-[11px] text-bad">{state}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
