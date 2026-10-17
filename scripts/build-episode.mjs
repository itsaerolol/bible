#!/usr/bin/env node
// Build an episode's HyperFrames project from plan.json + transcript.json + the pinned design system.
//
//   node scripts/build-episode.mjs episodes/<id>            build index.html, compositions/, captions.srt
//   node scripts/build-episode.mjs episodes/<id> --words    print the transcript with word indices
//
// Everything is deterministic: same inputs, same output files. All times in plan.json are SOURCE time
// (the master audio / angle A clock). This script maps them through plan.keep to timeline time.
// Edit transcript.json to correct words. Keep timings. Captions are verbatim from it.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tokensToCss } from "./lib/tokens.mjs";

const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith("--")) || "");
const wantWords = args.includes("--words");
if (!dir || !existsSync(dir)) fail("usage: build-episode.mjs <episode dir> [--words]");

const warnings = [];
const warn = (m) => warnings.push(m);
function fail(m) {
  console.error("error: " + m);
  process.exit(1);
}
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`cannot read ${p}: ${e.message}`);
  }
};
const r3 = (n) => Math.round(n * 1000) / 1000;

const T = readJson(join(dir, "design/tokens.json"));
const transcriptRaw = readJson(join(dir, "transcript.json"));

// ---- transcript words -------------------------------------------------------------------------
const rawWords = Array.isArray(transcriptRaw) ? transcriptRaw : transcriptRaw.words || [];
const words = rawWords
  .filter((w) => w && w.type !== "spacing" && typeof w.text === "string" && w.text.trim() !== "")
  .map((w, idx) => ({ idx, text: w.text.trim(), start: Number(w.start), end: Number(w.end) }));
if (!words.length) fail("transcript.json has no words");

if (wantWords) {
  let line = "";
  for (const w of words) {
    const tok = `[${w.idx}] ${w.text}@${w.start.toFixed(2)}  `;
    if ((line + tok).length > 100) {
      console.log(line);
      line = "";
    }
    line += tok;
  }
  if (line) console.log(line);
  process.exit(0);
}

const plan = readJson(join(dir, "plan.json"));

// ---- keep ranges and time mapping -------------------------------------------------------------
if (!Array.isArray(plan.keep) || !plan.keep.length) fail("plan.keep must list at least one {from,to}");
let keep = plan.keep.map((k) => ({ from: Number(k.from), to: Number(k.to) })).sort((a, b) => a.from - b.from);
keep.forEach((k, i) => {
  if (!(k.to > k.from)) fail(`plan.keep[${i}] must have to > from`);
  if (i && k.from < keep[i - 1].to - 1e-6) fail(`plan.keep ranges overlap near ${k.from}`);
});
const merged = [];
for (const k of keep) {
  const last = merged[merged.length - 1];
  if (last && Math.abs(k.from - last.to) < 1e-6) last.to = k.to;
  else merged.push({ ...k });
}
let acc = 0;
for (const k of merged) {
  k.t0 = acc;
  k.len = k.to - k.from;
  acc += k.len;
}
const total = r3(acc);
const toTimeline = (t) => {
  for (const k of merged) if (t >= k.from - 1e-6 && t <= k.to + 1e-6) return k.t0 + Math.min(Math.max(t - k.from, 0), k.len);
  return null;
};
const rangeAtTimeline = (tt) => merged.find((k) => tt >= k.t0 - 1e-6 && tt < k.t0 + k.len + 1e-6);
const toMaster = (tt, k = rangeAtTimeline(tt)) => k.from + (tt - k.t0);

// ---- captions ---------------------------------------------------------------------------------
const emphasisSet = new Set(plan.emphasis || []);
for (const i of emphasisSet) if (!words[i]) fail(`plan.emphasis index ${i} is not a transcript word`);
const C = T.captions;
const kept = [];
for (const w of words) {
  const k = merged.find((m) => w.start >= m.from - 0.03 && w.end <= m.to + 0.03);
  if (!k) continue;
  const s = k.t0 + Math.max(0, w.start - k.from);
  const e = k.t0 + Math.min(k.len, w.end - k.from);
  kept.push({ ...w, tStart: s, tEnd: Math.max(e, s + 0.05), range: k });
}
const groups = [];
let cur = [];
const flush = () => {
  if (cur.length) groups.push(cur);
  cur = [];
};
for (const w of kept) {
  const prev = cur[cur.length - 1];
  if (prev) {
    const gap = w.tStart - prev.tEnd;
    const sentenceEnd = /[.?!]["')\]]?$/.test(prev.text);
    const strongComma = /,$/.test(prev.text) && gap >= C.pauseBreakSeconds / 2;
    const tooLong = cur.length >= C.maxWordsPerGroup || w.tEnd - cur[0].tStart > C.maxGroupSeconds;
    if (gap >= C.pauseBreakSeconds || sentenceEnd || strongComma || tooLong || w.range !== prev.range) flush();
  }
  cur.push(w);
}
flush();
// merge single-word groups into a neighbor unless they are a standalone sentence
for (let i = 0; i < groups.length; i++) {
  const g = groups[i];
  if (g.length === 1 && !/[.?!]$/.test(g[0].text)) {
    const next = groups[i + 1];
    if (next && next.length < C.maxWordsPerGroup && next[0].range === g[0].range) {
      next.unshift(g[0]);
      groups.splice(i, 1);
      i--;
    }
  }
}
const capGroups = groups.map((g, i) => ({
  start: Math.max(0, g[0].tStart - C.leadInSeconds),
  end: g[g.length - 1].tEnd + C.lingerSeconds,
  words: g.map((w) => ({ text: w.text, start: r3(w.tStart), emphasis: emphasisSet.has(w.idx) })),
}));
capGroups.forEach((g, i) => {
  const next = capGroups[i + 1];
  if (next) g.end = Math.min(g.end, next.start - 0.04);
  if (i && g.start < capGroups[i - 1].end) g.start = capGroups[i - 1].end;
  g.end = Math.min(g.end, total);
  if (g.end - g.start < C.minGroupSeconds) warn(`caption group ${i} is short (${(g.end - g.start).toFixed(2)}s): "${g.words.map((w) => w.text).join(" ")}"`);
  g.start = r3(g.start);
  g.end = r3(g.end);
});

// ---- graphics ---------------------------------------------------------------------------------
const isStr = (v) => typeof v === "string" && v.trim() !== "";
const gfx = [];
(plan.graphics || []).forEach((item, n) => {
  const label = `plan.graphics[${n}] (${item.type})`;
  if (!isStr(item.reason)) fail(`${label}: reason is required (what does it clarify or emphasize?)`);
  const a = toTimeline(Number(item.from));
  const b = toTimeline(Number(item.to));
  if (a === null || b === null) fail(`${label}: from/to must fall inside plan.keep`);
  const duration = r3(b - a);
  if (!(duration > 0.5)) fail(`${label}: shorter than 0.5s`);
  const d = item.data || {};
  if (item.type === "custom") {
    // Escape hatch: a hand-written composition (see policy and DESIGN.md). Must live at compositions/custom-*.html.
    if (!/^compositions\/custom-[\w-]+\.html$/.test(item.src || "")) fail(`${label}: src must be compositions/custom-<name>.html`);
    if (!existsSync(join(dir, item.src))) fail(`${label}: ${item.src} does not exist`);
    if (!isStr(item.compositionId)) fail(`${label}: compositionId must match the data-composition-id inside ${item.src}`);
    gfx.push({ id: item.compositionId, type: "custom", src: item.src, start: r3(a), duration });
    return;
  }
  const tk = { "verse-card": T.verseCard, callout: T.callout, contrast: T.contrast }[item.type];
  if (!tk) fail(`${label}: unknown type. Use verse-card, callout, contrast, or custom.`);
  if (duration < tk.holdMinSeconds) warn(`${label}: ${duration}s is under the ${tk.holdMinSeconds}s minimum hold`);
  const placement = item.placement || tk.placement;
  let data;
  if (item.type === "verse-card") {
    if (!(isStr(d.reference) && isStr(d.text) && isStr(d.translation))) fail(`${label}: data needs reference, text, translation`);
    if (item.confirmed !== true) fail(`${label}: verse text is not confirmed. Show it to the user, then set "confirmed": true (policy/scripture.md).`);
    const len = d.text.length;
    const size = len <= 90 ? tk.textSize : len <= 160 ? Math.round(tk.textSize * 0.85) : len <= 260 ? Math.round(tk.textSize * 0.74) : null;
    if (!size) fail(`${label}: verse text is ${len} chars. Split it across two cards.`);
    data = { reference: d.reference, text: d.text, translation: d.translation, placement, textSize: size, duration };
  } else if (item.type === "callout") {
    if (!isStr(d.text)) fail(`${label}: data.text is required (wrap accent words in *asterisks*)`);
    const parts = d.text.split("*").map((text, i) => ({ text, accent: i % 2 === 1 })).filter((p) => p.text);
    data = { parts, placement, duration };
  } else {
    if (!(isStr(d.a) && isStr(d.b))) fail(`${label}: data needs a and b`);
    data = { a: d.a, b: d.b, label: d.label || "", placement, duration };
  }
  gfx.push({ id: `gfx-${n + 1}`, type: item.type, start: r3(a), duration, data });
});

// ---- picture and audio clips ------------------------------------------------------------------
const media = plan.media || {};
const angles = media.angles || {};
if (!angles.a) fail("plan.media.angles.a is required");
if (!media.audio) fail("plan.media.audio is required (run scripts/prep-media.mjs)");
const offsets = media.angleOffsetSeconds || {};
const cuts = (plan.angleCuts && plan.angleCuts.length ? plan.angleCuts : [{ at: 0, angle: "a" }])
  .map((c) => ({ at: Number(c.at), angle: c.angle, style: c.style || "hard" }))
  .sort((a, b) => a.at - b.at);
for (const c of cuts) if (!angles[c.angle]) fail(`angleCuts references unknown angle "${c.angle}"`);

const jl = T.edit.jlOffsetSeconds;
for (const c of cuts) if (!["hard", "j", "l"].includes(c.style)) fail(`angleCuts style must be hard, j, or l (got "${c.style}")`);
// A cut that lands in removed material takes effect at the start of the next kept range.
const toTimelineOrNext = (t) => toTimeline(t) ?? merged.find((k) => k.from > t)?.t0 ?? null;
let startAngle = "a"; // angle in force before any cut
let prevAngle = startAngle;
const switches = []; // timeline-time picture switches
for (const c of cuts) {
  const exact = toTimeline(c.at);
  const tt = exact ?? toTimelineOrNext(c.at);
  if (tt === null) continue; // after the last kept range
  let at = tt;
  if (exact !== null) {
    if (c.style === "j") at += jl; // audio of the new line leads the picture
    else if (c.style === "l") at -= jl; // previous audio spills over the new picture
  }
  at = Math.min(Math.max(at, 0), total);
  if (at <= 1e-6) {
    startAngle = c.angle;
    prevAngle = c.angle;
    continue;
  }
  if (c.angle === prevAngle) continue;
  switches.push({ at, angle: c.angle });
  prevAngle = c.angle;
}
const seq = [{ at: 0, angle: startAngle }, ...switches].sort((a, b) => a.at - b.at);
const videoClips = [];
seq.forEach((s, i) => {
  const end = i + 1 < seq.length ? seq[i + 1].at : total;
  // split further at keep-range boundaries so media-start stays correct
  let t = s.at;
  while (t < end - 1e-6) {
    const k = rangeAtTimeline(t + 1e-6);
    const kEnd = k.t0 + k.len;
    const segEnd = Math.min(end, kEnd);
    const src = toMaster(t, k);
    const mediaStart = src + Number(offsets[s.angle] || 0);
    if (mediaStart < -1e-6) fail(`angle ${s.angle} has no footage at source time ${src.toFixed(2)}s (offset ${offsets[s.angle]})`);
    videoClips.push({ angle: s.angle, start: r3(t), duration: r3(segEnd - t), mediaStart: r3(Math.max(0, mediaStart)) });
    t = segEnd;
  }
});
videoClips.forEach((c, i) => {
  if (c.duration < T.edit.minShotSeconds && i < videoClips.length - 1 && videoClips[i + 1].angle !== c.angle) {
    warn(`shot at ${c.start}s is ${c.duration}s, under the ${T.edit.minShotSeconds}s minimum`);
  }
});
const audioClips = merged.map((k, i) => ({
  start: r3(k.t0),
  duration: r3(k.len),
  mediaStart: r3(k.from),
  fadeIn: i === 0 ? 0 : 0.02,
  fadeOut: i === merged.length - 1 ? 0 : 0.02,
}));

// ---- punches ----------------------------------------------------------------------------------
const punches = [];
(plan.punches || []).forEach((p, n) => {
  const a = toTimeline(Number(p.at));
  if (a === null) fail(`plan.punches[${n}].at must fall inside plan.keep`);
  const hold = Number(p.hold ?? 2);
  const end = a + T.motion.punch.inSeconds + hold + T.motion.punch.outSeconds;
  if (end > total + 1e-6) warn(`punch ${n} runs past the end and will be cut off`);
  punches.push({ at: r3(a), hold });
});
punches.sort((a, b) => a.at - b.at);
punches.forEach((p, i) => {
  if (i && p.at - punches[i - 1].at < T.motion.punch.minGapSeconds) warn(`punches at ${punches[i - 1].at}s and ${p.at}s are closer than ${T.motion.punch.minGapSeconds}s`);
});

// ---- write files ------------------------------------------------------------------------------
const tokensCss = tokensToCss(T, "design/" + T.font.file);
const motionJs = readFileSync(join(dir, "design/components/_motion.js"), "utf8");
const { banned: _banned, ...T_EMBED } = T; // the banned list is policy, not runtime data
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const fill = (tpl, id, data) =>
  tpl
    .replaceAll("/*__TOKENS_CSS__*/", tokensCss)
    .replaceAll("/*__MOTION_JS__*/", motionJs)
    .replaceAll("/*__TOKENS_JSON__*/", safeJson(T_EMBED))
    .replaceAll("/*__DATA_JSON__*/", safeJson(data))
    .replaceAll("__COMP_ID__", id);
const component = (name) => readFileSync(join(dir, "design/components", name + ".html"), "utf8");

mkdirSync(join(dir, "compositions"), { recursive: true });
for (const f of readdirSync(join(dir, "compositions"))) if (/^gfx-\d+\.html$/.test(f) || f === "captions.html") rmSync(join(dir, "compositions", f));

writeFileSync(join(dir, "compositions/captions.html"), fill(component("captions"), "captions", { groups: capGroups }));
for (const g of gfx) if (g.type !== "custom") writeFileSync(join(dir, `compositions/${g.id}.html`), fill(component(g.type), g.id, g.data));

const hostAttrs = (id, start, dur, track, z, extra = "", src = `compositions/${id}.html`) =>
  `id="host-${id}" class="clip" data-composition-id="${id}"${extra} data-composition-src="${src}" data-start="${start}" data-duration="${dur}" data-track-index="${track}" data-width="1080" data-height="1920" style="z-index:${z}"`;
const hosts = [
  ...gfx.map((g) => `      <div ${hostAttrs(g.id, g.start, g.duration, 2, 20, "", g.src)}></div>`),
  `      <div ${hostAttrs("captions", 0, total, 3, 30, ' data-track-kind="captions"')}></div>`,
].join("\n");
const vids = videoClips
  .map(
    (c, i) =>
      `        <video id="v-${i}" class="clip" src="${angles[c.angle]}" data-start="${c.start}" data-duration="${c.duration}" data-media-start="${c.mediaStart}" data-track-index="0" muted playsinline></video>`,
  )
  .join("\n");
const auds = audioClips
  .map(
    (c, i) =>
      `      <audio id="aud-${i}" src="${media.audio}" data-start="${c.start}" data-duration="${c.duration}" data-media-start="${c.mediaStart}" data-track-index="1"${c.fadeIn ? ` data-fade-in="${c.fadeIn}"` : ""}${c.fadeOut ? ` data-fade-out="${c.fadeOut}"` : ""}></audio>`,
  )
  .join("\n");
const P = T.motion.punch;
const punchJs = punches
  .map(
    (p) =>
      `      tl.to("#stage", { scale: ${P.scale}, duration: ${P.inSeconds}, ease: T.motion.ease.inOut }, ${p.at});\n` +
      `      tl.to("#stage", { scale: 1, duration: ${P.outSeconds}, ease: T.motion.ease.inOut }, ${r3(p.at + P.inSeconds + p.hold)});`,
  )
  .join("\n");
const indexHtml = readFileSync(join(dir, "design/components/index.html"), "utf8")
  .replaceAll("/*__TOKENS_CSS__*/", tokensCss)
  .replaceAll("/*__TOKENS_JSON__*/", safeJson(T_EMBED))
  .replace("__DURATION__", String(total))
  .replace("__VIDEO_CLIPS__", vids)
  .replace("__AUDIO_CLIPS__", auds)
  .replace("__HOSTS__", hosts)
  .replace("__PUNCHES__", punchJs);
writeFileSync(join(dir, "index.html"), indexHtml);

// SRT sidecar (timeline time, verbatim)
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
writeFileSync(
  join(dir, "captions.srt"),
  capGroups.map((g, i) => `${i + 1}\n${ts(g.start)} --> ${ts(g.end)}\n${g.words.map((w) => w.text).join(" ")}\n`).join("\n"),
);

// ---- report -----------------------------------------------------------------------------------
console.log(
  [
    `built ${dir}`,
    `  design system   v${T.version}`,
    `  duration        ${total}s (kept ${merged.length} range${merged.length > 1 ? "s" : ""})`,
    `  caption groups  ${capGroups.length}, emphasized words ${capGroups.reduce((n, g) => n + g.words.filter((w) => w.emphasis).length, 0)}`,
    `  graphics        ${gfx.length}`,
    `  picture clips   ${videoClips.length}, punches ${punches.length}`,
    `  next            npm run check (in the episode dir), then npx hyperframes snapshot`,
  ].join("\n"),
);
if (warnings.length) console.log("\nwarnings:\n" + warnings.map((w) => "  - " + w).join("\n"));
