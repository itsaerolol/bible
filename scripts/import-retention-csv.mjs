#!/usr/bin/env node
// Fallback for the retention curve: import a YouTube Studio audience-retention CSV.
//
//   node scripts/import-retention-csv.mjs <episode-id> [<episode-id> ...]
//   node scripts/import-retention-csv.mjs --all
//   node scripts/import-retention-csv.mjs --file some.csv --video-id VIDEO_ID [--duration 45]
//   Options: --data-dir data  --episodes-dir episodes  --date YYYY-MM-DD  --dry-run
//            --position-col <name part or 0-based index>  --retention-col <...>  --relative-col <...>
//
// Where the file goes: episodes/<episode-id>/retention.csv  (the episode needs youtube_id in episode.md,
// and the daily sync must already have created data/analytics/videos/<youtube_id>.json).
//
// Expected columns (the reader is deliberately tolerant, it prints what it detected):
//   position   one of: video position as percent (0 to 100), as a ratio (0 to 1), or as time (0:05, 12.5)
//   retention  the share of viewers still watching at that position: percent or ratio
//   relative   optional, relative retention vs similar videos (0 to 1 or percent)
// Header names are matched loosely: position|elapsed|time|% of video, and retention|audience|watching|viewers.
// A headerless two-column file (position, retention) also works.
//
// NOTE: the exact column names of a Studio export could not be confirmed from Google's public docs
// (the Help Center says Advanced mode > "Export current view" and a 500 row limit but does not describe
// the files). If detection picks the wrong columns, pass --position-col / --retention-col.
//
// Result: the retention_curve array is merged into the latest snapshot of the video (or --date), with
// retention_source "csv". The daily sync carries a csv curve forward when the API still has none.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { log, parseArgs, readJson, round, writeJson } from "./lib/analytics-io.mjs";
import { parseFrontmatterDoc } from "./lib/yaml-lite.mjs";
import { validateVideo } from "./lib/schema-check.mjs";

const root = resolve(import.meta.dirname, "..");

// ---------- CSV ----------
export function parseCsv(text) {
  const src = text.replace(/^﻿/, "");
  const firstLines = src.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
  const count = (ch) => firstLines.reduce((n, l) => n + (l.match(new RegExp(ch === "\t" ? "\t" : `\\${ch}`, "g")) || []).length, 0);
  const delim = [",", ";", "\t"].map((d) => [d, count(d)]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return { rows: rows.map((r) => r.map((x) => x.trim())), delim };
}

// number with optional %, thousands separators, decimal comma; or time like 0:05 / 1:02:03 / 0:05.5
export function parseCell(raw, { decimalComma = false } = {}) {
  let s = String(raw ?? "").trim();
  if (!s) return null;
  const time = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(\.\d+)?$/);
  if (time) {
    const [, h, m, sec, frac] = time;
    return { value: Number(h ?? 0) * 3600 + Number(m) * 60 + Number(sec) + Number(frac ?? 0), kind: "time" };
  }
  const pct = /%/.test(s);
  s = s.replace(/[%\s ]/g, "");
  if (decimalComma || /^-?\d+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s)) return null;
  return { value: Number(s), kind: pct ? "percent" : "number" };
}

function pickColumn(spec, headers, fallback) {
  if (spec === undefined) return fallback;
  if (/^\d+$/.test(spec)) return Number(spec);
  const i = headers.findIndex((h) => h.toLowerCase().includes(String(spec).toLowerCase()));
  if (i < 0) throw new Error(`no column matches "${spec}". Columns: ${headers.map((h, n) => `${n}:${h}`).join(" | ")}`);
  return i;
}

export function convertCsv(text, { duration = null, positionCol, retentionCol, relativeCol } = {}) {
  const { rows, delim } = parseCsv(text);
  const decimalComma = delim === ";" || delim === "\t";
  if (rows.length < 3) throw new Error("the CSV has fewer than 3 non-empty rows");
  const isNumericRow = (r) => r.filter((c) => parseCell(c, { decimalComma }) !== null).length >= 2;
  let h = 0;
  while (h < rows.length - 1 && !(!isNumericRow(rows[h]) && isNumericRow(rows[h + 1]))) {
    if (isNumericRow(rows[h])) break; // headerless
    h++;
  }
  const headerless = isNumericRow(rows[h]);
  const headers = headerless ? rows[h].map((_, i) => `column ${i}`) : rows[h];
  const body = rows.slice(headerless ? h : h + 1).filter(isNumericRow);
  if (body.length < 5) throw new Error(`only ${body.length} numeric data rows found, need at least 5`);

  const norm = headers.map((x) => x.toLowerCase());
  const used = new Set();
  let pi = pickColumn(positionCol, headers, norm.findIndex((x) => /position|elapsed|timestamp|^time|moment|video time|% of video|percent of video|point in video/.test(x)));
  if (pi < 0) pi = 0;
  used.add(pi);
  let ri = pickColumn(relativeCol, headers, norm.findIndex((x, i) => !used.has(i) && /relative/.test(x)));
  if (ri >= 0) used.add(ri);
  let ai = pickColumn(retentionCol, headers, norm.findIndex((x, i) => !used.has(i) && /retention|watch ratio|audience|viewers|watching|remaining|stayed/.test(x)));
  if (ai < 0) ai = norm.findIndex((_, i) => !used.has(i) && body.filter((r) => parseCell(r[i], { decimalComma }) !== null).length >= body.length * 0.8);
  if (ai < 0) throw new Error(`could not find a retention column. Columns: ${headers.map((x, n) => `${n}:${x}`).join(" | ")}`);
  if (ai === pi) throw new Error("position and retention resolved to the same column; pass --position-col and --retention-col");

  const pos = body.map((r) => parseCell(r[pi], { decimalComma }));
  const ret = body.map((r) => parseCell(r[ai], { decimalComma }));
  const rel = ri >= 0 ? body.map((r) => parseCell(r[ri], { decimalComma })) : null;
  const ok = pos.map((p, i) => p && ret[i]);
  const pv = pos.filter((_, i) => ok[i]).map((p) => p.value);
  const maxPos = Math.max(...pv);

  // position -> ratio of video length
  let posUnit;
  const posKinds = new Set(pos.filter(Boolean).map((p) => p.kind));
  const nearDuration = duration && Math.abs(maxPos - duration) <= Math.max(1.5, duration * 0.05) && Math.abs(duration - 100) > 5;
  if (posKinds.has("time") || /second|\bsec\b|\(s\)|time/.test(norm[pi])) posUnit = "seconds";
  else if (posKinds.has("percent") || /%|percent/.test(norm[pi])) posUnit = "percent";
  else if (/ratio/.test(norm[pi]) || maxPos <= 1.0001) posUnit = "ratio";
  else if (duration && (maxPos > 100.5 || nearDuration)) posUnit = "seconds";
  else posUnit = maxPos <= 100.5 ? "percent" : "seconds";
  if (posUnit === "seconds" && !duration) throw new Error("positions are in seconds but the video duration is unknown; pass --duration <seconds> or make sure the video file has duration_sec");
  const toT = (v) => (posUnit === "percent" ? v / 100 : posUnit === "seconds" ? v / duration : v);

  // retention unit
  const retVals = ret.filter(Boolean).map((r) => r.value);
  const maxRet = Math.max(...retVals);
  const retPercent = ret.some((r) => r && r.kind === "percent") || /%|percent/.test(norm[ai]) || maxRet > 3;
  const relVals = rel ? rel.filter(Boolean).map((r) => r.value) : [];
  const relPercent = rel ? rel.some((r) => r && r.kind === "percent") || /%|percent/.test(norm[ri]) || Math.max(...relVals) > 1.5 : false;

  const points = [];
  body.forEach((_, i) => {
    if (!ok[i]) return;
    const t = toT(pos[i].value);
    if (!(t >= 0 && t <= 1.0001)) return;
    const a = retPercent ? ret[i].value / 100 : ret[i].value;
    const r = rel && rel[i] ? (relPercent ? rel[i].value / 100 : rel[i].value) : null;
    points.push({
      t: round(Math.min(1, t), 4),
      audienceWatchRatio: round(a, 4),
      relativeRetentionPerformance: r === null ? null : round(Math.min(1, Math.max(0, r)), 4),
    });
  });
  points.sort((a, b) => a.t - b.t);
  const dedup = points.filter((p, i) => i === 0 || p.t > points[i - 1].t);
  if (dedup.length < 5) throw new Error(`only ${dedup.length} usable points after converting positions; check the position column (${headers[pi]}) and --duration`);
  if (dedup.some((p) => p.audienceWatchRatio < 0)) throw new Error("negative retention values found");

  return {
    points: dedup,
    detected: {
      delimiter: delim === "\t" ? "tab" : delim,
      headerRow: headerless ? null : headers,
      position: `${headers[pi]} (${posUnit})`,
      retention: `${headers[ai]} (${retPercent ? "percent" : "ratio"})`,
      relative: ri >= 0 ? `${headers[ri]} (${relPercent ? "percent" : "ratio"})` : null,
      rowsRead: body.length,
    },
  };
}

// ---------- main ----------
function main() {
  const args = parseArgs(process.argv.slice(2), {
    all: "bool",
    file: "string",
    videoId: "string",
    duration: "number",
    dataDir: "string",
    episodesDir: "string",
    date: "string",
    dryRun: "bool",
    positionCol: "string",
    retentionCol: "string",
    relativeCol: "string",
  });
  const dataDir = resolve(root, args.dataDir ?? "data");
  const episodesDir = resolve(root, args.episodesDir ?? "episodes");
  const jobs = [];

  if (args.file) {
    if (!args.videoId) throw new Error("--file needs --video-id");
    jobs.push({ label: args.file, csv: resolve(args.file), videoId: args.videoId, episodeDuration: args.duration ?? null });
  } else {
    const wanted = args.all
      ? readdirSync(episodesDir).filter((n) => !n.startsWith("_") && !n.startsWith(".") && existsSync(join(episodesDir, n, "retention.csv")))
      : args._;
    if (!wanted.length) {
      console.error("usage: import-retention-csv.mjs <episode-id> [...] | --all | --file x.csv --video-id ID");
      process.exit(1);
    }
    for (const id of wanted) {
      const epPath = join(episodesDir, id, "episode.md");
      const csv = join(episodesDir, id, "retention.csv");
      if (!existsSync(epPath)) {
        log.error(`${id}: episodes/${id}/episode.md not found`);
        process.exitCode = 1;
        continue;
      }
      if (!existsSync(csv)) {
        log.error(`${id}: expected the Studio export at episodes/${id}/retention.csv`);
        process.exitCode = 1;
        continue;
      }
      const { data } = parseFrontmatterDoc(readFileSync(epPath, "utf8"));
      if (!data?.youtube_id) {
        log.warn(`${id}: episode.md has no youtube_id yet (set by /posted); skipped`);
        continue;
      }
      jobs.push({ label: id, csv, videoId: data.youtube_id, episodeDuration: typeof data.duration_sec === "number" ? data.duration_sec : null, relCsv: `episodes/${id}/retention.csv` });
    }
  }

  for (const job of jobs) {
    const vpath = join(dataDir, "analytics", "videos", `${job.videoId}.json`);
    if (!existsSync(vpath)) {
      log.error(`${job.label}: ${vpath.replace(root + "/", "")} does not exist. Run the analytics sync first (it creates the video file once YouTube reports the video).`);
      process.exitCode = 1;
      continue;
    }
    const video = readJson(vpath);
    if (!video.snapshots?.length) {
      log.error(`${job.label}: ${job.videoId} has no snapshots yet (YouTube data lags 48 to 72 hours). Import again after the next sync.`);
      process.exitCode = 1;
      continue;
    }
    let result;
    try {
      result = convertCsv(readFileSync(job.csv, "utf8"), {
        duration: video.duration_sec ?? job.episodeDuration,
        positionCol: args.positionCol,
        retentionCol: args.retentionCol,
        relativeCol: args.relativeCol,
      });
    } catch (e) {
      log.error(`${job.label}: ${e.message}`);
      process.exitCode = 1;
      continue;
    }
    const snap = args.date ? video.snapshots.find((s) => s.date === args.date) : video.snapshots.at(-1);
    if (!snap) {
      log.error(`${job.label}: no snapshot dated ${args.date}`);
      process.exitCode = 1;
      continue;
    }
    snap.retention_curve = result.points;
    snap.retention_source = "csv";
    snap.unavailable = (snap.unavailable ?? []).filter((x) => x !== "retention_curve");
    delete snap.retention_note;
    delete snap.retention_carried_from;
    snap.retention_imported_at = new Date().toISOString();
    if (job.relCsv) snap.retention_csv = job.relCsv;

    const v = validateVideo(video, video.video_id);
    if (v.errors.length) {
      for (const e of v.errors) log.error(`${job.label}: ${e}`);
      process.exitCode = 1;
      continue;
    }
    const first = result.points[0];
    const last = result.points.at(-1);
    const d = result.detected;
    log.info(
      `${job.label} -> ${video.video_id} snapshot ${snap.date}: ${result.points.length} points, t ${first.t}..${last.t}, watch ratio ${first.audienceWatchRatio} -> ${last.audienceWatchRatio}`,
    );
    log.info(`  detected: position=${d.position}; retention=${d.retention}${d.relative ? `; relative=${d.relative}` : ""}; delimiter=${d.delimiter}; rows=${d.rowsRead}`);
    if (first.audienceWatchRatio < 0.5) log.warn(`  the curve starts at ${first.audienceWatchRatio}; a real retention curve starts near 1.0. Check the retention column.`);
    if (args.dryRun) log.info("  dry run: not written");
    else {
      writeJson(vpath, video);
      log.info(`  wrote ${vpath.replace(root + "/", "")}`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  try {
    main();
  } catch (e) {
    log.error(e.message);
    process.exit(1);
  }
}
