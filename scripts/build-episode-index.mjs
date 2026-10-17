#!/usr/bin/env node
// Build data/episodes-index.json from the YAML frontmatter of every episodes/*/episode.md.
//
//   node scripts/build-episode-index.mjs [--force] [--dry-run] [--episodes-dir episodes] [--out data/episodes-index.json]
//
// Folders whose name starts with "_" or "." are skipped (templates). Output shape is defined in
// docs/schemas.md. If data/.mock exists the index holds fabricated episodes, so the script refuses
// to overwrite it unless --force is given (the daily Action passes --force once real secrets exist).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseFrontmatterDoc } from "./lib/yaml-lite.mjs";
import { log, parseArgs, readJson, writeJson } from "./lib/analytics-io.mjs";

const root = resolve(import.meta.dirname, "..");
const args = parseArgs(process.argv.slice(2), {
  force: "bool",
  dryRun: "bool",
  episodesDir: "string",
  out: "string",
});
const episodesDir = resolve(root, args.episodesDir ?? "episodes");
const outPath = resolve(root, args.out ?? "data/episodes-index.json");
const mockFlag = join(dirname(outPath), ".mock");

if (existsSync(mockFlag) && !args.force && !args.dryRun) {
  log.info(`data/.mock exists: leaving ${outPath.replace(root + "/", "")} untouched (pass --force to overwrite with real episodes).`);
  process.exit(0);
}

const episodes = [];
const problems = [];

if (existsSync(episodesDir)) {
  for (const name of readdirSync(episodesDir).sort()) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const dir = join(episodesDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const file = join(dir, "episode.md");
    if (!existsSync(file)) {
      problems.push(`${name}: no episode.md`);
      continue;
    }
    const { data, error } = parseFrontmatterDoc(readFileSync(file, "utf8"));
    if (!data) {
      problems.push(`${name}: frontmatter not readable (${error ?? "empty"})`);
      continue;
    }
    if (!data.id) data.id = name;
    else if (data.id !== name) problems.push(`${name}: frontmatter id "${data.id}" differs from folder name`);
    // normalise containers so consumers never see null where a list or map is expected
    if (!Array.isArray(data.media)) data.media = [];
    if (!data.effort || typeof data.effort !== "object") data.effort = { revisions: 0, edit_minutes: null };
    episodes.push(data);
  }
} else {
  log.warn(`episodes directory not found: ${episodesDir}`);
}

episodes.sort((a, b) => String(a.id).localeCompare(String(b.id)));

const ids = new Set();
for (const e of episodes) {
  if (ids.has(e.id)) problems.push(`duplicate episode id ${e.id}`);
  ids.add(e.id);
}
const yt = new Map();
for (const e of episodes) {
  if (!e.youtube_id) continue;
  if (yt.has(e.youtube_id)) problems.push(`youtube_id ${e.youtube_id} is set on both ${yt.get(e.youtube_id)} and ${e.id}`);
  yt.set(e.youtube_id, e.id);
}

for (const p of problems) log.warn(`episode index: ${p}`);

// Keep the previous generated_at when nothing changed, so the daily run does not create empty commits.
let generated_at = new Date().toISOString();
const prev = readJson(outPath, null);
if (prev && JSON.stringify(prev.episodes) === JSON.stringify(episodes) && typeof prev.generated_at === "string") {
  generated_at = prev.generated_at;
}

const posted = episodes.filter((e) => e.youtube_id).length;
log.info(`episodes indexed: ${episodes.length} (${posted} with a youtube_id)${problems.length ? `, ${problems.length} warning(s)` : ""}`);

if (args.dryRun) {
  log.info("dry run: nothing written");
} else {
  writeJson(outPath, { generated_at, episodes });
  log.info(`wrote ${outPath.replace(root + "/", "")}`);
}
