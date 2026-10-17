#!/usr/bin/env node
// One-time local helper: get a YouTube refresh token for the daily analytics sync.
//
//   YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... node scripts/youtube-auth.mjs [--no-open] [--port 8085]
//
// What it does: runs the installed-app OAuth "loopback" flow (PKCE). It opens Google's consent page,
// waits for the redirect on http://127.0.0.1:<port>, exchanges the code, checks that both scopes were
// granted, shows which channel the token belongs to, and prints the refresh token.
//
// What to do with the output:
//   1. Copy the refresh token (one long string starting with "1//").
//   2. GitHub repo > Settings > Secrets and variables > Actions > New repository secret:
//        YOUTUBE_REFRESH_TOKEN = <the token>
//      Also add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET (same values you used here).
//   3. Never commit the token or paste it into chat. It is not written to disk by this script.
//
// Scopes requested (read only):
//   https://www.googleapis.com/auth/yt-analytics.readonly   Analytics API reports
//   https://www.googleapis.com/auth/youtube.readonly        channel and video lists (also required by reports.query)
//
// Important: if the OAuth consent screen is in "Testing" status, Google expires the refresh token after
// 7 days. Set the consent screen to "In production" (no verification needed for a personal tool, you
// just click through the "unverified app" warning once) before running this. See docs/dashboard-setup.md.
//
// Pick the right account at the Google prompt. If the channel is a brand account, choose that channel
// in the account chooser, otherwise the token will point at your personal channel.
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = ["https://www.googleapis.com/auth/yt-analytics.readonly", "https://www.googleapis.com/auth/youtube.readonly"];

const argv = process.argv.slice(2);
const noOpen = argv.includes("--no-open");
const portArg = argv.indexOf("--port");
const port = portArg >= 0 ? Number(argv[portArg + 1]) : 0;
if (argv.includes("--help") || argv.includes("-h")) {
  console.log("usage: YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... node scripts/youtube-auth.mjs [--no-open] [--port N]");
  process.exit(0);
}

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET (OAuth client of type Desktop app). See docs/dashboard-setup.md.");
  process.exit(1);
}

const b64url = (buf) => buf.toString("base64url");
const verifier = b64url(randomBytes(48));
const challenge = b64url(createHash("sha256").update(verifier).digest());
const state = b64url(randomBytes(16));

function page(title, body) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1 style="font-size:1.25rem">${title}</h1><p>${body}</p>`;
}

const server = createServer();
const listening = new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolve);
});

try {
  await listening;
} catch (e) {
  console.error(`Could not listen on 127.0.0.1:${port}: ${e.message}`);
  process.exit(1);
}
const redirectUri = `http://127.0.0.1:${server.address().port}`;

const authUrl = new URL(AUTH_URL);
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: SCOPES.join(" "),
  code_challenge: challenge,
  code_challenge_method: "S256",
  state,
  access_type: "offline",
  prompt: "consent",
}).toString();

console.log("\nOpen this URL in your browser and approve access (read only):\n");
console.log(authUrl.toString());
console.log(`\nWaiting for Google to redirect to ${redirectUri} (times out in 5 minutes)...\n`);

if (!noOpen) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const a = process.platform === "win32" ? ["/c", "start", "", authUrl.toString()] : [authUrl.toString()];
  try {
    const p = spawn(cmd, a, { stdio: "ignore", detached: true });
    p.on("error", () => {});
    p.unref();
  } catch {
    /* the URL is printed above, opening is best effort */
  }
}

const code = await new Promise((resolve) => {
  const timer = setTimeout(() => {
    console.error("Timed out waiting for the browser redirect.");
    process.exit(1);
  }, 5 * 60_000);
  server.on("request", (req, res) => {
    const u = new URL(req.url ?? "/", redirectUri);
    if (u.pathname !== "/") {
      res.writeHead(404).end();
      return;
    }
    const err = u.searchParams.get("error");
    if (err) {
      res.writeHead(400, { "content-type": "text/html" }).end(page("Authorization failed", `Google returned: ${err}. You can close this tab.`));
      console.error(`Google returned an error: ${err}`);
      process.exit(1);
    }
    if (u.searchParams.get("state") !== state) {
      res.writeHead(400, { "content-type": "text/html" }).end(page("State mismatch", "This request did not start from this script. Close the tab and try again."));
      return;
    }
    const c = u.searchParams.get("code");
    if (!c) {
      res.writeHead(400).end("missing code");
      return;
    }
    res.writeHead(200, { "content-type": "text/html" }).end(page("Done", "You can close this tab and return to the terminal."));
    clearTimeout(timer);
    resolve(c);
  });
});
server.close();

const tokenRes = await fetch(TOKEN_URL, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  }),
});
const tok = await tokenRes.json().catch(() => ({}));
if (!tokenRes.ok) {
  console.error(`Token exchange failed (HTTP ${tokenRes.status}): ${tok.error ?? ""} ${tok.error_description ?? ""}`);
  if (tok.error === "invalid_client") console.error("Check YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET, and that the OAuth client type is Desktop app.");
  process.exit(1);
}

const granted = new Set(String(tok.scope ?? "").split(/\s+/));
const missing = SCOPES.filter((s) => !granted.has(s));
if (missing.length) {
  console.error(`\nWARNING: these scopes were not granted: ${missing.join(", ")}`);
  console.error("Run the script again and leave every permission box ticked on the Google consent screen.\n");
}

if (!tok.refresh_token) {
  console.error(
    "Google did not return a refresh token. Remove this app at https://myaccount.google.com/permissions and run the script again (it asks for consent every time, so this only happens when the grant is cached).",
  );
  process.exit(1);
}

// Show which channel this token controls, so a wrong account is caught now and not after a week.
try {
  const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", {
    headers: { authorization: `Bearer ${tok.access_token}` },
  });
  const j = await r.json();
  const c = j.items?.[0];
  if (c) console.log(`Authorized channel: ${c.snippet?.title} (${c.id})`);
  else console.log(`Warning: channels.list returned no channel (HTTP ${r.status}). Is the YouTube Data API v3 enabled, and did you pick the channel's account?`);
} catch (e) {
  console.log(`Could not verify the channel: ${e.message}`);
}

console.log("\nRefresh token (store it as the GitHub secret YOUTUBE_REFRESH_TOKEN, do not commit it):\n");
console.log(tok.refresh_token);
console.log("\nReminder: in Testing status this token stops working after 7 days. Set the consent screen to In production first.\n");
