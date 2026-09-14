import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getQuote } from "@/lib/repo/quotes";
import { CAN, visibleDishes } from "@/lib/permissions";
import { soles, TIERS, IGV_RATE } from "@/lib/pricing";
import { menu } from "@/lib/repo/menu";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/dishes";
import { markQuote, removeQuote } from "../actions";
import { getClient, dietClashes } from "@/lib/repo/clients";
import { QUOTE_STATUS } from "@/db/schema";
import { db, bookings } from "@/db";
import { eq } from "drizzle-orm";
import BookIt from "./book";

export const metadata: Metadata = { title: "Quote" };

/*
 * `params` is a Promise from Next 15 onwards. Awaiting it is not ceremony: the
 * router can begin rendering before the segment is resolved, and a page that
 * reads it synchronously is a page that can render against the wrong id.
 */
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireViewer();
  const dishes = await menu(me.locale);
  const { id } = await params;
  const q = await getQuote(me, id);
  // Null covers both "no such quote" and "not yours". Telling them apart would
  // let someone count your events by trying ids.
  if (!q) notFound();

  const money = CAN.seeMoney(me.role);
  const picked = dishes.filter((d) => q.dishIds.includes(d.id));
  const chosen = visibleDishes(picked, me.role);

  /*
   * The point of recording a diet against a client: it has to catch a dish on
   * every menu quoted for them afterwards, not just the one where it was
   * mentioned. Asked of lib/dietary.ts, so this and the /find filter cannot
   * disagree about the same dish.
   */
  const client = q.clientId ? await getClient(me, q.clientId) : null;
  const [booked] = CAN.writeBookings(me.role)
    ? await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.quoteId, q.id)).limit(1)
    : [];
  const clashes = client ? dietClashes(client, picked) : [];
  const byCategory = CATEGORY_ORDER
    .map((cat) => ({ cat, rows: chosen.filter((d) => d.category === cat) }))
    .filter((g) => g.rows.length > 0);

  return (
    <>
      <section className="border-b border-line py-12">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          <Link href="/quotes" className="hover:text-ink">Quotes</Link>
          <span className="mx-2">·</span>
          <span>{q.status}</span>
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{q.name}</h1>
        <p className="mt-4 text-ink-2">
          {q.clientName ? <>{q.clientName} · </> : null}
          {q.guests} guests · {TIERS[q.tier as "scran"]?.name ?? q.tier}
          {q.district ? <> · {q.district}</> : null}
        </p>
      </section>

      {clashes.length > 0 && (
        <section className="mt-8 rounded-xl border border-bad bg-surface p-5">
          <h2 className="font-display text-xl font-semibold tracking-tight text-bad">
            {client!.name} cannot eat {clashes.reduce((n, c) => n + c.dishes.length, 0)} of these
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            From what is recorded against them, not from this menu. Swap the dish or take it off.
          </p>
          {clashes.map((c) => (
            <div key={c.diet} className="mt-4">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {c.dietLabel}
              </h3>
              <ul className="mt-1.5 space-y-1 text-sm">
                {c.dishes.map((d) => (
                  <li key={d.id} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{d.name}</span>
                    {d.because.length > 0 && (
                      <span className="text-ink-2">— {d.because.join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-10 py-10 md:grid-cols-[1fr_320px]">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">The menu</h2>
          {byCategory.map((g) => (
            <div key={g.cat} className="mt-6">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {CATEGORY_LABEL[g.cat]} · {g.rows.length}
              </h3>
              <ul className="mt-2 divide-y divide-line/60">
                {g.rows.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-4 py-2">
                    <span>{d.name}</span>
                    {"price" in d && (
                      <span className="font-mono text-sm tabular-nums text-ink-2">
                        {soles(d.price)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {q.notes && (
            <div className="mt-8 rounded-lg border border-line bg-surface p-4">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{q.notes}</p>
            </div>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-semibold tracking-tight">What it came to</h2>
          <p className="mt-1 text-xs text-ink-3">
            As quoted on {q.createdAt.toLocaleDateString("en-GB")} — not recalculated since,
            so it still says what you charged.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-2">Net</dt>
              <dd className="font-mono tabular-nums">{soles(q.netTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">IGV {(IGV_RATE * 100).toFixed(0)}%</dt>
              <dd className="font-mono tabular-nums">{soles(q.grossTotal - q.netTotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-semibold">
              <dt>Client pays</dt>
              <dd className="font-mono tabular-nums">{soles(q.grossTotal)}</dd>
            </div>
            {money && (
              <>
                <div className="flex justify-between border-t border-line pt-2">
                  <dt className="text-ink-2">Food cost</dt>
                  <dd className="font-mono tabular-nums">{soles(q.foodCostTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">Food cost %</dt>
                  <dd className="font-mono tabular-nums">
                    {((q.foodCostTotal / q.netTotal) * 100).toFixed(1)}%
                  </dd>
                </div>
              </>
            )}
          </dl>

          {CAN.writeQuotes(me.role) && (
            <div className="mt-6 border-t border-line pt-5">
              <form action={markQuote.bind(null, q.id)} className="flex flex-wrap gap-2">
                {QUOTE_STATUS.filter((s) => s !== q.status).map((s) => (
                  <button
                    key={s} name="status" value={s} type="submit"
                    className="rounded border border-line px-2.5 py-1 font-mono text-[11px]
                               uppercase tracking-wider text-ink-2 hover:border-ink hover:text-ink"
                  >
                    Mark {s}
                  </button>
                ))}
              </form>
              <BookIt id={q.id} alreadyBooked={Boolean(booked)} />

              <form action={removeQuote.bind(null, q.id)} className="mt-4">
                <button type="submit" className="text-xs text-bad hover:underline">
                  Delete this quote
                </button>
              </form>
            </div>
          )}
        </aside>
      </section>
    </>
  );
}
