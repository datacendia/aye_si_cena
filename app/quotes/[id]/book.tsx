"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { bookQuote } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={pending}
      className="rounded-md bg-good px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-60"
    >
      {pending ? "Booking…" : "Put it in the book"}
    </button>
  );
}

/**
 * Everything else the calendar needs is already on the quote — guests, tier,
 * district, venue, the dishes. The time is the only thing a quote cannot carry,
 * because it is agreed after the price is.
 */
export default function BookIt({ id, alreadyBooked }: { id: string; alreadyBooked: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, action] = useActionState(bookQuote.bind(null, id), undefined);

  if (alreadyBooked) {
    return (
      <p className="mt-4 border-t border-line pt-4 text-xs text-good">
        Already in the book.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-md border border-good px-3 py-2 text-sm
                   font-medium text-good hover:bg-good hover:text-bg"
      >
        Won it — put it in the book
      </button>
    );
  }

  return (
    <form action={action} className="mt-4 border-t border-line pt-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
        Guests, tier, district and the dishes come from the quote
      </p>
      <div className="mt-2 flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">Date</span>
          <input
            name="eventDate" type="date" required
            className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm
                       focus:border-aji focus:outline-none"
          />
        </label>
        <label className="flex w-24 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">On table</span>
          <input
            name="serviceMinutes" defaultValue="19:30" required
            className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm
                       focus:border-aji focus:outline-none"
          />
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <Submit />
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-3">
          not yet
        </button>
      </div>
    </form>
  );
}
