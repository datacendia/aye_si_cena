/**
 * The outer gate: deny by default.
 *
 * A page added next month is private until somebody deliberately says
 * otherwise, which is the right way round for an app carrying a cost base.
 * This only asks whether somebody is signed in; what they may then see is
 * decided by lib/permissions.ts on the server, per dish, per quote.
 *
 * Two kinds of exception, kept apart because they behave differently:
 *
 *   PUBLIC_EXACT   matched whole. "/" is here rather than in the prefix list
 *                  for the obvious reason — as a prefix it matches everything
 *                  and the gate stops existing.
 *
 *   PUBLIC_PREFIX  matched as a path segment, so "/carta" opens "/carta" and
 *                  "/carta/anything" but never "/cartagena". A plain
 *                  startsWith would open the second one too, which is the sort
 *                  of thing nobody notices until a route is named badly.
 *
 * __tests__/route-guards.test.ts reads app/(public)/ and fails if this list and
 * that directory disagree in either direction — a public page the gate blocks
 * is invisible, and a gate entry with no page behind it is an open door
 * somebody forgot to close.
 *
 * /reset was missing from this list for the whole of its first day. The page
 * existed, the token worked, the tests passed, and every person who clicked a
 * password-reset link was redirected to the login box they could not get past.
 * Nothing caught it because every test signed in first.
 */
import { NextResponse, type NextRequest } from "next/server";

/** The shop window's front page. */
const PUBLIC_EXACT = ["/"];

/** Sections anybody may open, matched on whole path segments. */
const PUBLIC_PREFIX = [
  "/login",
  "/api/auth",
  /* Somebody who cannot sign in is exactly who needs this one. */
  "/reset",
  /* The shop window. */
  "/carta",
  "/paquetes",
  "/eventos"
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // The session cookie's presence is enough to route on. Whether it is valid is
  // settled by the server on the page itself - this check exists to redirect a
  // signed-out visitor, not to authorise a signed-in one.
  const signedIn = req.cookies.has("authjs.session-token") ||
                   req.cookies.has("__Secure-authjs.session-token");
  if (signedIn) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|woff2)$).*)"]
};
