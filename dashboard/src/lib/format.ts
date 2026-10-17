// Number and date formatting. Pure, usable on server and client. Dates are always UTC so a static
// build and the browser agree.

const NA = "Unavailable";
export { NA };

export function fmtInt(n: number | null | undefined): string {
  return n == null ? NA : Math.round(n).toLocaleString("en-US");
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null) return NA;
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 10_000) return `${(n / 1000).toFixed(0)}K`;
  if (a >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function fmtPct(n: number | null | undefined, dp = 1): string {
  return n == null ? NA : `${n.toFixed(dp)}%`;
}

/** ratio 0..1+ to percent string */
export function fmtRatio(r: number | null | undefined, dp = 0): string {
  return r == null ? NA : `${(r * 100).toFixed(dp)}%`;
}

/** seconds to m:ss */
export function fmtClock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return NA;
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** seconds with one decimal for short durations */
export function fmtSeconds(sec: number | null | undefined): string {
  if (sec == null) return NA;
  return sec >= 60 ? fmtClock(sec) : `${sec.toFixed(sec < 10 ? 1 : 0)}s`;
}

/** minutes watched to a readable string: 42 min, 12.4 h */
export function fmtWatch(minutes: number | null | undefined): string {
  if (minutes == null) return NA;
  if (minutes < 120) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
  const h = minutes / 60;
  return `${h.toFixed(h < 100 ? 1 : 0)} h`;
}

export function fmtSigned(n: number | null | undefined, dp = 0): string {
  if (n == null) return NA;
  const v = Number(n.toFixed(dp));
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(d: string | null | undefined, withYear = false): string {
  if (!d) return NA;
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return NA;
  return `${MONTHS[m - 1]} ${day}${withYear ? `, ${y}` : ""}`;
}

export function fmtDateTimeUtc(iso: string | null | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return `${fmtDate(iso, true)}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

export function addDays(d: string, n: number): string {
  const x = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function ageLabel(days: number | null): string {
  if (days == null) return NA;
  if (days <= 0) return "today";
  if (days === 1) return "1 day old";
  return `${days} days old`;
}

export const TRAFFIC_LABELS: Record<string, string> = {
  SHORTS: "Shorts feed",
  YT_SEARCH: "YouTube search",
  SUBSCRIBER: "Subscribers",
  EXT_URL: "External links",
  YT_CHANNEL: "Channel page",
  RELATED_VIDEO: "Suggested videos",
  NOTIFICATION: "Notifications",
  NO_LINK_OTHER: "Direct or unknown",
  NO_LINK_EMBEDDED: "Embedded players",
  YT_OTHER_PAGE: "Other YouTube pages",
  PLAYLIST: "Playlists",
  ADVERTISING: "Advertising",
  HASHTAGS: "Hashtag pages",
  SOUND_PAGE: "Sound pages",
  CAMPAIGN_CARD: "Campaign cards",
  END_SCREEN: "End screens",
  PRODUCT_PAGE: "Product pages",
  LIVE_REDIRECT: "Live redirects",
  CONTENT_FEED: "Content feed",
  SHORTS_CONTENT_LINKS: "Shorts content links",
  VIDEO_REMIXES: "Remixes",
  YT_PLAYLIST_PAGE: "Playlist pages",
};

export function trafficLabel(code: string): string {
  return TRAFFIC_LABELS[code] ?? code.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function median(values: Array<number | null | undefined>): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}
