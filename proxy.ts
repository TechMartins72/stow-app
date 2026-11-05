import { NextResponse, type NextRequest } from "next/server";

// An optimistic check only: no session cookie, go to /signin. The real check
// (is the session valid?) happens in getCurrentUser on every request.
export function proxy(request: NextRequest) {
  if (request.cookies.has("pv_session")) return NextResponse.next();
  return NextResponse.redirect(new URL("/signin", request.url));
}

export const config = {
  matcher: ["/", "/vault/:path*"],
};
