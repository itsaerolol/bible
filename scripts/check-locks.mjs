#!/usr/bin/env node
// Enforce what the learning loop may not touch. Run in CI with full history (fetch-depth: 0).
//
//   node scripts/check-locks.mjs            check every commit
//   CHECK_LOCKS_RANGE=origin/main..HEAD node scripts/check-locks.mjs
//
// Rules
//  1. Locked files may only be modified or deleted by a commit whose message contains [unlock].
//  2. Commits whose subject starts with "evolve:" may only touch the loop's paths.
//  3. Locked files must keep their LOCKED header.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const LOCKED = ["policy/editorial-contract.md", "policy/scripture.md", "policy/learning-loop.md"];
const LOOP_PATHS = [/^design-system\//, /^policy\/clarity-and-hooks\.md$/];
const isLocked = (f) => LOCKED.includes(f) || /^episodes\/[^/]+\/media\/(?!\.gitkeep$)/.test(f);

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const range = process.env.CHECK_LOCKS_RANGE;
let out = "";
try {
  out = git("log", "--no-merges", "--name-status", "--format=%x01%H%x09%s%x09%B%x02", ...(range ? [range] : []));
} catch {
  console.log("no git history yet, nothing to check");
}

const problems = [];
for (const chunk of out.split("\x01").filter(Boolean)) {
  const [head, rest = ""] = chunk.split("\x02");
  const [sha, subject, ...body] = head.split("\t");
  const message = [subject, ...body].join("\n");
  const unlocked = /\[unlock\]/i.test(message);
  for (const line of rest.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [status, ...files] = line.split("\t");
    for (const f of files) {
      if (isLocked(f) && /^[MD]|^R/.test(status) && !unlocked) {
        problems.push(`${sha.slice(0, 8)} ${status} ${f}: locked file changed without [unlock] ("${subject}")`);
      }
      if (/^evolve:/i.test(subject) && !unlocked && !LOOP_PATHS.some((re) => re.test(f))) {
        problems.push(`${sha.slice(0, 8)} evolve commit touched ${f}, outside the loop's paths`);
      }
    }
  }
}
for (const f of LOCKED) {
  const p = resolve(root, f);
  if (!existsSync(p)) problems.push(`${f} is missing`);
  else if (!/LOCKED/.test(readFileSync(p, "utf8").split("\n")[0])) problems.push(`${f} lost its LOCKED header`);
}

if (problems.length) {
  console.error("lock check failed:\n" + [...new Set(problems)].map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log("lock check passed");
