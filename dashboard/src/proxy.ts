// Password gate. Next.js 16 renamed "middleware" to "proxy"; this is the same thing.
// - DASHBOARD_PASSWORD missing in production: refuse to serve anything (503), never serve open.
// - No valid session cookie: pages redirect to /login, /api returns 401.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/login"]);

const HEADERS = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
};

export async function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Dashboard is not configured. Set DASHBOARD_PASSWORD and redeploy.", {
        status: 503,
        headers: { ...HEADERS, "content-type": "text/plain; charset=utf-8" },
      });
    }
    // local development without a password: allow, the dev server is not exposed
    return NextResponse.next();
  }

  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = token ? await verifySession(token, password) : false;

  if (PUBLIC_PATHS.has(pathname)) {
    if (ok && pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  const res = NextResponse.redirect(url);
  res.headers.set("cache-control", HEADERS["cache-control"]);
  return res;
}

export const config = {
  // Static build assets carry no data (data is rendered into the HTML), so they skip the gate.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
