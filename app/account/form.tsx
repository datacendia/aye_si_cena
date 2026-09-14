"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword } from "./actions";

const label = "font-mono text-[11px] uppercase tracking-wider text-ink-3";
const field = "rounded-md border border-line bg-bg px-3 py-2 text-sm focus:border-aji focus:outline-none";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" disabled={pending}
      className="mt-1 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-60"
    >
      {pending ? "…" : children}
    </button>
  );
}

export default function PasswordForm({ labels }: {
  labels: { current: string; next: string; confirm: string; change: string; changed: string; minimum: string }
}) {
  const [state, action] = useActionState(changePassword, undefined);

  return (
    <form action={action} className="mt-6 flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className={label}>{labels.current}</span>
        <input name="current" type="password" required autoComplete="current-password" className={field} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={label}>{labels.next}</span>
        <input
          name="next" type="password" required minLength={12}
          autoComplete="new-password" className={field}
        />
        <span className="text-[11px] text-ink-3">{labels.minimum}</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={label}>{labels.confirm}</span>
        <input
          name="confirm" type="password" required minLength={12}
          autoComplete="new-password" className={field}
        />
      </label>

      {state === "changed" && <p role="status" className="text-sm text-good">{labels.changed}</p>}
      {state && state !== "changed" && <p role="alert" className="text-sm text-bad">{state}</p>}

      <Submit>{labels.change}</Submit>
    </form>
  );
}
