import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getClient } from "@/lib/repo/clients";
import { listQuotes } from "@/lib/repo/quotes";
import { CAN } from "@/lib/permissions";
import { DIET_LABEL, DIET_NOTE, type Diet } from "@/lib/dietary";
import { soles } from "@/lib/pricing";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireViewer();
  const { id } = await params;
  const client = await getClient(me, id);
  if (!client) notFound();

  const quotes = (await listQuotes(me)).filter((q) => q.clientId === client.id);
  const money = CAN.seeMoney(me.role);

  return (
    <>
      <section className="border-b border-line py-12">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          {CAN.seeAllClients(me.role) ? (
            <Link href="/clients" className="hover:text-ink">Clients</Link>
          ) : "Your details"}
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{client.name}</h1>
        <p className="mt-4 text-ink-2">
          {[client.contact, client.phone, client.district].filter(Boolean).join(" · ") || "—"}
        </p>
      </section>

      <section className="grid gap-10 py-10 md:grid-cols-[1fr_320px]">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Quotes · {quotes.length}
          </h2>
          {quotes.length === 0 ? (
            <p className="mt-3 text-sm text-ink-2">Nothing quoted for them yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line/60">
              {quotes.map((q) => (
                <li key={q.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                  <Link href={`/quotes/${q.id}`} className="font-medium hover:text-aji">
                    {q.name}
                  </Link>
                  <span className="font-mono text-sm tabular-nums text-ink-2">
                    {q.guests} guests · {soles(q.grossTotal)}
                    <span className="ml-2 text-[11px] uppercase text-ink-3">{q.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {client.notes && (
            <div className="mt-8 rounded-lg border border-line bg-surface p-4">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{client.notes}</p>
            </div>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-semibold tracking-tight">What they cannot eat</h2>
          {client.diets.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">
              Nothing recorded. Anything noted here is checked against every menu quoted
              for them from then on.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {client.diets.map((d) => (
                <li key={d}>
                  <span
                    className="rounded border border-thistle px-1.5 py-0.5 font-mono
                               text-[10px] uppercase tracking-wider text-thistle"
                  >
                    {DIET_LABEL[d as Diet] ?? d}
                  </span>
                  <p className="mt-1.5 text-xs text-ink-2">{DIET_NOTE[d as Diet]}</p>
                </li>
              ))}
            </ul>
          )}
          {money && client.hasLogin && (
            <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">
              This client has a login. They see their own quotes and nothing else — no costs,
              no other client.
            </p>
          )}
        </aside>
      </section>
    </>
  );
}
