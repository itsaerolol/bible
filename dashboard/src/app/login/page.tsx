import type { Metadata } from "next";
import { safeNext } from "@/lib/auth";
import { Logo } from "@/components/Icon";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <div className="login-wrap">
      <form className="login" method="post" action="/api/login">
        <Logo size={40} />
        <div>
          <h1>Shorts analytics</h1>
          <p className="sub">Private dashboard. Enter the password to continue.</p>
        </div>
        <input type="hidden" name="next" value={next} />
        <label>
          Password
          <input className="field" type="password" name="password" autoComplete="current-password" required autoFocus />
        </label>
        {sp.error && (
          <p className="err" role="alert">
            That password did not match. Try again.
          </p>
        )}
        <button className="btn" type="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}
