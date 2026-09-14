"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg
                 disabled:opacity-60"
    >
      {pending ? "Checking…" : "Sign in"}
    </button>
  );
}

export default function LoginForm({ next }: { next: string }) {
  const [error, action] = useActionState(login, undefined);

  return (
    <form action={action} className="mt-7 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-3">Email</span>
        <input
          name="email" type="email" required autoComplete="email" autoFocus
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink
                     focus:border-aji focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-3">Password</span>
        <input
          name="password" type="password" required autoComplete="current-password"
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink
                     focus:border-aji focus:outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-bad">{error}</p>
      )}

      <Submit />
    </form>
  );
}
