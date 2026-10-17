// Thin YouTube Data API v3 + YouTube Analytics API v2 client with two transports:
//   realTransport(creds)    -> global fetch, OAuth refresh token, retry with backoff
//   fixtureTransport(dir)   -> reads canned API responses from a folder (offline tests)
//
// Endpoints (checked against developers.google.com/youtube on 2026-10-17):
//   Data API       GET https://www.googleapis.com/youtube/v3/{channels|playlistItems|videos}
//   Analytics API  GET https://youtubeanalytics.googleapis.com/v2/reports   (reports.query)
//   Token          POST https://oauth2.googleapis.com/token
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const DATA_API = "https://www.googleapis.com/youtube/v3";
export const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/reports";

export class ApiError extends Error {
  constructor(status, message, { reason = null, api = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
    this.api = api;
  }
  get short() {
    return `HTTP ${this.status}${this.reason ? ` ${this.reason}` : ""}: ${this.message}`.slice(0, 300);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function errorFromBody(status, body, api) {
  const e = body && body.error;
  if (e && typeof e === "object") {
    return new ApiError(status, e.message ?? "request failed", { reason: e.errors?.[0]?.reason ?? e.status ?? null, api });
  }
  if (typeof e === "string") return new ApiError(status, body.error_description ?? e, { reason: e, api });
  return new ApiError(status, typeof body === "string" ? body.slice(0, 200) : "request failed", { api });
}

export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw errorFromBody(res.status, body, "oauth");
  return { accessToken: body.access_token, scope: body.scope ?? "", expiresIn: body.expires_in ?? 3600 };
}

export async function realTransport(creds) {
  let { accessToken, scope } = await refreshAccessToken(creds);
  const granted = new Set(String(scope).split(/\s+/).filter(Boolean));
  const needed = ["https://www.googleapis.com/auth/yt-analytics.readonly", "https://www.googleapis.com/auth/youtube.readonly"];
  const missing = scope ? needed.filter((s) => !granted.has(s)) : [];

  async function get(url, params, api) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await fetch(u, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
      } catch (e) {
        if (attempt < 3) {
          await sleep(800 * 2 ** attempt);
          continue;
        }
        throw new ApiError(0, `network error: ${e.message}`, { api });
      }
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        ({ accessToken } = await refreshAccessToken(creds));
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        const ra = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 800 * 2 ** attempt + Math.random() * 300);
        continue;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) throw errorFromBody(res.status, body, api);
      return body;
    }
  }

  return {
    mode: "real",
    missingScopes: missing,
    data: (path, params) => get(`${DATA_API}/${path}`, params, "data"),
    analytics: (_label, params) => get(ANALYTICS_API, params, "analytics"),
  };
}

// Fixture layout (all JSON, same body shape as the real API):
//   data-channels.json                 channels.list response
//   data-playlistItems.json            first page; data-playlistItems.<pageToken>.json for later pages
//   data-videos.json                   videos.list response (filtered by the requested ids)
//   analytics-daily.json               channel daily series
//   analytics-videos.json              per-video lifetime table
//   analytics-traffic-<id>.json        traffic sources for one video
//   analytics-retention-<id>.json      retention curve for one video
// A fixture may contain "__status": 400 (with an "error" object) to simulate an HTTP error. A missing
// analytics-traffic/retention file simulates a response with no rows.
export function fixtureTransport(dir) {
  const read = (name) => {
    const p = join(dir, name);
    if (!existsSync(p)) return undefined;
    return JSON.parse(readFileSync(p, "utf8"));
  };
  const unwrap = (body, api) => {
    if (body && body.__status && body.__status >= 400) throw errorFromBody(body.__status, body, api);
    return body;
  };
  return {
    mode: "fixtures",
    missingScopes: [],
    async data(path, params) {
      if (path === "channels") return unwrap(read("data-channels.json") ?? { items: [] }, "data");
      if (path === "playlistItems") {
        const name = params.pageToken ? `data-playlistItems.${params.pageToken}.json` : "data-playlistItems.json";
        return unwrap(read(name) ?? { items: [] }, "data");
      }
      if (path === "videos") {
        const all = unwrap(read("data-videos.json") ?? { items: [] }, "data");
        const want = new Set(String(params.id ?? "").split(","));
        return { ...all, items: (all.items ?? []).filter((v) => want.has(v.id)) };
      }
      throw new Error(`fixture transport: unsupported data path ${path}`);
    },
    async analytics(label, params) {
      const empty = { kind: "youtubeAnalytics#resultTable", columnHeaders: [] };
      if (label === "daily") return unwrap(read("analytics-daily.json") ?? empty, "analytics");
      if (label === "videos") {
        const body = unwrap(read("analytics-videos.json") ?? empty, "analytics");
        return Number(params.startIndex ?? 1) > 1 ? { ...body, rows: [] } : body;
      }
      const m = label.match(/^(traffic|retention):(.+)$/);
      if (m) return unwrap(read(`analytics-${m[1]}-${m[2]}.json`) ?? empty, "analytics");
      throw new Error(`fixture transport: unsupported analytics label ${label}`);
    },
  };
}

// Analytics tables -> array of plain objects keyed by column name. Missing cells stay null.
export function tableToObjects(table) {
  const names = (table?.columnHeaders ?? []).map((h) => h.name);
  return (table?.rows ?? []).map((row) => {
    const o = {};
    names.forEach((n, i) => {
      const v = row[i];
      o[n] = v === undefined ? null : v;
    });
    return o;
  });
}

// "PT1M30S" -> 90, "P0DT0H0M45S" -> 45. Returns null when the string cannot be read.
export function parseIsoDuration(s) {
  const m = typeof s === "string" && s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return null;
  const [, d = 0, h = 0, mi = 0, sec = 0] = m;
  return Math.round(Number(d) * 86400 + Number(h) * 3600 + Number(mi) * 60 + Number(sec));
}
