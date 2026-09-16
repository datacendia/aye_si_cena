import type { Metadata } from "next";
import { requireCan, CAN } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { postMortems } from "@/lib/repo/actuals";
import { shareState } from "@/lib/repo/pack";
import { db, eventActuals } from "@/db";
import Rows, { type Row } from "./rows";

export const metadata: Metadata = { title: "Did it pay?" };

/**
 * Did that job actually make money?
 *
 * Owner only, and not only because it carries money: it is the page where you
 * find out the model is wrong, and that is a decision nobody else should be
 * making.
 *
 * Every past booking is listed, including the ones with nothing recorded — those
 * are the work list. A page showing only the events somebody had already filled
 * in would be a page that never reminded anybody to fill one in.
 */
export default async function PostMortemPage() {
  const me = await requireCan(CAN.seeMoney, "see what events actually cost");
  const t = await loadCopy(me.locale);

  const events = await postMortems(me);
  const raw = Object.fromEntries(
    (await db.select().from(eventActuals)).map((a) => [a.bookingId, a])
  );
  const shares = Object.fromEntries(
    await Promise.all(events.map(async (e) => [e.bookingId, Boolean(await shareState(me, e.bookingId))]))
  );

  const rows: Row[] = events.map((e) => ({
    bookingId: e.bookingId,
    when: e.eventDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    name: e.name,
    guestsQuoted: e.guestsQuoted,
    guestsServed: e.guestsServed,
    quotedNet: e.quotedNet,
    spentTotal: e.spentTotal,
    contribution: e.contribution,
    quotedFoodCostRatio: e.quotedFoodCostRatio,
    actualFoodCostRatio: e.actualFoodCostRatio,
    foodCostGap: e.foodCostGap,
    recorded: e.recorded,
    shared: Boolean(shares[e.bookingId]),
    spent: {
      food: raw[e.bookingId]?.foodSpend ?? null,
      staff: raw[e.bookingId]?.staffSpend ?? null,
      transport: raw[e.bookingId]?.transportSpend ?? null,
      other: raw[e.bookingId]?.otherSpend ?? null
    },
    note: raw[e.bookingId]?.note ?? null
  }));

  const measured = rows.filter((r) => r.recorded);
  const gaps = measured.map((r) => r.foodCostGap).filter((g): g is number => g !== null);
  const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("pm.heading")}
        </h1>
        <p className="mt-4 max-w-3xl text-ink-2">{t("pm.lede")}</p>

        {meanGap !== null && (
          <p className="mt-4 font-mono text-sm">
            <span className="tnum text-ink-3">{measured.length}</span> recorded ·{" "}
            <span className={`tnum font-semibold ${meanGap > 0.02 ? "text-bad" : "text-good"}`}>
              {meanGap > 0 ? "+" : ""}{(meanGap * 100).toFixed(1)}%
            </span>{" "}
            <span className="text-ink-3">{t("pm.gap")}</span>
          </p>
        )}
      </section>

      <section className="py-10">
        {rows.length === 0 ? (
          <p className="text-ink-2">{t("pm.nothingPast")}</p>
        ) : (
          <Rows
            rows={rows}
            labels={{
              notRecorded: t("pm.notRecorded"), record: t("pm.record"), saved: t("pm.saved"),
              servedNot: t("pm.servedNot"),
              food: t("pm.spent"), staff: "Staff", transport: "Transport", other: "Other",
              served: t("pack.guests"), note: "Note",
              share: t("pack.share"), revoke: t("pack.revoke"), copyOnce: t("pack.copyOnce")
            }}
          />
        )}
      </section>
    </>
  );
}
