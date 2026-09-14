"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addBooking } from "./actions";
import { DISTRICTS, VENUE_TYPES } from "@/data/venues";
import { TIERS } from "@/lib/pricing";

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
      {pending ? "Saving…" : "Put it in the book"}
    </button>
  );
}

export default function BookingForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [error, action] = useActionState(addBooking, undefined);

  return (
    <form action={action} className="h-fit rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-semibold tracking-tight">A job to take</h2>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>Date</span>
            <input name="eventDate" type="date" required className={field} />
          </label>
          <label className="flex w-28 flex-col gap-1.5">
            <span className={label}>On the table</span>
            <input name="serviceMinutes" defaultValue="19:30" required className={field} />
          </label>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>Guests</span>
            <input name="guests" type="number" min="1" defaultValue="60" required className={field} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>Tier</span>
            <select name="tier" defaultValue="buffet" className={field}>
              {Object.entries(TIERS).map(([id, t]) => (
                <option key={id} value={id}>{t.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>District</span>
            <select name="district" defaultValue="san-isidro" className={field}>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={label}>Venue</span>
            <select name="venue" defaultValue="hotel" className={field}>
              {VENUE_TYPES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
        </div>

        {clients.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className={label}>Client</span>
            <select name="clientId" defaultValue="" className={field}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className={label}>Notes</span>
          <input name="notes" className={field} />
        </label>

        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Submit />
      </div>
    </form>
  );
}
