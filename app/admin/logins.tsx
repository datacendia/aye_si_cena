"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { issueResetLink, toggleAccount } from "./actions";

export interface LoginRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  hasPassword: boolean;
  isMe: boolean;
}

function Pending({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : children}</>;
}

/**
 * The link is shown once and never again.
 *
 * It is held in component state rather than written anywhere, because a reset
 * link sitting in a page that can be refreshed, or in a row somebody can read
 * later, is a password waiting to be taken. Only its SHA-256 reached the
 * database; this is the only moment the token itself exists outside the
 * browser that will use it.
 */
export default function Logins({ rows, labels }: {
  rows: LoginRow[];
  labels: {
    issue: string; issued: string; off: string; on: string;
    accountOff: string; noPassword: string;
  };
}) {
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [error, issue] = useActionState(
    async (_prev: string | undefined, form: FormData) => {
      const id = String(form.get("userId"));
      const result = await issueResetLink(id);
      if (typeof result === "string") return result;
      setLink({ id, url: result.url });
      return undefined;
    },
    undefined
  );

  return (
    <div className="mt-6 divide-y divide-line/60">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              {r.name ?? r.email}
              <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {r.role}
              </span>
              {!r.active && (
                <span className="ml-2 font-mono text-[11px] text-bad">{labels.accountOff}</span>
              )}
              {!r.hasPassword && (
                <span className="ml-2 font-mono text-[11px] text-warn">{labels.noPassword}</span>
              )}
            </p>
            {r.name && <p className="truncate font-mono text-[11px] text-ink-3">{r.email}</p>}
          </div>

          <form action={issue} className="flex items-center">
            <input type="hidden" name="userId" value={r.id} />
            <button type="submit" className="text-sm text-thistle hover:underline">
              <Pending>{labels.issue}</Pending>
            </button>
          </form>

          {!r.isMe && (
            <form action={toggleAccount.bind(null, r.id, !r.active)} className="flex items-center">
              <button
                type="submit"
                className={r.active ? "text-sm text-bad hover:underline" : "text-sm text-good hover:underline"}
              >
                <Pending>{r.active ? labels.off : labels.on}</Pending>
              </button>
            </form>
          )}

          {link?.id === r.id && (
            <div className="w-full rounded-lg border border-thistle/40 bg-thistle/5 p-3">
              <p className="mb-2 text-[11px] text-ink-2">{labels.issued}</p>
              <code className="block break-all font-mono text-[11px] text-ink">{link.url}</code>
            </div>
          )}
        </div>
      ))}

      {error && <p role="alert" className="py-3 text-sm text-bad">{error}</p>}
    </div>
  );
}
