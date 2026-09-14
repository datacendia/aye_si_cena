import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { loadCopy } from "@/lib/copy";
import { MIN_PASSWORD } from "@/lib/repo/passwords";
import PasswordForm from "./form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const me = await requireViewer();
  const t = await loadCopy(me.locale);

  return (
    <>
      <section className="border-b border-line py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("account.heading")}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">{t("account.lede")}</p>
        <p className="mt-3 font-mono text-sm text-ink-3">
          {me.email} · {me.role}
        </p>
      </section>

      <section className="py-10">
        <PasswordForm
          labels={{
            current: t("account.current"),
            next: t("account.new"),
            confirm: t("account.confirm"),
            change: t("account.change"),
            changed: t("account.changed"),
            minimum: `${t("account.minimum")} (${MIN_PASSWORD})`
          }}
        />
      </section>
    </>
  );
}
