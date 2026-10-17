// Validators for the generated files in data/ (contract: docs/schemas.md plus the "Schema notes" section).
// Each validator returns { errors: string[], warnings: string[] }.
import { isDateStr } from "./analytics-io.mjs";

export const VIDEO_METRICS = [
  "views",
  "engagedViews",
  "estimatedMinutesWatched",
  "averageViewDuration",
  "averageViewPercentage",
  "likes",
  "comments",
  "shares",
  "subscribersGained",
  "subscribersLost",
];
export const DAILY_METRICS = ["views", "engagedViews", "estimatedMinutesWatched", "subscribersGained", "subscribersLost"];

const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s));
const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const numOrNull = (n) => n === null || (isNum(n) && n >= 0);

function result() {
  const r = { errors: [], warnings: [] };
  r.err = (m) => r.errors.push(m);
  r.warn = (m) => r.warnings.push(m);
  return r;
}
const strip = (r) => ({ errors: r.errors, warnings: r.warnings });

export function validateChannel(c) {
  const r = result();
  if (!c || typeof c !== "object") return r.err("channel.json is not an object"), strip(r);
  if (!isIso(c.generated_at)) r.err("generated_at must be an ISO 8601 timestamp");
  if (typeof c.channel_id !== "string" || !c.channel_id) r.err("channel_id must be a non-empty string");
  if (!Array.isArray(c.daily)) return r.err("daily must be an array"), strip(r);
  let prev = "";
  c.daily.forEach((d, i) => {
    const at = `daily[${i}]`;
    if (!isDateStr(d?.date)) return r.err(`${at}.date must be YYYY-MM-DD`);
    if (d.date <= prev) r.err(`${at}.date ${d.date} is not strictly ascending`);
    prev = d.date;
    for (const k of DAILY_METRICS) if (!(k in d) || !numOrNull(d[k])) r.err(`${at}.${k} must be a number >= 0 or null`);
  });
  return strip(r);
}

export function validateVideo(v, fileId = null) {
  const r = result();
  if (!v || typeof v !== "object") return r.err("video file is not an object"), strip(r);
  if (typeof v.video_id !== "string" || !v.video_id) r.err("video_id must be a non-empty string");
  if (fileId && v.video_id !== fileId) r.err(`video_id "${v.video_id}" does not match file name "${fileId}"`);
  if (typeof v.title !== "string") r.err("title must be a string");
  if (!isIso(v.published_at)) r.err("published_at must be an ISO 8601 timestamp");
  if (!(isNum(v.duration_sec) && v.duration_sec > 0)) r.err("duration_sec must be a positive number");
  if (typeof v.is_short !== "boolean") r.err("is_short must be boolean");
  if (!(v.episode_id === null || typeof v.episode_id === "string")) r.err("episode_id must be a string or null");
  if (!Array.isArray(v.snapshots)) return r.err("snapshots must be an array"), strip(r);
  let prev = "";
  v.snapshots.forEach((s, i) => {
    const at = `snapshots[${i}]`;
    if (!isDateStr(s?.date)) return r.err(`${at}.date must be YYYY-MM-DD`);
    if (s.date <= prev) r.err(`${at}.date ${s.date} is not strictly ascending`);
    prev = s.date;
    if (s.data_through !== undefined && !isDateStr(s.data_through)) r.err(`${at}.data_through must be YYYY-MM-DD`);
    if (s.partial !== undefined && typeof s.partial !== "boolean") r.err(`${at}.partial must be boolean`);
    const un = Array.isArray(s.unavailable) ? s.unavailable : (r.err(`${at}.unavailable must be an array`), []);
    if (!s.metrics || typeof s.metrics !== "object") r.err(`${at}.metrics must be an object`);
    else {
      for (const k of VIDEO_METRICS) {
        if (!(k in s.metrics)) r.err(`${at}.metrics.${k} is missing (use null when unavailable)`);
        else if (!numOrNull(s.metrics[k])) r.err(`${at}.metrics.${k} must be a number >= 0 or null`);
        else if (s.metrics[k] === null && !un.includes(k)) r.err(`${at}.metrics.${k} is null but "${k}" is not listed in unavailable`);
      }
      if (isNum(s.metrics.averageViewPercentage) && s.metrics.averageViewPercentage > 100)
        r.warn(`${at}.metrics.averageViewPercentage is ${s.metrics.averageViewPercentage} (expected percent 0 to 100)`);
      if (isNum(s.metrics.engagedViews) && isNum(s.metrics.views) && s.metrics.engagedViews > s.metrics.views * 1.001)
        r.warn(`${at}: engagedViews exceeds views`);
    }
    // traffic sources
    if (s.traffic_sources === null) {
      if (!un.includes("traffic_sources")) r.err(`${at}.traffic_sources is null but not listed in unavailable`);
    } else if (!Array.isArray(s.traffic_sources)) r.err(`${at}.traffic_sources must be an array or null`);
    else
      s.traffic_sources.forEach((t, j) => {
        if (typeof t?.source !== "string" || !t.source) r.err(`${at}.traffic_sources[${j}].source must be a string`);
        if (!numOrNull(t?.views) || t?.views === undefined) r.err(`${at}.traffic_sources[${j}].views must be a number >= 0 or null`);
      });
    // retention
    if (s.retention_curve === null) {
      if (!un.includes("retention_curve")) r.err(`${at}.retention_curve is null but not listed in unavailable`);
      if (s.retention_source !== null && s.retention_source !== undefined) r.err(`${at}.retention_source must be null when retention_curve is null`);
    } else if (!Array.isArray(s.retention_curve) || s.retention_curve.length < 5) r.err(`${at}.retention_curve must be null or an array of at least 5 points`);
    else {
      if (!["api", "csv"].includes(s.retention_source)) r.err(`${at}.retention_source must be "api" or "csv"`);
      if (un.includes("retention_curve")) r.err(`${at}: retention_curve present but also listed in unavailable`);
      let pt = -1;
      s.retention_curve.forEach((p, j) => {
        if (!(isNum(p?.t) && p.t >= 0 && p.t <= 1)) return r.err(`${at}.retention_curve[${j}].t must be between 0 and 1`);
        if (p.t <= pt) r.err(`${at}.retention_curve[${j}].t is not ascending`);
        pt = p.t;
        if (!(isNum(p.audienceWatchRatio) && p.audienceWatchRatio >= 0)) r.err(`${at}.retention_curve[${j}].audienceWatchRatio must be a number >= 0`);
        if (!(p.relativeRetentionPerformance === null || (isNum(p.relativeRetentionPerformance) && p.relativeRetentionPerformance >= 0 && p.relativeRetentionPerformance <= 1)))
          r.err(`${at}.retention_curve[${j}].relativeRetentionPerformance must be null or between 0 and 1`);
      });
    }
  });
  return strip(r);
}

export function validateInsights(x) {
  const r = result();
  if (!x || typeof x !== "object") return r.err("insights.json is not an object"), strip(r);
  if (!isIso(x.generated_at)) r.err("generated_at must be an ISO 8601 timestamp");
  if (typeof x.model !== "string" || !x.model) r.err("model must be a non-empty string");
  const b = x.based_on;
  if (!b || !Number.isInteger(b.videos) || b.videos < 0) r.err("based_on.videos must be an integer >= 0");
  if (!b || !Array.isArray(b.date_range) || b.date_range.length !== 2 || !b.date_range.every(isDateStr)) r.err("based_on.date_range must be [YYYY-MM-DD, YYYY-MM-DD]");
  if (typeof x.summary !== "string") r.err("summary must be a string");
  if (!Array.isArray(x.recommendations)) r.err("recommendations must be an array");
  else
    x.recommendations.forEach((rec, i) => {
      const at = `recommendations[${i}]`;
      if (typeof rec?.title !== "string" || !rec.title) r.err(`${at}.title must be a non-empty string`);
      if (typeof rec?.rationale !== "string" || !rec.rationale) r.err(`${at}.rationale must be a non-empty string`);
      if (!Array.isArray(rec?.evidence) || !rec.evidence.every((e) => typeof e === "string")) r.err(`${at}.evidence must be an array of video ids`);
      else if (!rec.evidence.length) r.warn(`${at} cites no evidence`);
      if (!["low", "medium", "high"].includes(rec?.confidence)) r.err(`${at}.confidence must be low, medium or high`);
    });
  if (!Array.isArray(x.caveats) || !x.caveats.every((c) => typeof c === "string")) r.err("caveats must be an array of strings");
  return strip(r);
}

export function validateEpisodesIndex(x) {
  const r = result();
  if (!x || typeof x !== "object") return r.err("episodes-index.json is not an object"), strip(r);
  if (!isIso(x.generated_at)) r.err("generated_at must be an ISO 8601 timestamp");
  if (!Array.isArray(x.episodes)) return r.err("episodes must be an array"), strip(r);
  const seen = new Set();
  x.episodes.forEach((e, i) => {
    if (typeof e?.id !== "string" || !e.id) return r.err(`episodes[${i}].id must be a non-empty string`);
    if (seen.has(e.id)) r.err(`duplicate episode id ${e.id}`);
    seen.add(e.id);
  });
  return strip(r);
}
