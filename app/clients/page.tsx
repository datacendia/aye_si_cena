import { loadCopy } from "@/lib/copy";
import type { Metadata } from "next";
import Link from "next/link";
import { requireCan, CAN } from "@/lib/session";
import { listClients } from "@/lib/repo/clients";
import { DIETS, DIET_LABEL, type Diet } from "@/lib/dietary";
import { dietLabel } from "@/lib/copy";
import ClientForm from "./form";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const me = await requireCan(CAN.seeAllClients, "see the client list");
  const t = await loadCopy(me.locale);
  const rows = await listClients(me);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("clients.heading")}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          {t("clients.lede")}
        </p>
      </section>

      <section className="grid gap-10 py-10 md:grid-cols-[340px_1fr]">
        {CAN.manageClients(me.role) ? <ClientForm
            dietLabels={Object.fromEntries(
              DIETS.map((d) => [d, dietLabel(t, d, DIET_LABEL[d])])
            )}
          /> : <div />}

        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {t("clients.onBooks")} · {rows.length}
          </h2>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink-2">
              {t("clients.none")}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line/60">
              {rows.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <Link href={`/clients/${c.id}`} className="font-medium hover:text-aji">
                      {c.name}
                    </Link>
                    <span className="font-mono text-[11px] text-ink-3">
                      {c.quoteCount} {c.quoteCount === 1 ? "quote" : "quotes"}
                      {c.hasLogin && " · has a login"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-2">
                    {[c.contact, c.phone, c.district].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {c.diets.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {c.diets.map((d) => (
                        <span
                          key={d}
                          className="rounded border border-thistle px-1.5 py-0.5 font-mono
                                     text-[10px] uppercase tracking-wider text-thistle"
                        >
                          {dietLabel(t, d, DIET_LABEL[d as Diet] ?? d)}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
