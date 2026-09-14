import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/session";
import LoginForm from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams
}: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  /*
   * Where to go after signing in. Only a path on this site: an absolute URL
   * here is an open redirect, and a login page is exactly where somebody would
   * look for one.
   */
  const back = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await viewer()) redirect(back);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Aye <span className="text-aji">Si</span> Cena
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        This menu carries what every dish costs and who supplies it. Sign in to see it.
      </p>
      <LoginForm next={back} />
      <p className="mt-8 border-t border-line pt-5 text-xs text-ink-3">
        There is no sign-up. Accounts are created by the owner, because every account
        can see something a stranger should not.
      </p>
    </div>
  );
}
