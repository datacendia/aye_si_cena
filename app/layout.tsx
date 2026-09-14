import type { Metadata } from "next";
import Link from "next/link";
import { viewer } from "@/lib/session";
import { CAN } from "@/lib/permissions";
import { logout } from "./login/actions";
import { setLocale } from "./admin/actions";
import { loadCopy } from "@/lib/copy";
import type { Role } from "@/db/schema";
import { Fraunces, Karla, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted at build time: no external request, no layout shift.
const display = Fraunces({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-display" });
const body = Karla({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

/**
 * Nothing here is ever prerendered.
 *
 * Every page depends on who is asking, so a build-time snapshot is wrong by
 * definition. Next decides staticness by whether a render touched cookies -
 * which made this depend on whether DATABASE_URL happened to be set during the
 * build, and a page carrying the cost base must not be static by accident in
 * one environment and dynamic in another. Say it out loud instead.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Aye Si Cena",
    template: "%s · Aye Si Cena"
  },
  description:
    "Scottish-Peruvian catering in Lima. Glasgow technique, Lima pantry — canapés, buffets and plated dinners."
};

/**
 * The nav, by role.
 *
 * `needs` is the same predicate the page itself enforces, so a link can never
 * appear for someone the page would then refuse. This is convenience, not
 * security - hiding a link protects nothing, and every one of these pages
 * checks again on the server.
 */
const NAV: { href: string; key: string; needs?: (r: Role) => boolean }[] = [
  { href: "/", key: "nav.home" },
  { href: "/moments", key: "nav.moments" },
  { href: "/find", key: "nav.find" },
  { href: "/menu", key: "nav.menu", needs: CAN.seeMoney },
  { href: "/recipes", key: "nav.recipes", needs: CAN.seeKitchen },
  { href: "/seasonal", key: "nav.seasonal", needs: CAN.seeKitchen },
  { href: "/compare", key: "nav.compare", needs: CAN.seeMoney },
  { href: "/graph", key: "nav.graph", needs: CAN.seeKitchen },
  { href: "/packages", key: "nav.packages" },
  { href: "/builder", key: "nav.builder", needs: CAN.writeQuotes },
  { href: "/quotes", key: "nav.quotes", needs: CAN.writeQuotes },
  { href: "/engineering", key: "nav.engineering", needs: CAN.seeMoney },
  { href: "/clients", key: "nav.clients", needs: CAN.manageClients },
  { href: "/bookings", key: "nav.bookings", needs: CAN.writeBookings },
  { href: "/take", key: "nav.take", needs: CAN.seeKitchen },
  { href: "/prices", key: "nav.prices", needs: CAN.writePrices },
  { href: "/admin", key: "nav.admin", needs: CAN.manageClients },
  { href: "/account", key: "nav.account" }
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await viewer();
  const links = me ? NAV.filter((n) => !n.needs || n.needs(me.role)) : [];
  const t = await loadCopy(me?.locale ?? "es");

  return (
    <html lang={me?.locale ?? "es"} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
            <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
              Aye <span className="text-aji">Si</span> Cena
            </Link>
            <nav className="flex flex-wrap items-center gap-5 text-sm">
              {links.map((n) => (
                <Link key={n.href} href={n.href} className="text-ink-2 hover:text-ink">
                  {t(n.key)}
                </Link>
              ))}
              {me && (
                <>
                <form
                  action={setLocale.bind(null, me.locale === "es" ? "en" : "es")}
                  className="flex items-center"
                >
                  <button
                    type="submit"
                    className="font-mono text-[11px] uppercase tracking-wider text-ink-3
                               hover:text-ink"
                    title={me.locale === "es" ? "Read this in English" : "Léalo en español"}
                  >
                    {me.locale === "es" ? "EN" : "ES"}
                  </button>
                </form>
                <form action={logout} className="flex items-center gap-3">
                  <span
                    className="font-mono text-[11px] uppercase tracking-wider text-ink-3"
                    title={me.email}
                  >
                    {me.role}
                  </span>
                  <button type="submit" className="text-ink-3 hover:text-ink">
                    {t("chrome.signOut")}
                  </button>
                </form>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5">{children}</main>

        <footer className="mt-20 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-ink-3">
            {me && CAN.seeMoney(me.role) && (
              <p className="mb-2 max-w-2xl">{t("chrome.footerCosts")}</p>
            )}
            <p>{t("chrome.footerLine")}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
