import { NextResponse, type NextRequest } from "next/server";

// An optimistic check only: no session cookie, go to /signin (or, for the front
// door, to the landing page). The real check (is the session valid?) happens in
// getCurrentUser on every request.
export function proxy(request: NextRequest) {
  if (request.cookies.has("pv_session")) return NextResponse.next();
  const to = request.nextUrl.pathname === "/" ? "/welcome" : "/signin";
  return NextResponse.redirect(new URL(to, request.url));
}

export const config = {
  matcher: ["/", "/vault", "/vault/:path*", "/withdraw", "/add-funds", "/invest", "/invest/:path*", "/activity", "/advisor", "/portfolio"],
};
