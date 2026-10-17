#!/usr/bin/env node
// Technical checks on a rendered MP4. This does not judge the edit. It catches broken output.
//
//   node scripts/qa-render.mjs episodes/<id>/media/renders/v1.mp4
//
// Checks: 1080x1920, 30 fps, H.264, audio present, duration (Shorts allow up to 3 minutes),
// loudness near -14 LUFS, long black segments, long silences.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const file = resolve(process.argv[2] || "");
if (!process.argv[2]) {
  console.error("usage: qa-render.mjs <video.mp4>");
  process.exit(1);
}
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const probe = JSON.parse(run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]).stdout || "{}");
const results = [];
const check = (ok, label, detail) => results.push({ ok, label, detail });
const v = (probe.streams || []).find((s) => s.codec_type === "video");
const a = (probe.streams || []).find((s) => s.codec_type === "audio");
const duration = Number(probe.format?.duration || 0);
check(!!v, "video stream", v ? `${v.codec_name} ${v.width}x${v.height}` : "missing");
if (v) {
  check(v.width === 1080 && v.height === 1920, "1080x1920", `${v.width}x${v.height}`);
  const [n, d] = String(v.r_frame_rate).split("/").map(Number);
  check(Math.abs(n / d - 30) < 0.01, "30 fps", `${(n / d).toFixed(2)}`);
  check(v.codec_name === "h264", "H.264", v.codec_name);
}
check(!!a, "audio stream", a ? a.codec_name : "missing");
check(duration > 3 && duration <= 180, "duration 3s to 3min", `${duration.toFixed(2)}s`);

if (a) {
  const ln = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
  const lufs = Number((ln.match(/I:\s+(-?\d+(\.\d+)?) LUFS/g) || []).pop()?.match(/-?\d+(\.\d+)?/)?.[0]);
  const peak = Number((ln.match(/Peak:\s+(-?\d+(\.\d+)?) dBFS/g) || []).pop()?.match(/-?\d+(\.\d+)?/)?.[0]);
  if (Number.isFinite(lufs)) check(lufs > -20 && lufs < -10, "loudness -20 to -10 LUFS (target about -14)", `${lufs} LUFS`);
  if (Number.isFinite(peak)) check(peak <= -0.9, "true peak under -1 dBFS", `${peak} dBFS`);
  const sil = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "silencedetect=noise=-40dB:d=1.2", "-f", "null", "-"]).stderr;
  const sils = [...sil.matchAll(/silence_duration: (\d+(\.\d+)?)/g)].map((m) => Number(m[1]));
  check(sils.length === 0, "no silence over 1.2s", sils.length ? `${sils.length} gap(s): ${sils.map((s) => s.toFixed(1) + "s").join(", ")}` : "ok");
}
const bl = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vf", "blackdetect=d=0.4:pix_th=0.05", "-an", "-f", "null", "-"]).stderr;
const blacks = [...bl.matchAll(/black_start:(\d+(\.\d+)?).*?black_duration:(\d+(\.\d+)?)/g)].map((m) => `${Number(m[1]).toFixed(1)}s for ${Number(m[3]).toFixed(1)}s`);
check(blacks.length === 0, "no black frames over 0.4s", blacks.length ? blacks.join(", ") : "ok");

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}  (${r.detail})`);
}
console.log(failed ? `\n${failed} check(s) failed` : "\nall technical checks passed. Still needs his eyes and ears.");
process.exit(failed ? 1 : 0);
