#!/usr/bin/env node
// Prepare an episode's footage. Originals are never modified.
//
//   node scripts/prep-media.mjs episodes/<id>
//
// Expects media/angle-a.(mp4|mov|m4v) and optionally media/angle-b.*.
// Writes working copies to media/work/ (1080x1920, constant 30 fps, H.264, seek-friendly),
// extracts media/audio.wav from angle A, syncs angle B by audio, records sha256 of the originals in
// episode.md, and points plan.json at the working copies.

import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { writeMediaBlock } from "./lib/frontmatter.mjs";

const dir = resolve(process.argv[2] || "");
if (!dir || !existsSync(join(dir, "media"))) {
  console.error("usage: prep-media.mjs <episode dir>   (needs a media/ folder)");
  process.exit(1);
}
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.status !== 0) {
    console.error(`${cmd} failed:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  return r.stdout;
};
const sha256 = (p) =>
  new Promise((res, rej) => {
    const h = createHash("sha256");
    createReadStream(p).on("data", (d) => h.update(d)).on("end", () => res(h.digest("hex"))).on("error", rej);
  });
const probe = (p) => {
  const j = JSON.parse(run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", p]));
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  return { v, a, duration: Number(j.format.duration) };
};
const rate = (s) => {
  const [n, d] = String(s).split("/").map(Number);
  return d ? n / d : n;
};

const mediaDir = join(dir, "media");
const find = (stem) => readdirSync(mediaDir).find((f) => new RegExp(`^${stem}\\.(mp4|mov|m4v)$`, "i").test(f));
const aFile = find("angle-a");
if (!aFile) {
  console.error("media/angle-a.(mp4|mov|m4v) not found");
  process.exit(1);
}
const bFile = find("angle-b");
const work = join(mediaDir, "work");
mkdirSync(work, { recursive: true });

const entries = [];
const info = {};
for (const [key, file] of [["a", aFile], ["b", bFile]]) {
  if (!file) continue;
  const src = join(mediaDir, file);
  const p = probe(src);
  info[key] = p;
  if (!p.a) console.warn(`warning: ${file} has no audio track`);
  const aspect = p.v.width / p.v.height;
  if (Math.abs(aspect - 9 / 16) > 0.02) console.warn(`warning: ${file} is ${p.v.width}x${p.v.height}, not 9:16. It will be center-cropped.`);
  if (Math.abs(rate(p.v.r_frame_rate) - rate(p.v.avg_frame_rate)) > 0.5) console.log(`note: ${file} is variable frame rate. The working copy is converted to constant 30 fps.`);
  console.log(`${file}: ${p.v.width}x${p.v.height}, ${p.duration.toFixed(2)}s, ${rate(p.v.avg_frame_rate).toFixed(2)} fps`);
  const out = join(work, `angle-${key}.mp4`);
  run("ffmpeg", ["-y", "-v", "error", "-i", src, "-an", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-g", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  entries.push({ file: `media/${file}`, role: `angle-${key}`, sha256: await sha256(src) });
}

// Master audio comes from angle A, lossless.
const audio = join(mediaDir, "audio.wav");
run("ffmpeg", ["-y", "-v", "error", "-i", join(mediaDir, aFile), "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", audio]);
entries.push({ file: "media/audio.wav", role: "audio", sha256: await sha256(audio) });

let offsetB = null;
if (bFile) {
  const r = JSON.parse(run("python3", [resolve(import.meta.dirname, "sync-angles.py"), join(mediaDir, aFile), join(mediaDir, bFile)]));
  offsetB = r.offsetSeconds;
  console.log(`angle B offset: ${r.offsetSeconds}s (confidence ${r.confidence}${r.confidence < 8 ? ", WEAK: check by ear" : ""})`);
}

// plan.json media block
const planPath = join(dir, "plan.json");
const plan = existsSync(planPath) ? JSON.parse(readFileSync(planPath, "utf8")) : { version: 1, keep: [], angleCuts: [], punches: [], emphasis: [], graphics: [] };
plan.media = {
  audio: "media/audio.wav",
  angles: { a: "media/work/angle-a.mp4", ...(bFile ? { b: "media/work/angle-b.mp4" } : {}) },
  angleOffsetSeconds: { a: 0, ...(bFile ? { b: offsetB } : {}) },
  sourceDurationSeconds: Number(info.a.duration.toFixed(3)),
};
writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");

const ep = join(dir, "episode.md");
if (existsSync(ep)) writeMediaBlock(ep, entries);
console.log(`done. ${entries.length} files hashed. Next: from the episode folder run  npx hyperframes@0.8.168 transcribe media/audio.wav --dir .`);
