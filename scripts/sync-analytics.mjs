#!/usr/bin/env node
// Daily YouTube sync. Pulls the channel's uploads (Data API v3), keeps the Shorts, pulls per-video
// metrics, traffic sources and the retention curve plus a channel daily series (Analytics API v2,
// reports.query), and writes data/analytics/** per docs/schemas.md.
//
//   node scripts/sync-analytics.mjs                       real run (needs the 3 YOUTUBE_* env vars)
//   node scripts/sync-analytics.mjs --dry-run             real calls, nothing written
//   node scripts/sync-analytics.mjs --fixtures scripts/fixtures/youtube --dry-run
//   node scripts/sync-analytics.mjs --fixtures scripts/fixtures/youtube --out /tmp/data --purge-mock
//   Options: --now ISO, --lag-days N, --max-videos N, --include-long, --snapshot-policy daily|tiered,
//            --episodes path/to/episodes-index.json, --concurrency N
//
// Env: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN (see scripts/youtube-auth.mjs).
// If any is missing the script logs a notice and exits 0 without touching data/ (mock data keeps working).
//
// Facts this script relies on (official docs, checked 2026-10-17):
//  - Shorts: a video uploaded on or after 2024-10-15 is a Short when it is up to 3 minutes long and has a
//    square or vertical aspect ratio (support.google.com/youtube/answer/15424877). The API exposes no
//    aspect ratio, so Shorts are detected by duration only: duration_sec <= SHORTS_MAX_SEC (180).
//  - Data lag: analytics data is processed with a 48 to 72 hour delay (Analytics API data model, revised
//    2026-09-09). endDate is therefore today minus --lag-days (default 3). Videos published after that
//    date have no complete data yet, so they get no snapshot. Snapshots are dated with the sync date and
//    carry data_through; `partial: true` marks the first days of a video's life.
//  - Retention: dimension elapsedVideoTimeRatio, metrics audienceWatchRatio and
//    relativeRetentionPerformance, filter video==ID (single video only). The docs do not say whether
//    Shorts are supported, so every run records the outcome in data/analytics/sync-status.json.
//  - Since late August 2026 (the blog says Aug 24, the API changelog says Aug 27) public views count from the first frame; engagedViews keeps the older meaning.
//  - reports.query requires the youtube.readonly scope as well as yt-analytics.readonly.
import { existsSync, rmSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  addDays,
  daysBetween,
  isoDate,
  log,
  parseArgs,
  readJson,
  round,
  writeJson,
} from "./lib/analytics-io.mjs";
import { fixtureTransport, parseIsoDuration, realTransport, tableToObjects, ApiError } from "./lib/youtube-api.mjs";
import { DAILY_METRICS, VIDEO_METRICS, validateChannel, validateVideo } from "./lib/schema-check.mjs";

export const SHORTS_MAX_SEC = 180;

const root = resolve(import.meta.dirname, "..");

// ---------- pure helpers (exported for tests) ----------

// Daily for the first 14 days, weekly until day 90, monthly after. Keeps git history small.
export function snapshotDue({ ageDays, lastSnapshotDate, today, policy = "tiered" }) {
  if (policy === "daily" || !lastSnapshotDate) return true;
  const since = daysBetween(lastSnapshotDate, today);
  if (since <= 0) return true; // same-date snapshot is replaced
  if (ageDays <= 14) return true;
  if (ageDays <= 90) return since >= 7;
  return since >= 30;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function buildMetrics(row) {
  const m = {};
  const dp = { averageViewPercentage: 2, averageViewDuration: 1, estimatedMinutesWatched: 1 };
  for (const k of VIDEO_METRICS) {
    const v = row ? num(row[k]) : null;
    m[k] = v === null ? null : round(v, dp[k] ?? 0);
  }
  return m;
}

export function buildRetention(rows) {
  const pts = rows
    .map((r) => ({
      t: num(r.elapsedVideoTimeRatio),
      audienceWatchRatio: num(r.audienceWatchRatio),
      relativeRetentionPerformance: num(r.relativeRetentionPerformance),
    }))
    .filter((p) => p.t !== null && p.audienceWatchRatio !== null)
    .sort((a, b) => a.t - b.t)
    .map((p) => ({
      t: round(p.t, 4),
      audienceWatchRatio: round(p.audienceWatchRatio, 4),
      relativeRetentionPerformance: p.relativeRetentionPerformance === null ? null : round(Math.min(1, Math.max(0, p.relativeRetentionPerformance)), 4),
    }));
  return pts;
}

export function buildTraffic(rows) {
  return rows
    .filter((r) => typeof r.insightTrafficSourceType === "string")
    .map((r) => ({
      source: r.insightTrafficSourceType,
      views: num(r.views),
      engagedViews: num(r.engagedViews),
      estimatedMinutesWatched: num(r.estimatedMinutesWatched),
    }))
    .sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    dryRun: "bool",
    fixtures: "string",
    out: "string",
    episodes: "string",
    now: "string",
    lagDays: "number",
    shortsMaxSec: "number",
    includeLong: "bool",
    maxVideos: "number",
    snapshotPolicy: "string",
    purgeMock: "bool",
    dailyRefreshDays: "number",
    concurrency: "number",
  });
  const outDir = resolve(root, args.out ?? "data");
  const now = args.now ? new Date(args.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`--now is not a valid date: ${args.now}`);
  const syncDate = isoDate(now);
  const lagDays = args.lagDays ?? 3;
  const dataThrough = addDays(syncDate, -lagDays);
  const shortsMax = args.shortsMaxSec ?? SHORTS_MAX_SEC;
  const maxVideos = args.maxVideos ?? 300;
  const policy = args.snapshotPolicy ?? "tiered";
  const concurrency = args.concurrency ?? 3;
  const mockPath = join(outDir, ".mock");
  const dryRun = !!args.dryRun;

  // --- transport ---
  let transport;
  if (args.fixtures) {
    transport = fixtureTransport(resolve(root, args.fixtures));
    log.info(`mode: fixtures (${args.fixtures})`);
  } else {
    const { YOUTUBE_CLIENT_ID: clientId, YOUTUBE_CLIENT_SECRET: clientSecret, YOUTUBE_REFRESH_TOKEN: refreshToken } = process.env;
    if (!clientId || !clientSecret || !refreshToken) {
      log.notice(
        "YouTube credentials not set (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN). Skipping analytics sync. data/ is untouched; see docs/dashboard-setup.md.",
      );
      return;
    }
    try {
      transport = await realTransport({ clientId, clientSecret, refreshToken });
    } catch (e) {
      if (e instanceof ApiError && /invalid_grant/.test(`${e.reason} ${e.message}`)) {
        log.error(
          "Google rejected the refresh token (invalid_grant). If the OAuth consent screen is in Testing status, refresh tokens expire after 7 days. Publish the app (In production) and run scripts/youtube-auth.mjs again, then update the YOUTUBE_REFRESH_TOKEN secret. See docs/dashboard-setup.md.",
        );
      } else log.error(`could not get an access token: ${e.short ?? e.message}`);
      process.exit(1);
    }
    log.info("mode: real");
    if (transport.missingScopes.length)
      log.warn(`token is missing scope(s): ${transport.missingScopes.join(", ")}. Re-run scripts/youtube-auth.mjs.`);
  }

  const status = {
    generated_at: now.toISOString(),
    sync_date: syncDate,
    data_through: dataThrough,
    lag_days: lagDays,
    mode: transport.mode,
    channel_id: null,
    uploads_seen: 0,
    shorts_tracked: 0,
    long_form_skipped: 0,
    private_skipped: 0,
    snapshots_written: 0,
    snapshots_deferred: 0,
    videos_without_complete_data: 0,
    videos_without_metrics: 0,
    retention: { eligible: 0, api_ok: 0, api_empty: 0, api_error: 0, csv_carried: 0, verdict: "inconclusive", first_error: null },
    traffic: { ok: 0, empty: 0, error: 0, first_error: null },
    episodes: { linked: 0, unmatched_youtube_ids: [] },
    notes: [],
  };

  // --- channel and uploads (Data API v3) ---
  const ch = await transport.data("channels", { part: "id,snippet,contentDetails", mine: "true" });
  const channel = ch.items?.[0];
  if (!channel) {
    log.error("channels.list returned no channel for this token. If the channel belongs to a brand account, pick that account on the Google consent screen.");
    process.exit(1);
  }
  const channelId = channel.id;
  const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) {
    log.error("channel has no uploads playlist in contentDetails.relatedPlaylists");
    process.exit(1);
  }
  status.channel_id = channelId;
  log.info(`channel: ${channel.snippet?.title ?? "(untitled)"} (${channelId})`);

  const ids = [];
  let pageToken;
  do {
    const page = await transport.data("playlistItems", { part: "contentDetails", playlistId: uploadsId, maxResults: 50, pageToken });
    for (const it of page.items ?? []) {
      const id = it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId;
      if (id && !ids.includes(id)) ids.push(id);
    }
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < maxVideos);
  ids.length = Math.min(ids.length, maxVideos);
  status.uploads_seen = ids.length;

  const details = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await transport.data("videos", { part: "snippet,contentDetails,status", id: ids.slice(i, i + 50).join(","), maxResults: 50 });
    details.push(...(r.items ?? []));
  }

  const tracked = [];
  for (const v of details) {
    const durationSec = parseIsoDuration(v.contentDetails?.duration);
    const published = v.snippet?.publishedAt;
    if (!published || durationSec === null) {
      status.notes.push(`skipped ${v.id}: missing publishedAt or duration`);
      continue;
    }
    if (v.status?.privacyStatus === "private") {
      status.private_skipped++;
      continue;
    }
    const isShort = durationSec <= shortsMax;
    if (!isShort && !args.includeLong) {
      status.long_form_skipped++;
      continue;
    }
    tracked.push({
      id: v.id,
      title: v.snippet?.title ?? "",
      publishedAt: new Date(published).toISOString().replace(/\.\d{3}Z$/, "Z"),
      publishedDate: isoDate(new Date(published)),
      durationSec,
      isShort,
    });
  }
  tracked.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  status.shorts_tracked = tracked.filter((t) => t.isShort).length;
  log.info(`uploads: ${ids.length}, tracked: ${tracked.length} (Shorts <= ${shortsMax}s), long-form skipped: ${status.long_form_skipped}`);

  // --- episode link ---
  const idx = readJson(args.episodes ? resolve(root, args.episodes) : join(outDir, "episodes-index.json"), { episodes: [] });
  const byYoutube = new Map((idx.episodes ?? []).filter((e) => e.youtube_id).map((e) => [e.youtube_id, e.id]));
  const trackedIds = new Set(tracked.map((t) => t.id));
  status.episodes.unmatched_youtube_ids = [...byYoutube.keys()].filter((y) => !trackedIds.has(y));
  for (const y of status.episodes.unmatched_youtube_ids)
    log.warn(`episode ${byYoutube.get(y)} has youtube_id ${y}, but that video is not among the tracked uploads (wrong id, private, or not a Short)`);

  // --- first real sync clears the mock data ---
  const purge = existsSync(mockPath) && (transport.mode === "real" || args.purgeMock);
  const videosDir = join(outDir, "analytics", "videos");
  const existingFor = (id) => (purge ? null : readJson(join(videosDir, `${id}.json`), null));

  // --- Analytics: eligible videos and the due list ---
  const eligible = tracked.filter((t) => t.publishedDate <= dataThrough);
  status.videos_without_complete_data = tracked.length - eligible.length;

  const plan = tracked.map((t) => {
    const prev = existingFor(t.id);
    const ageDays = daysBetween(t.publishedDate, syncDate);
    const last = prev?.snapshots?.at(-1)?.date ?? null;
    const complete = t.publishedDate <= dataThrough;
    const due = complete && snapshotDue({ ageDays, lastSnapshotDate: last, today: syncDate, policy });
    return { t, prev, ageDays, due, complete };
  });

  const analyticsBase = { ids: "channel==MINE", endDate: dataThrough };
  const metricList = (list) => list.join(",");

  async function query(label, params, dropOnBadRequest = []) {
    // On HTTP 400 retry once without the newest metrics (engagedViews) so an older API surface still works.
    try {
      return { table: await transport.analytics(label, params), dropped: [] };
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 400 || !dropOnBadRequest.length) throw e;
      const kept = String(params.metrics).split(",").filter((m) => !dropOnBadRequest.includes(m));
      const table = await transport.analytics(label, { ...params, metrics: kept.join(",") });
      return { table, dropped: dropOnBadRequest };
    }
  }

  // channel daily series
  let daily = existingChannelDaily();
  function existingChannelDaily() {
    if (purge) return [];
    return readJson(join(outDir, "analytics", "channel.json"), { daily: [] }).daily ?? [];
  }
  if (eligible.length) {
    const earliest = eligible.reduce((m, t) => (t.publishedDate < m ? t.publishedDate : m), eligible[0].publishedDate);
    const start = daily.length ? addDays(dataThrough, -(args.dailyRefreshDays ?? 45)) : [addDays(earliest, -1), addDays(dataThrough, -730)].sort().at(-1);
    if (start <= dataThrough) {
      const { table, dropped } = await query(
        "daily",
        { ...analyticsBase, startDate: start, dimensions: "day", metrics: metricList(DAILY_METRICS), sort: "day" },
        ["engagedViews"],
      );
      if (dropped.length) status.notes.push(`channel daily: API rejected ${dropped.join(", ")}; stored as null`);
      const fresh = tableToObjects(table)
        .filter((r) => typeof r.day === "string" && r.day <= dataThrough)
        .map((r) => ({
          date: r.day,
          views: num(r.views),
          engagedViews: num(r.engagedViews),
          estimatedMinutesWatched: num(r.estimatedMinutesWatched) === null ? null : round(r.estimatedMinutesWatched, 1),
          subscribersGained: num(r.subscribersGained),
          subscribersLost: num(r.subscribersLost),
        }));
      const merged = new Map(daily.map((d) => [d.date, d]));
      for (const d of fresh) merged.set(d.date, d);
      daily = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
      log.info(`channel daily: ${fresh.length} day(s) fetched ${start}..${dataThrough}, ${daily.length} stored`);
    }
  } else status.notes.push("no tracked video has complete analytics data yet; channel daily series not fetched");

  // per-video lifetime metrics (one paged "top videos" query)
  const metricsById = new Map();
  const dueVideos = plan.filter((p) => p.due);
  if (dueVideos.length) {
    const start = addDays(dueVideos.reduce((m, p) => (p.t.publishedDate < m ? p.t.publishedDate : m), dueVideos[0].t.publishedDate), -1);
    let startIndex = 1;
    for (;;) {
      const { table, dropped } = await query(
        "videos",
        { ...analyticsBase, startDate: start, dimensions: "video", metrics: metricList(VIDEO_METRICS), sort: "-views", maxResults: 200, startIndex },
        ["engagedViews"],
      );
      if (dropped.length && startIndex === 1) status.notes.push(`video table: API rejected ${dropped.join(", ")}; stored as null`);
      const rows = tableToObjects(table);
      for (const r of rows) if (typeof r.video === "string") metricsById.set(r.video, r);
      if (rows.length < 200) break;
      startIndex += 200;
    }
    log.info(`video table: ${metricsById.size} row(s) for ${dueVideos.length} due video(s)`);
  }

  // per-video traffic sources and retention curve
  const detail = new Map();
  await mapLimit(dueVideos, concurrency, async (p) => {
    const { t } = p;
    if (!metricsById.has(t.id)) return; // no metrics row means no snapshot, nothing to attach details to
    const base = { ...analyticsBase, startDate: addDays(t.publishedDate, -1), filters: `video==${t.id}` };
    const d = { traffic: null, trafficNote: null, retention: null, retentionNote: null };
    // traffic sources
    try {
      const { table } = await query(`traffic:${t.id}`, { ...base, dimensions: "insightTrafficSourceType", metrics: "views,engagedViews,estimatedMinutesWatched", sort: "-views" }, ["engagedViews"]);
      const rows = buildTraffic(tableToObjects(table));
      if (rows.length) {
        d.traffic = rows;
        status.traffic.ok++;
      } else {
        d.trafficNote = "api_empty";
        status.traffic.empty++;
      }
    } catch (e) {
      d.trafficNote = `api_error: ${e.short ?? e.message}`;
      status.traffic.error++;
      status.traffic.first_error ??= d.trafficNote;
    }
    // retention curve
    const eligibleForTest = p.ageDays >= 4;
    if (eligibleForTest) status.retention.eligible++;
    const retParams = { ...base, dimensions: "elapsedVideoTimeRatio" };
    let rows = null;
    try {
      let table;
      try {
        table = await transport.analytics(`retention:${t.id}`, { ...retParams, metrics: "audienceWatchRatio,relativeRetentionPerformance" });
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 400) throw e;
        table = await transport.analytics(`retention:${t.id}`, { ...retParams, metrics: "audienceWatchRatio" });
      }
      rows = buildRetention(tableToObjects(table));
    } catch (e) {
      d.retentionNote = `api_error: ${e.short ?? e.message}`;
      if (eligibleForTest) {
        status.retention.api_error++;
        status.retention.first_error ??= d.retentionNote;
      }
    }
    if (rows && rows.length >= 2) {
      d.retention = rows;
      if (eligibleForTest) status.retention.api_ok++;
    } else if (rows) {
      d.retentionNote = "api_empty: HTTP 200 with no usable rows";
      if (eligibleForTest) status.retention.api_empty++;
    }
    detail.set(t.id, d);
  });

  // --- assemble video files ---
  const writes = new Map(); // absolute path -> object
  for (const p of plan) {
    const { t, prev } = p;
    const file = join(videosDir, `${t.id}.json`);
    const snapshots = [...(prev?.snapshots ?? [])];
    const episodeId = byYoutube.get(t.id) ?? null;
    if (episodeId) status.episodes.linked++;

    if (p.due && metricsById.has(t.id)) {
      const d = detail.get(t.id) ?? {};
      const metrics = buildMetrics(metricsById.get(t.id));
      const unavailable = VIDEO_METRICS.filter((k) => metrics[k] === null);
      let traffic = d.traffic ?? null;
      if (traffic === null) unavailable.push("traffic_sources");
      let curve = d.retention ?? null;
      let source = curve ? "api" : null;
      let carried = null;
      if (!curve) {
        const csv = [...snapshots].reverse().find((s) => s.retention_source === "csv" && Array.isArray(s.retention_curve));
        if (csv) {
          curve = csv.retention_curve;
          source = "csv";
          carried = csv.retention_carried_from ?? csv.date;
          status.retention.csv_carried++;
        }
      }
      if (!curve) unavailable.push("retention_curve");
      const snap = {
        date: syncDate,
        data_through: dataThrough,
        partial: daysBetween(t.publishedDate, dataThrough) < 2,
        metrics,
        traffic_sources: traffic,
        retention_curve: curve,
        retention_source: source,
        unavailable,
      };
      if (carried) snap.retention_carried_from = carried;
      if (!d.retention && d.retentionNote) snap.retention_note = d.retentionNote;
      if (!d.traffic && d.trafficNote) snap.traffic_note = d.trafficNote;
      const at = snapshots.findIndex((s) => s.date === syncDate);
      if (at >= 0) snapshots[at] = snap;
      else snapshots.push(snap);
      snapshots.sort((a, b) => a.date.localeCompare(b.date));
      status.snapshots_written++;
    } else if (p.due && p.complete) {
      status.videos_without_metrics++;
      status.notes.push(`no metrics row returned for ${t.id} (${t.title.slice(0, 40)}); no snapshot written`);
    } else if (p.complete) status.snapshots_deferred++;

    writes.set(file, {
      video_id: t.id,
      title: t.title,
      published_at: t.publishedAt,
      duration_sec: t.durationSec,
      is_short: t.isShort,
      episode_id: episodeId,
      snapshots,
    });
  }

  const r = status.retention;
  if (r.api_ok > 0) r.verdict = "works";
  else if (r.eligible > 0 && r.api_empty + r.api_error === r.eligible) r.verdict = "unavailable";
  else r.verdict = "inconclusive";

  const channelDoc = { generated_at: now.toISOString(), channel_id: channelId, daily };
  writes.set(join(outDir, "analytics", "channel.json"), channelDoc);

  // --- validate before writing anything ---
  let bad = 0;
  const check = (path, res) => {
    for (const w of res.warnings) log.warn(`${path.replace(root + "/", "")}: ${w}`);
    for (const e of res.errors) {
      log.error(`${path.replace(root + "/", "")}: ${e}`);
      bad++;
    }
  };
  for (const [path, obj] of writes) {
    if (path.endsWith("channel.json")) check(path, validateChannel(obj));
    else check(path, validateVideo(obj, obj.video_id));
  }
  if (bad) {
    log.error(`${bad} schema error(s) in generated data; nothing was written`);
    process.exit(1);
  }

  // --- report ---
  const summary = [
    `sync ${syncDate} (data through ${dataThrough}, lag ${lagDays}d, mode ${transport.mode})`,
    `tracked Shorts: ${status.shorts_tracked}; snapshots written: ${status.snapshots_written}; deferred by cadence: ${status.snapshots_deferred}; too new for complete data: ${status.videos_without_complete_data}; no metrics row: ${status.videos_without_metrics}`,
    `episode links: ${status.episodes.linked}${status.episodes.unmatched_youtube_ids.length ? `; unmatched youtube_ids: ${status.episodes.unmatched_youtube_ids.join(", ")}` : ""}`,
    `traffic sources: ok ${status.traffic.ok}, empty ${status.traffic.empty}, error ${status.traffic.error}`,
    `RETENTION CURVE TEST: ${r.verdict.toUpperCase()} (videos aged 4+ days: ${r.eligible}; api ok ${r.api_ok}, empty ${r.api_empty}, error ${r.api_error}; csv carried ${r.csv_carried})${r.first_error ? `; first error: ${r.first_error}` : ""}`,
  ];
  for (const l of summary) log.info(l);
  if (r.verdict === "unavailable")
    log.warn("The retention curve was not available from the API for any Short aged 4+ days. Use the CSV fallback (docs/dashboard-setup.md).");
  if (r.verdict === "inconclusive") log.notice("Retention curve test inconclusive: no tracked video is 4+ days old yet. Re-run after one has aged.");
  if (process.env.GITHUB_STEP_SUMMARY && !dryRun) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Analytics sync ${syncDate}\n\n${summary.map((l) => `- ${l}`).join("\n")}\n`);
  }

  if (dryRun) {
    log.info(`dry run: ${writes.size} file(s) validated against docs/schemas.md, nothing written${purge ? " (mock data would be purged)" : ""}`);
    return;
  }

  // --- write ---
  if (purge) {
    rmSync(join(outDir, "analytics"), { recursive: true, force: true });
    rmSync(join(outDir, "insights.json"), { force: true });
    log.notice("data/.mock existed: fabricated sample data removed before writing real data");
  }
  for (const [path, obj] of writes) writeJson(path, obj);
  writeJson(join(outDir, "analytics", "sync-status.json"), status);
  if (existsSync(mockPath) && (transport.mode === "real" || args.purgeMock)) {
    rmSync(mockPath, { force: true });
    log.notice("deleted data/.mock (first real sync)");
  }
  log.info(`wrote ${writes.size + 1} file(s) under ${outDir.replace(root + "/", "")}/analytics`);
}

// run when executed directly, not when imported by a test
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main().catch((e) => {
    if (e instanceof ApiError) log.error(`${e.api ?? "api"} request failed: ${e.short}`);
    else log.error(e.stack ?? String(e));
    process.exit(1);
  });
}
