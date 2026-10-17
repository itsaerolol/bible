// Password gate helpers. Web Crypto only, so they run in the proxy and in route handlers.
// Session cookie value: "<expiresAtMs>.<nonce>.<hmac>". The HMAC key is derived from DASHBOARD_PASSWORD
// (and DASHBOARD_SESSION_SECRET if set), so changing the password signs everyone out.

export const SESSION_COOKIE = "bible_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(password: string, message: string): Promise<string> {
  const material = `${password}\u0000${process.env.DASHBOARD_SESSION_SECRET ?? ""}\u0000bible-dashboard-session-v1`;
  const key = await crypto.subtle.importKey("raw", enc.encode(material), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Constant-time string comparison (compares SHA-256 digests so lengths do not leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0 && a.length === b.length;
}

export async function createSession(password: string, now = Date.now()): Promise<string> {
  const exp = now + SESSION_MAX_AGE_S * 1000;
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const body = `${exp}.${nonce}`;
  return `${body}.${await hmac(password, body)}`;
}

export async function verifySession(token: string, password: string, now = Date.now()): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts as [string, string, string];
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < now) return false;
  return safeEqual(sig, await hmac(password, `${exp}.${nonce}`));
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/login") || next.startsWith("/api/")) return "/";
  return next;
}
