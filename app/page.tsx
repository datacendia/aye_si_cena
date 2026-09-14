import { requireViewer } from "@/lib/session";
import Link from "next/link";
import { menu } from "@/lib/repo/menu";
import { TIERS } from "@/lib/pricing";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/dishes";



export default async function HomePage() {
  const me = await requireViewer();
  const dishes = await menu(me.locale);

  // Cheapest food cost with the widest tier reach reads as the strongest sellers.
  const signatures = [...dishes]
    .filter((d) => d.tiers.length === 3)
    .sort((a, b) => a.cost / a.price - b.cost / b.price)
    .slice(0, 6);
  const counts = CATEGORY_ORDER.map((c) => ({
    label: CATEGORY_LABEL[c],
    n: dishes.filter((d) => d.category === c).length
  }));

  return (
    <>
      <section className="border-b border-line py-16 sm:py-24">
        <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
          Scottish-Peruvian catering · Lima
        </p>
        <h1 className="font-display text-5xl font-semibold leading-none tracking-tight sm:text-7xl">
          Aye, Si, Cena.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-2">
          <span className="text-ink">Aye</span> is Scottish for yes.{" "}
          <span className="text-ink">Sí</span> is Spanish for yes. Say it aloud and it means
          something else again. {dishes.length} dishes that take Glasgow technique and run it through the
          Lima pantry.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/builder"
            className="rounded-lg bg-ink px-5 py-3 text-sm font-bold text-bg hover:opacity-90"
          >
            Build a menu &amp; see the price
          </Link>
          <Link
            href="/menu"
            className="rounded-lg border border-line px-5 py-3 text-sm font-bold hover:border-ink-3"
          >
            Browse all {dishes.length} dishes
          </Link>
        </div>

        <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 font-mono text-xs text-ink-3">
          {counts.map((c) => (
            <div key={c.label}>
              <dt className="inline text-ink-2">{c.label}</dt>{" "}
              <dd className="tnum inline font-semibold text-ink">{c.n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-b border-line py-14">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Three ways to book</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Same kitchen, three levels of service. The box tier needs no staff, no hired china and no
          liquor licence — which is why it is the fastest to sell.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {Object.values(TIERS).map((t) => (
            <div key={t.id} className="rounded-xl border border-line bg-surface p-6">
              <h3 className="font-display text-xl font-semibold">{t.name}</h3>
              <p className="mt-1 font-mono text-xs text-ink-3">
                Minimum {t.minGuests} guests · {t.bitesPerGuest} bites per guest
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-2">
                <li>
                  Menaje{" "}
                  <span className="tnum font-mono text-ink">
                    {t.menajePerGuest > 0 ? `S/ ${t.menajePerGuest.toFixed(2)}/guest` : "not required"}
                  </span>
                </li>
                <li>
                  Floor staff{" "}
                  <span className="tnum font-mono text-ink">
                    {t.guestsPerWaiter > 0 ? `1 per ${t.guestsPerWaiter} guests` : "none"}
                  </span>
                </li>
                <li>
                  Transport <span className="tnum font-mono text-ink">S/ {t.transport.toFixed(2)}</span>
                </li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14">
        <h2 className="font-display text-3xl font-semibold tracking-tight">The signatures</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          The dishes that explain the whole idea in one bite.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {signatures.map((d) => (
            <article key={d.id} className="rounded-xl border border-line bg-surface p-5">
              <p className="font-mono text-[11px] text-ink-3">{String(d.id).padStart(3, "0")}</p>
              <h3 className="mt-1 font-display text-lg font-semibold leading-tight">{d.name}</h3>
              <p className="mt-2 text-sm text-ink-2">{d.fusion}</p>
              <p className="mt-3 text-xs">
                <span className="font-bold text-thistle">{d.origin}</span>
                <span className="text-ink-3"> → </span>
                <span className="font-bold text-aji">{d.subOrigin}</span>
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
