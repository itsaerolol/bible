// Derived view models. Pure functions, no fs, so client components can import them.
import { addDays, daysBetween, median } from "./format";
import type { DailyRow, Dataset, Episode, MetricKey, Metrics, RetentionPoint, Snapshot, VideoFile } from "./types";
import { METRIC_KEYS } from "./types";

export const MATURE_DAYS = 7;

// ---------- retention curve analysis ----------

export interface Drop {
  from: number; // t of window start (0..1)
  to: number;
  points: number; // percentage points of audience lost across the window
  fromSec: number;
  toSec: number;
  early: boolean;
}

export interface RetentionStats {
  at3s: number | null;
  at25: number | null;
  at50: number | null;
  at75: number | null;
  atEnd: number | null;
  /** biggest drops by size, clearly separate spans, always including the early drop */
  drops: Drop[];
  /** steepest window that starts in the first 30 percent of the video */
  earlyDrop: Drop | null;
}

const WINDOW = 0.05;
const EARLY_LIMIT = 0.3;

export function interpRatio(curve: RetentionPoint[], t: number): number | null {
  if (!curve.length) return null;
  if (t <= curve[0]!.t) return curve[0]!.audienceWatchRatio;
  for (let i = 1; i < curve.length; i++) {
    const b = curve[i]!;
    if (t <= b.t) {
      const a = curve[i - 1]!;
      const f = (t - a.t) / (b.t - a.t || 1);
      return a.audienceWatchRatio + f * (b.audienceWatchRatio - a.audienceWatchRatio);
    }
  }
  return curve[curve.length - 1]!.audienceWatchRatio;
}

export function retentionStats(curve: RetentionPoint[] | null | undefined, durationSec: number): RetentionStats | null {
  if (!curve || curve.length < 5) return null;
  const windows: Drop[] = [];
  for (const p of curve) {
    if (p.t + WINDOW > 1 + 1e-9) break;
    const end = interpRatio(curve, p.t + WINDOW);
    if (end == null) continue;
    const points = (p.audienceWatchRatio - end) * 100;
    windows.push({ from: p.t, to: p.t + WINDOW, points, fromSec: p.t * durationSec, toSec: (p.t + WINDOW) * durationSec, early: p.t <= EARLY_LIMIT });
  }
  const positive = windows.filter((w) => w.points >= 2);
  const earlyDrop = positive.filter((w) => w.early).sort((a, b) => b.points - a.points)[0] ?? null;
  // markers need to be clearly separate spans, not the shoulders of one steep drop
  const picked: Drop[] = [];
  for (const w of positive.filter((x) => x.points >= 4).sort((a, b) => b.points - a.points)) {
    if (picked.every((p) => Math.abs(p.from - w.from) >= 2 * WINDOW)) picked.push(w);
    if (picked.length === 3) break;
  }
  if (earlyDrop && !picked.some((p) => Math.abs(p.from - earlyDrop.from) < 2 * WINDOW)) picked.push(earlyDrop);
  const r = (t: number) => interpRatio(curve, t);
  return {
    at3s: durationSec >= 3 ? r(Math.min(1, 3 / durationSec)) : null,
    at25: r(0.25),
    at50: r(0.5),
    at75: r(0.75),
    atEnd: r(1),
    drops: picked,
    earlyDrop,
  };
}

/** Median watch ratio per 1% step across the given curves (needs at least 3). */
export function medianCurve(curves: RetentionPoint[][]): { points: Array<{ t: number; v: number }>; n: number } | null {
  if (curves.length < 3) return null;
  const points: Array<{ t: number; v: number }> = [];
  for (let k = 1; k <= 100; k++) {
    const t = k / 100;
    const m = median(curves.map((c) => interpRatio(c, t)));
    if (m != null) points.push({ t, v: m });
  }
  return { points, n: curves.length };
}

// ---------- per-video rows ----------

export interface VideoRow {
  id: string;
  title: string;
  publishedAt: string;
  publishedDate: string;
  durationSec: number;
  episodeId: string | null;
  hasEpisode: boolean;
  hookType: string | null;
  passage: string | null;
  topic: string | null;
  dsVersion: string | null;
  ageDays: number | null;
  mature: boolean;
  hasSnapshot: boolean;
  snapshotCount: number;
  snapshotDate: string | null;
  dataThrough: string | null;
  partial: boolean;
  m: Metrics;
  unavailable: string[];
  subsNet: number | null;
  engagedRate: number | null;
  likesPer1k: number | null;
  hasCurve: boolean;
  retentionSource: "api" | "csv" | null;
  at3s: number | null;
  atEnd: number | null;
  earlyDropPts: number | null;
}

export const EMPTY_METRICS: Metrics = Object.fromEntries(METRIC_KEYS.map((k) => [k, null])) as Metrics;

const clean = (s: string | undefined | null) => (s && s.trim() ? s.trim() : null);

export function episodeFor(v: VideoFile, episodes: Episode[]): Episode | null {
  if (v.episode_id) {
    const e = episodes.find((x) => x.id === v.episode_id);
    if (e) return e;
  }
  return episodes.find((x) => x.youtube_id === v.video_id) ?? null;
}

export function buildRow(v: VideoFile, ep: Episode | null, refDate: string | null): VideoRow {
  const snap: Snapshot | undefined = v.snapshots.at(-1);
  const pub = v.published_at.slice(0, 10);
  const ref = refDate ?? snap?.date ?? null;
  const age = ref ? daysBetween(pub, ref) : null;
  const m = snap?.metrics ?? EMPTY_METRICS;
  const gained = m.subscribersGained;
  const lost = m.subscribersLost;
  const stats = retentionStats(snap?.retention_curve, v.duration_sec);
  return {
    id: v.video_id,
    title: v.title,
    publishedAt: v.published_at,
    publishedDate: pub,
    durationSec: v.duration_sec,
    episodeId: ep?.id ?? v.episode_id,
    hasEpisode: !!ep,
    hookType: clean(ep?.hook_type),
    passage: clean(ep?.passage),
    topic: clean(ep?.topic),
    dsVersion: clean(ep?.design_system_version),
    ageDays: age,
    mature: age != null && age >= MATURE_DAYS,
    hasSnapshot: !!snap,
    snapshotCount: v.snapshots.length,
    snapshotDate: snap?.date ?? null,
    dataThrough: snap?.data_through ?? null,
    partial: !!snap?.partial,
    m,
    unavailable: snap?.unavailable ?? [],
    subsNet: gained != null && lost != null ? gained - lost : null,
    engagedRate: m.engagedViews != null && m.views != null && m.views > 0 ? m.engagedViews / m.views : null,
    likesPer1k: m.likes != null && m.views != null && m.views > 0 ? (m.likes / m.views) * 1000 : null,
    hasCurve: !!snap?.retention_curve,
    retentionSource: snap?.retention_source ?? null,
    at3s: stats?.at3s ?? null,
    atEnd: stats?.atEnd ?? null,
    earlyDropPts: stats?.earlyDrop?.points ?? null,
  };
}

export function buildRows(ds: Dataset): VideoRow[] {
  return ds.videos.map((v) => buildRow(v, episodeFor(v, ds.episodes), ds.refDate));
}

// ---------- channel windows ----------

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export type DailyKey = Exclude<keyof DailyRow, "date">;

export function dailySeries(daily: DailyRow[], key: DailyKey, from: string, to: string): Array<number | null> {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  return dateRange(from, to).map((d) => byDate.get(d)?.[key] ?? null);
}

export function netSubs(daily: DailyRow[], from: string, to: string): Array<number | null> {
  const g = dailySeries(daily, "subscribersGained", from, to);
  const l = dailySeries(daily, "subscribersLost", from, to);
  return g.map((x, i) => (x != null && l[i] != null ? x - (l[i] as number) : null));
}

export interface WindowTotal {
  total: number | null;
  present: number;
  days: number;
}

export function totalOf(series: Array<number | null>): WindowTotal {
  const vals = series.filter((x): x is number => x != null);
  return { total: vals.length ? vals.reduce((a, b) => a + b, 0) : null, present: vals.length, days: series.length };
}

export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function weightedMean(items: Array<{ v: number | null; w: number | null }>): number | null {
  let sw = 0;
  let s = 0;
  for (const { v, w } of items) {
    if (v == null || w == null || w <= 0) continue;
    sw += w;
    s += v * w;
  }
  return sw > 0 ? s / sw : null;
}

export function metricValue(row: VideoRow, key: MetricKey): number | null {
  return row.m[key];
}
