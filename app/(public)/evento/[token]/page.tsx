import type { Metadata } from "next";
import { loadCopy, allergenLabel, dietLabel } from "@/lib/copy";
import { readerLocale } from "@/lib/public-locale";
import { packFor } from "@/lib/repo/pack";
import { publicMenu, publicDiets } from "@/lib/public";
import { ALLERGEN_LABEL, DIET_LABEL, DIETS, type Diet } from "@/lib/dietary";
import { DISTRICTS, VENUE_TYPES } from "@/data/venues";
import { TIERS } from "@/lib/pricing";
import { WHATSAPP_HREF } from "../../contact";

export const metadata: Metadata = { title: "Your event", robots: { index: false } };

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * The link you send a client.
 *
 * Replaces the eleven WhatsApp messages before every event, which are always
 * the same eleven questions. The token is the authority — no account, because
 * the person who most needs this page is the bride's mother.
 *
 * `robots: noindex` because the page names a private event, a date and a head
 * count. It is unguessable rather than secret, and those are different things.
 *
 * The diet clash block is the part that earns its place. The client told you
 * about a coeliac when the record was made; this checks that against the menu
 * that is actually booked, and says so before the day rather than on it.
 */
export default async function PackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await readerLocale();
  const t = await loadCopy(locale);

  const pack = await packFor(token).catch(() => null);

  if (!pack) {
    return (
      <div className="mx-auto max-w-lg py-20">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("pack.heading")}</h1>
        <p className="mt-4 text-bad">{t("pack.gone")}</p>
        <a href={WHATSAPP_HREF} className="mt-6 inline-block text-sm text-aji underline">
          {t("pub.whatsapp")}
        </a>
      </div>
    );
  }

  const dishes = (await publicMenu(locale)).filter((d) => pack.dishIds.includes(d.id));
  const suitsByDish = await publicDiets();

  const district = DISTRICTS.find((d) => d.id === pack.district);
  const venue = VENUE_TYPES.find((v) => v.id === pack.venue);
  const tier = TIERS[pack.tier as keyof typeof TIERS];

  const recorded = pack.clientDiets.filter((d): d is Diet =>
    (DIETS as readonly string[]).includes(d));

  // Dishes on the booked menu that do not suit a diet the client told us about.
  const clashes = recorded.flatMap((diet) =>
    dishes
      .filter((d) => !(suitsByDish[d.id] ?? []).includes(diet))
      .map((d) => ({ diet, dish: d }))
  );

  return (
    <article className="mx-auto max-w-2xl py-10">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
        {t("pack.heading")}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight">
        {pack.quoteName ?? pack.clientName ?? "—"}
      </h1>

      <dl className="mt-7 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
            {t("pack.when")}
          </dt>
          <dd className="mt-1 text-ink">
            {pack.eventDate.toLocaleDateString(locale === "es" ? "es-PE" : "en-GB", {
              weekday: "long", day: "numeric", month: "long", year: "numeric"
            })}
            <span className="block font-mono text-sm text-ink-2">
              {t("pack.service")} {hhmm(pack.serviceMinutes)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
            {t("pack.guests")}
          </dt>
          <dd className="tnum mt-1 text-ink">
            {pack.guests}
            {tier && <span className="block text-sm text-ink-2">{tier.name}</span>}
          </dd>
        </div>
        {district && (
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {t("pack.where")}
            </dt>
            <dd className="mt-1 text-ink">
              {district.name}
              {venue && <span className="block text-sm text-ink-2">{venue.name}</span>}
            </dd>
          </div>
        )}
        {pack.grossTotal != null && (
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {t("pack.total")}
            </dt>
            <dd className="tnum mt-1 font-display text-2xl font-semibold">
              S/ {pack.grossTotal.toFixed(2)}
              <span className="block font-mono text-[11px] font-normal text-ink-3">
                {t("pack.igvIncluded")}
              </span>
            </dd>
          </div>
        )}
      </dl>

      {clashes.length > 0 && (
        <section className="mt-8 rounded-xl border border-warn bg-warn/5 p-5">
          <h2 className="font-display text-xl font-semibold tracking-tight text-warn">
            {t("pack.diets")}
          </h2>
          <p className="mt-2 text-sm text-ink-2">{t("pack.dietsClash")}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {clashes.slice(0, 12).map(({ diet, dish }) => (
              <li key={`${diet}-${dish.id}`}>
                <span className="text-ink">{dish.name}</span>
                <span className="ml-2 font-mono text-[11px] uppercase text-warn">
                  {dietLabel(t, diet, DIET_LABEL[diet])}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-9">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{t("pack.menu")}</h2>
        <ul className="mt-4 divide-y divide-line/60">
          {dishes.map((d) => (
            <li key={d.id} className="py-3">
              <p className="text-ink">{d.name}</p>
              <p className="mt-1 text-sm text-ink-2">{d.fusion}</p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider">
                {d.allergens.length > 0 ? (
                  <span className="text-warn">
                    {t("dish.contains")}:{" "}
                    {d.allergens.map((a) => allergenLabel(t, a, ALLERGEN_LABEL[a])).join(" · ")}
                  </span>
                ) : (
                  <span className="text-good">{t("pub.noneDeclarable")}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 font-mono text-[11px] uppercase tracking-wider text-ink-3">
          {t("pack.allergens")}
        </h3>
        <p className="mt-2 text-sm text-ink-3">{t("pack.allergensLede")}</p>
      </section>

      <section className="mt-9 border-t border-line pt-6">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {t("pack.questions")}
        </h2>
        <a
          href={WHATSAPP_HREF}
          className="mt-4 inline-block rounded-lg bg-ink px-5 py-3 text-sm font-bold text-bg
                     hover:opacity-90"
        >
          {t("pub.whatsapp")}
        </a>
      </section>
    </article>
  );
}
