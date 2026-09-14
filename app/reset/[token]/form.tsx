"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setNewPassword } from "./actions";

const label = "font-mono text-[11px] uppercase tracking-wider text-ink-3";
const field = "rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-aji focus:outline-none";

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

export default function ResetForm({ token, labels }: {
  token: string;
  labels: { next: string; confirm: string; set: string; minimum: string };
}) {
  const [error, action] = useActionState(setNewPassword.bind(null, token), undefined);

  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className={label}>{labels.next}</span>
        <input
          name="next" type="password" required minLength={12}
          autoComplete="new-password" autoFocus className={field}
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

      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <Submit>{labels.set}</Submit>
    </form>
  );
}
