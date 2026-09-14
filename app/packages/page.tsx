import { requireViewer } from "@/lib/session";
import type { Metadata } from "next";
import Link from "next/link";
import { TIERS, STAFF_SHIFT_COST, CHEF_SHIFT_COST, IGV_RATE, soles } from "@/lib/pricing";
import { menu } from "@/lib/repo/menu";

export const metadata: Metadata = { title: "Packages" };

export default async function PackagesPage() {
  const me = await requireViewer();
  const dishes = await menu(me.locale);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Packages</h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Three tiers, and exactly what each one carries in per-event cost. These figures drive the
          builder — change them here and every quote moves with them.
        </p>
      </section>

      <section className="grid gap-5 py-10 sm:grid-cols-3">
        {Object.values(TIERS).map((t) => {
          const eligible = dishes.filter((d) => d.tiers.includes(t.id)).length;
          return (
            <div key={t.id} className="rounded-xl border border-line bg-surface p-6">
              <h2 className="font-display text-2xl font-semibold">{t.name}</h2>
              <p className="mt-1 font-mono text-xs text-ink-3">
                {eligible} dishes available at this tier
              </p>
              <dl className="mt-5 space-y-2 font-mono text-xs">
                <Row label="Minimum guests" value={String(t.minGuests)} />
                <Row label="Bites per guest" value={String(t.bitesPerGuest)} />
                <Row
                  label="Menaje per guest"
                  value={t.menajePerGuest > 0 ? soles(t.menajePerGuest) : "—"}
                />
                <Row
                  label="Packaging per guest"
                  value={t.packagingPerGuest > 0 ? soles(t.packagingPerGuest) : "—"}
                />
                <Row
                  label="Waiters"
                  value={t.guestsPerWaiter > 0 ? `1 per ${t.guestsPerWaiter}` : "none"}
                />
                <Row label="On-site chefs" value={String(t.chefs)} />
                <Row label="Transport" value={soles(t.transport)} />
              </dl>
            </div>
          );
        })}
      </section>

      <section className="border-t border-line py-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Rates behind the maths</h2>
        <dl className="mt-5 grid gap-3 font-mono text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface p-4">
            <dt className="text-xs text-ink-3">Waiter / prep shift</dt>
            <dd className="tnum mt-1 text-lg font-semibold">{soles(STAFF_SHIFT_COST)}</dd>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <dt className="text-xs text-ink-3">On-site chef shift</dt>
            <dd className="tnum mt-1 text-lg font-semibold">{soles(CHEF_SHIFT_COST)}</dd>
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <dt className="text-xs text-ink-3">IGV</dt>
            <dd className="tnum mt-1 text-lg font-semibold">{(IGV_RATE * 100).toFixed(0)}%</dd>
          </div>
        </dl>
        <p className="mt-6 max-w-2xl text-sm text-ink-2">
          Every quote is stated net, with IGV added on top. Quoting a gross figure while budgeting
          as if it were net loses about {soles(61.02)} per guest at a {soles(400)} head price.
        </p>
        <Link
          href="/builder"
          className="mt-6 inline-block rounded-lg bg-ink px-5 py-3 text-sm font-bold text-bg hover:opacity-90"
        >
          Build a menu
        </Link>
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tnum font-semibold">{value}</dd>
    </div>
  );
}
