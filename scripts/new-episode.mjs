#!/usr/bin/env node
// Create an episode folder as a self-contained HyperFrames project pinned to the current design system.
//
//   node scripts/new-episode.mjs <slug> [--date YYYY-MM-DD]
//
// The episode copies design-system/ into its own design/ folder so later design changes never alter it.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HF_VERSION = "0.8.168"; // pinned so renders stay reproducible. Bump deliberately.

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const slug = (args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--date") || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
if (!slug) {
  console.error("usage: new-episode.mjs <slug> [--date YYYY-MM-DD]");
  process.exit(1);
}
const di = args.indexOf("--date");
const date = di >= 0 ? args[di + 1] : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("--date must be YYYY-MM-DD");
  process.exit(1);
}
const id = `${date}-${slug}`;
const dir = join(root, "episodes", id);
if (existsSync(dir)) {
  console.error(`episodes/${id} already exists`);
  process.exit(1);
}
const tokens = JSON.parse(readFileSync(join(root, "design-system/tokens.json"), "utf8"));

mkdirSync(join(dir, "media"), { recursive: true });
writeFileSync(join(dir, "media/.gitkeep"), "");
for (const part of ["tokens.json", "fonts", "vendor", "components", "DESIGN.md"]) {
  cpSync(join(root, "design-system", part), join(dir, "design", part), { recursive: true });
}

const template = readFileSync(join(root, "episodes/_template/episode.md"), "utf8")
  .replaceAll("__ID__", id)
  .replaceAll("__DS_VERSION__", tokens.version);
writeFileSync(join(dir, "episode.md"), template);

writeFileSync(
  join(dir, "hyperframes.json"),
  JSON.stringify(
    {
      $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
      registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
      paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
      media: { autoProxy: true },
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(join(dir, "meta.json"), JSON.stringify({ id, name: id, createdAt: new Date().toISOString() }, null, 2) + "\n");
writeFileSync(
  join(dir, "package.json"),
  JSON.stringify(
    {
      name: id,
      private: true,
      type: "module",
      scripts: {
        build: "node ../../scripts/build-episode.mjs .",
        dev: `npx --yes hyperframes@${HF_VERSION} preview`,
        check: `npx --yes hyperframes@${HF_VERSION} check`,
        snapshot: `npx --yes hyperframes@${HF_VERSION} snapshot`,
        render: `npx --yes hyperframes@${HF_VERSION} render --resolution portrait -q delivery -o media/renders/v1.mp4`,
      },
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  join(dir, "plan.json"),
  JSON.stringify({ version: 1, media: {}, keep: [], angleCuts: [{ at: 0, angle: "a" }], punches: [], emphasis: [], graphics: [] }, null, 2) + "\n",
);

console.log(`created episodes/${id} (design system v${tokens.version})\nnext: put the recording in episodes/${id}/media/angle-a.mp4, then run /episode`);
