#!/usr/bin/env node
// Validate every episode folder. Run in CI and by /episode before handing back a render.
//
//   node scripts/validate-episodes.mjs

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { readEpisode } from "./lib/frontmatter.mjs";

const root = resolve(import.meta.dirname, "..");
const epRoot = join(root, "episodes");
const STATUS = ["intake", "clarified", "editing", "review", "posted"];
const HOOKS = ["", "question", "bold-claim", "story", "verse-first", "contrast", "other"];
const SECTIONS = ["Intent", "Scripture", "Transcript", "Clarity notes", "Hook log", "Decisions", "Graphics plan", "Revision log", "After-Action Report", "Performance addendum"];
const BANNED = JSON.parse(readFileSync(join(root, "design-system/tokens.json"), "utf8")).banned;
const errors = [];
const warns = [];

const dirs = existsSync(epRoot) ? readdirSync(epRoot).filter((d) => !d.startsWith("_") && statSync(join(epRoot, d)).isDirectory()) : [];
for (const id of dirs) {
  const dir = join(epRoot, id);
  const err = (m) => errors.push(`${id}: ${m}`);
  const warn = (m) => warns.push(`${id}: ${m}`);
  const mdPath = join(dir, "episode.md");
  if (!existsSync(mdPath)) {
    err("episode.md missing");
    continue;
  }
  let ep;
  try {
    ep = readEpisode(mdPath);
  } catch (e) {
    err(e.message);
    continue;
  }
  const d = ep.data;
  if (d.id !== id) err(`frontmatter id "${d.id}" does not match folder name`);
  if (!STATUS.includes(d.status)) err(`status must be one of ${STATUS.join(", ")}`);
  if (!/^\d+\.\d+\.\d+$/.test(String(d.design_system_version || ""))) err("design_system_version must be semver");
  if (!HOOKS.includes(d.hook_type ?? "")) err(`hook_type must be one of ${HOOKS.filter(Boolean).join(", ")}`);
  if (d.status === "posted") {
    if (!d.youtube_id) err("posted but youtube_id is empty");
    if (!d.posted_at) err("posted but posted_at is empty");
    if (!/## After-Action Report\s+\S/.test(ep.body.replace(/<!--[\s\S]*?-->/g, ""))) err("posted but the After-Action Report is empty");
  }
  for (const s of SECTIONS) if (!new RegExp(`^## ${s}\\s*$`, "m").test(ep.body)) err(`missing section "## ${s}"`);
  for (const m of d.media || []) if (m.sha256 && !/^[0-9a-f]{64}$/.test(m.sha256)) err(`media ${m.file}: sha256 is not a valid hash`);
  if (/status:\s*unverified/.test(ep.body) && ["editing", "review", "posted"].includes(d.status)) warn("Scripture block is still unverified");

  const planPath = join(dir, "plan.json");
  if (existsSync(planPath)) {
    let plan;
    try {
      plan = JSON.parse(readFileSync(planPath, "utf8"));
    } catch (e) {
      err(`plan.json is not valid JSON: ${e.message}`);
    }
    if (plan) {
      (plan.graphics || []).forEach((g, i) => {
        if (!g.reason) err(`plan.graphics[${i}] has no reason`);
        if (g.type === "verse-card" && g.confirmed !== true) err(`plan.graphics[${i}] verse card text is not confirmed`);
      });
      if (plan.keep?.length && !existsSync(join(dir, "transcript.json"))) err("plan.keep is set but transcript.json is missing");
      for (const [k, p] of Object.entries(plan.media?.angles || {})) if (d.status !== "intake" && !existsSync(join(dir, p))) warn(`angle ${k} working copy ${p} not found (media is local only)`);
    }
  }
  // banned effects in anything a human or agent wrote: templates and custom compositions (generated files embed verse text)
  const authored = [
    ...(existsSync(join(dir, "compositions")) ? readdirSync(join(dir, "compositions")).filter((f) => /^custom-.*\.html$/.test(f)).map((f) => join(dir, "compositions", f)) : []),
    ...(existsSync(join(dir, "design/components")) ? readdirSync(join(dir, "design/components")).map((f) => join(dir, "design/components", f)) : []),
  ];
  for (const f of authored) {
    const text = readFileSync(f, "utf8").toLowerCase();
    for (const b of BANNED) if (text.includes(b)) err(`${f.slice(dir.length + 1)} mentions banned effect "${b}"`);
  }
}

for (const f of existsSync(join(root, "design-system/components")) ? readdirSync(join(root, "design-system/components")) : []) {
  const text = readFileSync(join(root, "design-system/components", f), "utf8").toLowerCase();
  for (const b of BANNED) if (text.includes(b)) errors.push(`design-system/components/${f} mentions banned effect "${b}"`);
}

// footage must never be tracked, and nothing large should be
try {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
  for (const f of tracked) {
    if (/^episodes\/[^/]+\/media\/(?!\.gitkeep$)/.test(f)) errors.push(`${f} is tracked. Footage and renders stay out of Git.`);
    else if (existsSync(join(root, f)) && statSync(join(root, f)).size > 5 * 1024 * 1024) warns.push(`${f} is over 5 MB and tracked`);
  }
} catch {
  /* not a git repo yet */
}

for (const w of warns) console.warn("warn: " + w);
if (errors.length) {
  console.error("episode validation failed:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(`episodes valid (${dirs.length} checked)`);
