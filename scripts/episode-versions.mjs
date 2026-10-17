#!/usr/bin/env node
// Keep exact before/after records of an episode so the after-action report is a diff, not a memory.
//
//   node scripts/episode-versions.mjs snapshot episodes/<id> v1     save plan, tokens, transcript as versions/v1/
//   node scripts/episode-versions.mjs diff episodes/<id> v1 [vN]    markdown list of changes v1 -> vN (default: current)
//
// Snapshot every render. The first render is "v1 (editor render)". The diff v1 -> posted version
// is the "what the editor did vs what shipped" table in the AAR.

import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [cmd, epArg, a, b] = process.argv.slice(2);
if (!cmd || !epArg) usage();
const dir = resolve(epArg);
function usage() {
  console.error("usage: episode-versions.mjs snapshot <episode> <vN> | diff <episode> <vA> [vB]");
  process.exit(1);
}
const FILES = [
  ["plan.json", "plan.json"],
  ["design/tokens.json", "tokens.json"],
  ["transcript.json", "transcript.json"],
];

if (cmd === "snapshot") {
  if (!a) usage();
  const out = join(dir, "versions", a);
  mkdirSync(out, { recursive: true });
  for (const [src, name] of FILES) if (existsSync(join(dir, src))) cpSync(join(dir, src), join(out, name));
  console.log(`saved versions/${a}`);
} else if (cmd === "diff") {
  if (!a) usage();
  const load = (v, name, current) => {
    const p = v ? join(dir, "versions", v, name) : join(dir, current);
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  };
  const lines = [];
  for (const [cur, name] of FILES) {
    const before = load(a, name, cur);
    const after = load(b, name, cur);
    if (!before || !after) continue;
    const d = diff(before, after);
    if (d.length) lines.push(`### ${cur}`, ...d.map((x) => `- ${x}`), "");
  }
  console.log(lines.length ? lines.join("\n") : `no differences between ${a} and ${b || "current"}`);
} else usage();

function flat(o, prefix = "", out = {}) {
  if (Array.isArray(o)) {
    if (!o.length) out[prefix] = "[]";
    o.forEach((v, i) => flat(v, `${prefix}[${i}]`, out));
  } else if (o && typeof o === "object") {
    const keys = Object.keys(o);
    if (!keys.length) out[prefix] = "{}";
    for (const k of keys) flat(o[k], prefix ? `${prefix}.${k}` : k, out);
  } else out[prefix] = o;
  return out;
}
function diff(x, y) {
  const fx = flat(x), fy = flat(y);
  const keys = [...new Set([...Object.keys(fx), ...Object.keys(fy)])];
  const show = (v) => (v === undefined ? "(none)" : typeof v === "string" ? JSON.stringify(v) : String(v));
  return keys
    .filter((k) => fx[k] !== fy[k])
    .map((k) => `\`${k}\`: ${show(fx[k])} -> ${show(fy[k])}`);
}
