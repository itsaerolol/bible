#!/usr/bin/env node
// Generate obviously fake sample data into data/ so the dashboard has something to show before the first
// real sync. Deterministic: same output every run (seeded PRNG, fixed "now").
//
//   node scripts/make-mock-data.mjs [--out data] [--now 2026-10-17T09:17:00Z] [--force]
//
// Writes: data/.mock, data/episodes-index.json, data/insights.json, data/analytics/channel.json,
//         data/analytics/sync-status.json, data/analytics/videos/MOCK_0001..MOCK_0013.json
// Every id starts with MOCK_ and every title with "[MOCK]". The first real sync deletes data/.mock and the
// fabricated files (scripts/sync-analytics.mjs). The script refuses to run over real data.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { addDays, daysBetween, isoDate, median, parseArgs, round, writeJson } from "./lib/analytics-io.mjs";
import { VIDEO_METRICS, validateChannel, validateInsights, validateVideo } from "./lib/schema-check.mjs";

const root = resolve(import.meta.dirname, "..");
const args = parseArgs(process.argv.slice(2), { out: "string", now: "string", force: "bool" });
const outDir = resolve(root, args.out ?? "data");
const now = new Date(args.now ?? "2026-10-17T09:17:00Z");
const syncDate = isoDate(now);
const LAG = 3;
const dataThrough = addDays(syncDate, -LAG);

// ---- guard: never overwrite real data ----
const vdir = join(outDir, "analytics", "videos");
if (existsSync(vdir) && !existsSync(join(outDir, ".mock")) && !args.force) {
  const real = readdirSync(vdir).filter((f) => f.endsWith(".json") && !f.startsWith("MOCK_"));
  if (real.length) {
    console.error(`Refusing to run: ${vdir} holds ${real.length} real video file(s) and data/.mock does not exist. Pass --force to override.`);
    process.exit(1);
  }
}

// ---- seeded PRNG ----
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261017);
const U = (a, b) => a + (b - a) * rnd();
const N = (m, s) => m + s * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---- the cast ----
const CAST = [
  ["2026-09-14T14:00:00Z", 41, "[MOCK] Worry and the next small step", "Matthew 6:25-34", "worry", "question", "Are you worried right now?", "What are you carrying that was never yours to carry?", "Tests whether a question hook holds viewers past 3 seconds."],
  ["2026-09-16T14:00:00Z", 33, "[MOCK] Why rest is obedience", "Exodus 20:8-11", "rest", "bold-claim", "Rest is not laziness. It is trust.", "Rest is not laziness. It is trust.", "Tests a short bold claim against a longer setup."],
  ["2026-09-18T14:00:00Z", 58, "[MOCK] The older brother", "Luke 15:25-32", "grace", "story", "Everyone talks about the younger son.", "He never left home and was still lost.", "Tests whether a story opening survives a 58 second cut."],
  ["2026-09-21T14:00:00Z", 29, "[MOCK] Psalm 23 in one breath", "Psalm 23:1-4", "comfort", "verse-first", "The Lord is my shepherd.", "The Lord is my shepherd.", "Tests a verse-first opening with no setup."],
  ["2026-09-23T14:00:00Z", 47, "[MOCK] Faith is not certainty", "Hebrews 11:1-3", "faith", "contrast", "Faith is not certainty.", "Certainty needs no faith. So what is faith?", "Tests a contrast hook with a question follow-up."],
  ["2026-09-25T14:00:00Z", 52, "[MOCK] When prayer feels empty", "Romans 8:26-27", "prayer", "question", "Ever feel like your prayers hit the ceiling?", "What do you pray when you have no words?", "Tests a softer question hook."],
  ["2026-09-29T14:00:00Z", 38, "[MOCK] Small seeds", "Mark 4:30-32", "patience", "story", "A farmer once planted the smallest seed he had.", "The smallest seed in the garden became the biggest plant.", "Tests a shorter story opening."],
  ["2026-10-01T14:00:00Z", 44, "[MOCK] The slow answer", "Proverbs 15:1-4", "anger", "bold-claim", "Your tone is the argument.", "Your tone is the argument.", "Tests a bold claim on a practical topic."],
  ["2026-10-05T14:00:00Z", 36, "[MOCK] Forgiveness starts as a decision", "Colossians 3:12-14", "forgiveness", "contrast", "Forgiving is not feeling better.", "Forgiving is not a feeling. It is a decision.", "Tests contrast plus faster cuts."],
  ["2026-10-08T14:00:00Z", 61, "[MOCK] What are you building on?", "Matthew 7:24-27", "foundations", "question", "What is your life built on?", "Storm coming. What is your house built on?", "Tests a question hook on a longer cut."],
  ["2026-10-12T14:00:00Z", 49, "[MOCK] The quiet of Elijah", "1 Kings 19:11-13", "stillness", "story", "Elijah expected fire.", "Elijah expected fire. He got a whisper.", "Tests a story hook with a payoff in line two."],
  ["2026-10-14T16:00:00Z", 43, "[MOCK] Gratitude in a hard week", "1 Thessalonians 5:16-18", "gratitude", "verse-first", "Give thanks in all circumstances.", "Give thanks in all circumstances. All of them?", "Tests a verse-first opening with a question tag."],
  ["2026-10-16T14:00:00Z", 35, "[MOCK] Loving the unlovable", "Luke 6:27-36", "love", "other", "Love your enemies.", "Love your enemies. Yes, those ones.", "Tests an unusual opening."],
];
const VERSIONS = ["0.1.0", "0.1.0", "0.1.0", "0.1.0", "0.2.0", "0.2.0", "0.2.0", "0.2.0", "0.3.0", "0.3.0", "0.3.0", "0.3.0", "0.3.0"];
const HOOK_D1 = { question: 0.28, "bold-claim": 0.34, story: 0.38, "verse-first": 0.42, contrast: 0.32, other: 0.38 };
const VER_ADJ = { "0.1.0": 0, "0.2.0": -0.03, "0.3.0": -0.05 };
const NO_RETENTION = new Set([2, 6]); // 0-based: MOCK_0003, MOCK_0007 never return a curve
const CSV_RETENTION = 4; // MOCK_0005 has a csv curve on its latest snapshot
const NO_TRAFFIC = new Set([6]);
const NO_LIKES = new Set([2]);
const SOURCES = [
  ["SHORTS", 0.74],
  ["YT_SEARCH", 0.07],
  ["SUBSCRIBER", 0.06],
  ["EXT_URL", 0.04],
  ["YT_CHANNEL", 0.03],
  ["RELATED_VIDEO", 0.025],
  ["NOTIFICATION", 0.015],
  ["NO_LINK_OTHER", 0.01],
];

const vids = CAST.map((c, i) => {
  const [published, dur, title, passage, topic, hook, hookOrig, hookFinal, hypothesis] = c;
  const ver = VERSIONS[i];
  const viral = i === 3 ? 4.2 : i === 7 ? 0.45 : 1;
  const vInf = Math.round(Math.exp(N(Math.log(2600), 0.35)) * viral);
  const noise = Array.from({ length: 100 }, () => N(0, 0.004));
  return {
    i,
    id: `MOCK_${String(i + 1).padStart(4, "0")}`,
    episodeId: `${published.slice(0, 10)}-mock-${topic}`,
    published,
    pubDate: published.slice(0, 10),
    dur,
    title,
    passage,
    topic,
    hook,
    hookOrig,
    hookFinal,
    hypothesis: `[MOCK] ${hypothesis}`,
    ver,
    vInf,
    tau: U(2.5, 5.5),
    er: U(0.55, 0.7),
    likeRate: U(0.028, 0.055),
    commentRate: U(0.0012, 0.004),
    shareRate: U(0.004, 0.012),
    subRate: U(0.003, 0.009),
    lostRate: U(0.12, 0.3),
    d1: clamp(HOOK_D1[hook] + VER_ADJ[ver] + N(0, 0.03), 0.12, 0.55),
    tau1: U(0.035, 0.07),
    slope: clamp(0.3 + N(0, 0.05) + (dur - 40) / 400, 0.15, 0.5),
    dipAt: U(0.35, 0.7),
    dipDepth: U(0.02, 0.06),
    bump: rnd() < 0.5 ? U(0.02, 0.07) : 0,
    start: 1 + U(0, 0.04),
    noise,
    shares: SOURCES.map(([s, p]) => [s, Math.max(0.002, p * U(0.7, 1.3))]),
  };
});

function curve(v, ageDays) {
  const s = v.slope + 0.05 * (1 - Math.exp(-ageDays / 8));
  const pts = [];
  for (let k = 1; k <= 100; k++) {
    const t = k / 100;
    let r = v.start * (1 - v.d1 * (1 - Math.exp(-t / v.tau1))) * (1 - s * t);
    r -= v.dipDepth * Math.exp(-(((t - v.dipAt) / 0.03) ** 2));
    r += v.bump / (1 + Math.exp(-(t - 0.92) / 0.015));
    r += v.noise[k - 1];
    pts.push([t, clamp(r, 0.02, 1.08)]);
  }
  return pts;
}
const bench = (t) => 0.4 + 0.6 * Math.exp(-t * 5.5);

const cumViews = (v, eDays) => (eDays <= 0 ? 0 : v.vInf * (1 - Math.exp(-eDays / v.tau)));

function snapshotFor(v, syncD) {
  const through = addDays(syncD, -LAG);
  const e = daysBetween(v.pubDate, through) + 1; // days of data, publish day counts as day 1
  const age = daysBetween(v.pubDate, syncD);
  const views = Math.max(1, Math.round(cumViews(v, e)));
  const pts = curve(v, age);
  const meanRatio = pts.reduce((n, [, r]) => n + r, 0) / pts.length;
  const avgPct = round(clamp(meanRatio * 100 * (1 + 0.05 * Math.exp(-age / 6)), 5, 99.9), 2);
  const avd = round((avgPct / 100) * v.dur, 1);
  const engaged = Math.round(views * clamp(v.er + 0.02 * Math.exp(-age / 5), 0, 1));
  const subsG = Math.round(views * v.subRate);
  const metrics = {
    views,
    engagedViews: engaged,
    estimatedMinutesWatched: round((views * avd) / 60, 1),
    averageViewDuration: avd,
    averageViewPercentage: avgPct,
    likes: Math.round(views * v.likeRate),
    comments: Math.round(views * v.commentRate),
    shares: Math.round(views * v.shareRate),
    subscribersGained: subsG,
    subscribersLost: Math.round(subsG * v.lostRate),
  };
  const unavailable = [];
  if (NO_LIKES.has(v.i)) {
    metrics.likes = null;
    unavailable.push("likes");
  }
  // traffic
  let traffic = null;
  if (NO_TRAFFIC.has(v.i)) unavailable.push("traffic_sources");
  else {
    const tot = v.shares.reduce((n, [, p]) => n + p, 0);
    traffic = v.shares.map(([source, p]) => {
      const vw = Math.round((views * p) / tot);
      const erS = source === "SHORTS" ? v.er : source === "SUBSCRIBER" ? 0.85 : 0.75;
      return { source, views: vw, engagedViews: Math.round(vw * erS), estimatedMinutesWatched: round((vw * avd * (source === "SUBSCRIBER" ? 1.2 : 0.95)) / 60, 1) };
    });
    traffic[0].views += views - traffic.reduce((n, t) => n + t.views, 0);
    traffic.sort((a, b) => b.views - a.views);
  }
  // retention
  let rc = null;
  let source = null;
  let note;
  const latestSync = syncD === syncDate;
  if (NO_RETENTION.has(v.i) || age <= 4) {
    unavailable.push("retention_curve");
    note = NO_RETENTION.has(v.i) ? "api_empty: HTTP 200 with no usable rows" : "api_empty: too new, retention data lags 1 to 2 days";
  } else {
    rc = pts.map(([t, r]) => ({
      t,
      audienceWatchRatio: round(r, 4),
      relativeRetentionPerformance: round(clamp(0.5 + (r - bench(t)) * 1.1, 0.02, 0.98), 4),
    }));
    source = v.i === CSV_RETENTION && latestSync ? "csv" : "api";
  }
  const snap = { date: syncD, data_through: through, partial: daysBetween(v.pubDate, through) < 2, metrics, traffic_sources: traffic, retention_curve: rc, retention_source: source, unavailable };
  if (note) snap.retention_note = note;
  if (source === "csv") snap.retention_csv = `episodes/${v.episodeId}/retention.csv`;
  return snap;
}

// snapshot dates follow the sync cadence: days 3,4,5,7,10,14 then weekly, plus the newest sync
function syncDates(v) {
  const maxAge = daysBetween(v.pubDate, syncDate);
  const ages = [3, 4, 5, 7, 10, 14, 21, 28, 35].filter((a) => a <= maxAge);
  if (maxAge >= 3 && !ages.includes(maxAge)) ages.push(maxAge);
  return ages.map((a) => addDays(v.pubDate, a));
}

const videoFiles = vids.map((v) => ({
  video_id: v.id,
  title: v.title,
  published_at: v.published,
  duration_sec: v.dur,
  is_short: true,
  episode_id: v.episodeId,
  snapshots: syncDates(v).map((d) => snapshotFor(v, d)),
}));

// ---- channel daily ----
const firstDay = "2026-06-01";
const daily = [];
for (let d = firstDay; d <= dataThrough; d = addDays(d, 1)) {
  const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
  let views = (40 + 0.25 * daysBetween(firstDay, d)) * (dow === 0 ? 1.25 : dow === 6 ? 1.1 : 1) * N(1, 0.12);
  let minutes = (views * 17) / 60;
  for (const v of vids) {
    const e = daysBetween(v.pubDate, d) + 1;
    if (e < 1) continue;
    const dv = cumViews(v, e) - cumViews(v, e - 1);
    views += dv;
    const snap = videoFiles[v.i].snapshots.at(-1);
    minutes += (dv * (snap?.metrics.averageViewDuration ?? 18)) / 60;
  }
  views = Math.max(1, Math.round(views));
  const subsG = Math.max(0, Math.round(views * 0.0055 * U(0.6, 1.4)));
  daily.push({
    date: d,
    views,
    engagedViews: Math.round(views * clamp(N(0.62, 0.03), 0.4, 0.9)),
    estimatedMinutesWatched: round(minutes, 1),
    subscribersGained: subsG,
    subscribersLost: Math.round(subsG * U(0.1, 0.35)),
  });
}
const channel = { generated_at: now.toISOString(), channel_id: "MOCK_CHANNEL", daily };

// ---- episodes index ----
const episodes = vids.map((v) => ({
  id: v.episodeId,
  title: v.title,
  status: "posted",
  passage: v.passage,
  translation: "ESV",
  topic: v.topic,
  hook_type: v.hook,
  hook_original: v.hookOrig,
  hook_final: v.hookFinal,
  design_system_version: v.ver,
  duration_sec: v.dur,
  youtube_id: v.id,
  posted_at: v.published,
  hypothesis: v.hypothesis,
  effort: { revisions: Math.round(U(0, 4)), edit_minutes: Math.round(U(25, 95)) },
  media: [],
}));
const episodesIndex = { generated_at: now.toISOString(), episodes };

// ---- insights computed from the mock numbers so the text matches the charts ----
function early(snap, dur) {
  const c = snap.retention_curve;
  if (!c) return null;
  let best = 0;
  for (const p of c) {
    if (p.t > 0.3) break;
    const tgt = p.t + 0.05;
    const q = c.find((x) => x.t >= tgt - 1e-9) ?? c.at(-1);
    best = Math.max(best, p.audienceWatchRatio - q.audienceWatchRatio);
  }
  return best * 100;
}
const rows = videoFiles
  .filter((f) => f.snapshots.length)
  .map((f, k) => {
    const s = f.snapshots.at(-1);
    const v = vids.find((x) => x.id === f.video_id);
    return { f, s, v, age: daysBetween(f.published_at.slice(0, 10), s.data_through), drop: early(s, f.duration_sec) };
  });
const mature = rows.filter((r) => r.age >= 7);
const med = (a) => median(a);
const group = (key) => {
  const m = new Map();
  for (const r of mature) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};
const byHook = group((r) => r.v.hook);
const q = byHook.get("question") ?? [];
const vf = byHook.get("verse-first") ?? [];
const fmt = (n, dp = 1) => (n === null || Number.isNaN(n) ? "n/a" : n.toFixed(dp));
const short = mature.filter((r) => r.f.duration_sec < 45);
const long = mature.filter((r) => r.f.duration_sec >= 45);
const dips = mature.filter((r) => r.v.dipDepth >= 0.04 && r.s.retention_curve).map((r) => r.v);
const recs = [];
if (q.length && vf.length) {
  recs.push({
    title: "Compare how question hooks and verse-first hooks open",
    rationale: `[MOCK] In this sample, question hooks (n=${q.length}) tended to lose fewer points in their steepest early span than verse-first hooks (n=${vf.length}): median ${fmt(med(q.map((r) => r.drop).filter((x) => x !== null)))} vs ${fmt(med(vf.map((r) => r.drop).filter((x) => x !== null)))} points. The gap is small and the groups differ in topic and date, so treat it as a prompt to test, not a result.`,
    evidence: [...q, ...vf].slice(0, 6).map((r) => r.f.video_id),
    confidence: "low",
  });
}
if (short.length && long.length) {
  recs.push({
    title: "Try tighter cuts under 45 seconds on the next two videos",
    rationale: `[MOCK] Videos under 45s (n=${short.length}) had a median average % viewed of ${fmt(med(short.map((r) => r.s.metrics.averageViewPercentage)))} vs ${fmt(med(long.map((r) => r.s.metrics.averageViewPercentage)))} for 45s and longer (n=${long.length}). Shorter videos usually score higher on this metric by construction, so judge on watch time per view as well.`,
    evidence: [...short.slice(0, 3), ...long.slice(0, 2)].map((r) => r.f.video_id),
    confidence: "low",
  });
}
if (dips.length >= 2) {
  recs.push({
    title: "Check pacing near the middle of the video",
    rationale: `[MOCK] ${dips.length} mature videos show a visible dip in the retention curve between 35% and 70% of the video. Reviewing the cut at those points for a pause, a long caption, or a visual that repeats may help. Cause is unknown from this data.`,
    evidence: dips.slice(0, 4).map((v) => v.id),
    confidence: "low",
  });
}
const noCurve = rows.filter((r) => !r.s.retention_curve && r.age >= 5).map((r) => r.f.video_id);
const insights = {
  generated_at: new Date(now.getTime() + 4 * 60_000).toISOString(),
  model: "mock-sample (not a real model run)",
  based_on: { videos: rows.length, date_range: [vids[0].pubDate, dataThrough] },
  summary: `[MOCK] Fabricated sample advice. ${rows.length} videos with data, ${mature.length} older than 7 days. Directional only: differences between groups are small and the groups overlap in topic and date.`,
  recommendations: recs,
  caveats: [
    `Sample: n=${rows.length} videos with data, ${mature.length} older than 7 days.`,
    "[MOCK] This file is fabricated by scripts/make-mock-data.mjs.",
    noCurve.length ? `${noCurve.length} older videos have no retention curve (${noCurve.join(", ")}), so retention comparisons skip them.` : "All older videos have a retention curve.",
    "Hook type, design system version, topic, and posting date change together, so none of these comparisons isolate one cause.",
  ],
  sample: { videos: rows.length, mature_videos: mature.length },
};

// ---- sync status (mock) ----
const elig = rows.filter((r) => daysBetween(r.f.published_at.slice(0, 10), syncDate) >= 4);
const status = {
  generated_at: now.toISOString(),
  sync_date: syncDate,
  data_through: dataThrough,
  lag_days: LAG,
  mode: "mock",
  channel_id: "MOCK_CHANNEL",
  uploads_seen: vids.length,
  shorts_tracked: vids.length,
  long_form_skipped: 0,
  private_skipped: 0,
  snapshots_written: rows.length,
  snapshots_deferred: 0,
  videos_without_complete_data: vids.length - rows.length,
  videos_without_metrics: 0,
  retention: {
    eligible: elig.length,
    api_ok: elig.filter((r) => r.s.retention_source === "api").length,
    api_empty: elig.filter((r) => !r.s.retention_curve).length,
    api_error: 0,
    csv_carried: elig.filter((r) => r.s.retention_source === "csv").length,
    verdict: "works",
    first_error: null,
  },
  traffic: { ok: rows.length - 1, empty: 1, error: 0, first_error: null },
  episodes: { linked: vids.length, unmatched_youtube_ids: [] },
  notes: ["[MOCK] Fabricated status. The first real sync replaces it."],
};

// ---- validate, then write ----
let bad = 0;
const chk = (name, r) => {
  for (const e of r.errors) {
    console.error(`${name}: ${e}`);
    bad++;
  }
};
chk("channel", validateChannel(channel));
chk("insights", validateInsights(insights));
for (const f of videoFiles) chk(f.video_id, validateVideo(f, f.video_id));
if (bad) process.exit(1);

mkdirSync(vdir, { recursive: true });
for (const f of readdirSync(vdir)) if (f.startsWith("MOCK_")) rmSync(join(vdir, f));
for (const f of videoFiles) writeJson(join(vdir, `${f.video_id}.json`), f);
writeJson(join(outDir, "analytics", "channel.json"), channel);
writeJson(join(outDir, "analytics", "sync-status.json"), status);
writeJson(join(outDir, "episodes-index.json"), episodesIndex);
writeJson(join(outDir, "insights.json"), insights);
writeFileSync(join(outDir, ".mock"), "Fabricated sample data from scripts/make-mock-data.mjs. The first real sync deletes this file and the fake data.\n");

const nSnaps = videoFiles.reduce((n, f) => n + f.snapshots.length, 0);
console.log(`mock data written to ${outDir.replace(root + "/", "")}: ${videoFiles.length} videos, ${nSnaps} snapshots, ${daily.length} channel days, ${recs.length} insight recommendations`);
console.log(`metrics checked: ${VIDEO_METRICS.length}; data_through ${dataThrough}; latest sync ${syncDate}`);
