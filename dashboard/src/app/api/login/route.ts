import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, createSession, safeEqual, safeNext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return new NextResponse("Dashboard is not configured.", { status: 503 });

  // same-origin form posts only
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return new NextResponse("Bad origin", { status: 403 });

  const form = await request.formData().catch(() => null);
  const given = String(form?.get("password") ?? "");
  const next = safeNext(String(form?.get("next") ?? "/"));

  if (!(await safeEqual(given, password))) {
    await sleep(800); // slows guessing; the real defence is a long password
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const res = NextResponse.redirect(new URL(next, request.url), 303);
  res.cookies.set(SESSION_COOKIE, await createSession(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
