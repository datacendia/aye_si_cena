import type { Metadata } from "next";
import { requireCan, CAN } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { TIERS } from "@/lib/pricing";
import { DISTRICTS, VENUE_TYPES } from "@/data/venues";
import TakeForm from "./form";

export const metadata: Metadata = { title: "Can you do it?" };

/**
 * The question the whole capacity engine was written to answer.
 *
 * lib/capacity.ts could work out whether two jobs fit one kitchen, one van and
 * one crew from the day it was written — and for months nothing asked it about
 * a real booking. couldTake() sat in lib/repo/bookings.ts, complete and
 * correct, never called by anything. This is the screen it was missing.
 */
export default async function TakePage() {
  const me = await requireCan(CAN.seeKitchen, "check whether a day can take another job");
  const t = await loadCopy(me.locale);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("take.heading")}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">{t("take.lede")}</p>
      </section>

      <section className="py-10">
        <TakeForm
          today={today}
          tiers={Object.values(TIERS).map((x) => ({ id: x.id, name: x.name }))}
          districts={DISTRICTS.map((d) => ({ id: d.id, name: d.name }))}
          venues={VENUE_TYPES.map((v) => ({ id: v.id, name: v.name }))}
          labels={{
            lede: t("take.lede"), date: t("take.date"), time: t("take.time"),
            hours: t("take.hours"), guests: t("take.guests"),
            tier: t("take.tier"), district: t("take.district"),
            venue: t("take.venue"), ask: t("take.ask"),
            yes: t("take.yes"), no: t("take.no"),
            against: t("take.against"), alone: t("take.alone"),
            kit: t("take.kit"), planchas: t("take.planchas"), fryers: t("take.fryers"),
            ovens: t("take.ovens"), vans: t("take.vans"), crew: t("take.crew")
          }}
        />
      </section>
    </>
  );
}
