#!/usr/bin/env node
// Validate everything under data/ against docs/schemas.md (plus the "Schema notes" additions).
//
//   node scripts/check-analytics-data.mjs [dataDir]      default: data
//
// Exit 1 on any error. Warnings (cross-reference gaps, odd values) do not fail the run.
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { log, readJson } from "./lib/analytics-io.mjs";
import { validateChannel, validateEpisodesIndex, validateInsights, validateVideo } from "./lib/schema-check.mjs";

const root = resolve(import.meta.dirname, "..");
const dir = resolve(root, process.argv[2] ?? "data");
let errors = 0;
let warnings = 0;
const rel = (p) => p.replace(root + "/", "");

function report(path, res) {
  for (const w of res.warnings) {
    warnings++;
    log.warn(`${rel(path)}: ${w}`);
  }
  for (const e of res.errors) {
    errors++;
    log.error(`${rel(path)}: ${e}`);
  }
}

const mock = existsSync(join(dir, ".mock"));
log.info(`checking ${rel(dir)}${mock ? " (MOCK DATA present)" : ""}`);

let episodeIds = null;
const idxPath = join(dir, "episodes-index.json");
if (existsSync(idxPath)) {
  const idx = readJson(idxPath);
  report(idxPath, validateEpisodesIndex(idx));
  episodeIds = new Set((idx.episodes ?? []).map((e) => e.id));
} else log.warn(`${rel(idxPath)} not found`);

const chPath = join(dir, "analytics", "channel.json");
if (existsSync(chPath)) report(chPath, validateChannel(readJson(chPath)));
else log.warn(`${rel(chPath)} not found`);

const videoIds = new Set();
const vdir = join(dir, "analytics", "videos");
let nVideos = 0;
let nSnaps = 0;
if (existsSync(vdir)) {
  for (const f of readdirSync(vdir).filter((x) => x.endsWith(".json")).sort()) {
    const path = join(vdir, f);
    const v = readJson(path);
    const id = f.replace(/\.json$/, "");
    videoIds.add(id);
    nVideos++;
    nSnaps += Array.isArray(v.snapshots) ? v.snapshots.length : 0;
    report(path, validateVideo(v, id));
    if (episodeIds && v.episode_id && !episodeIds.has(v.episode_id)) {
      warnings++;
      log.warn(`${rel(path)}: episode_id "${v.episode_id}" is not in episodes-index.json`);
    }
    if (mock && !id.startsWith("MOCK_")) {
      errors++;
      log.error(`${rel(path)}: data/.mock exists but this video id does not start with MOCK_`);
    }
  }
}

const insPath = join(dir, "insights.json");
if (existsSync(insPath)) {
  const ins = readJson(insPath);
  report(insPath, validateInsights(ins));
  for (const [i, r] of (ins.recommendations ?? []).entries())
    for (const e of r.evidence ?? [])
      if (!videoIds.has(e)) {
        warnings++;
        log.warn(`${rel(insPath)}: recommendations[${i}] cites unknown video id ${e}`);
      }
}

for (const f of ["analytics/channel.json", "insights.json", "episodes-index.json"]) {
  // no em dashes anywhere in generated text
  const p = join(dir, f);
  if (existsSync(p) && /\u2014/.test(JSON.stringify(readJson(p)))) {
    errors++;
    log.error(`${rel(p)}: contains an em dash`);
  }
}

log.info(`videos: ${nVideos}, snapshots: ${nSnaps}, errors: ${errors}, warnings: ${warnings}`);
process.exit(errors ? 1 : 0);
