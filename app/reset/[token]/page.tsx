import type { Metadata } from "next";
import Link from "next/link";
import { resetTarget, MIN_PASSWORD, RESET_MINUTES } from "@/lib/repo/passwords";
import { staticCopy } from "@/lib/copy";
import ResetForm from "./form";

export const metadata: Metadata = { title: "New password" };

/**
 * The one page in the app that a stranger may open.
 *
 * It reveals exactly one thing to whoever holds the link — the email address it
 * was issued for — and that is deliberate: somebody setting a password needs to
 * know which account they are setting it on, and anybody holding the link could
 * set it anyway. Everything else about the account stays behind the login.
 *
 * The copy is the static book rather than loadCopy(), because reading the
 * database for a phrase here would put a query in front of a page that must
 * work when the person cannot sign in.
 */
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = await resetTarget(token).catch(() => null);
  const t = staticCopy("es");

  if (!target) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t("reset.heading")}
        </h1>
        <p className="mt-4 text-sm text-bad">{t("reset.gone")}</p>
        <Link href="/login" className="mt-6 text-sm text-ink-2 underline hover:text-ink">
          Aye <span className="text-aji">Si</span> Cena
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t("reset.heading")}
      </h1>
      <p className="mt-2 font-mono text-sm text-ink-3">
        {t("reset.for")} {target.email}
      </p>

      <ResetForm
        token={token}
        labels={{
          next: t("account.new"),
          confirm: t("account.confirm"),
          set: t("reset.set"),
          minimum: `${t("account.minimum")} (${MIN_PASSWORD})`
        }}
      />

      <p className="mt-8 border-t border-line pt-5 text-xs text-ink-3">
        This link works once and for {RESET_MINUTES} minutes.
      </p>
    </div>
  );
}
