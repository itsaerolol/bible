// Frontmatter helpers for episode.md. Reading uses scripts/lib/yaml-lite.mjs, the single parser.
// The writers below edit the text directly so comments and field order are preserved.
import { readFileSync, writeFileSync } from "node:fs";
import { parseFrontmatterDoc } from "./yaml-lite.mjs";

export function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { yaml: m[1], body: m[2] };
}

export function readEpisode(path) {
  const { data, body, error } = parseFrontmatterDoc(readFileSync(path, "utf8"));
  if (!data) throw new Error(`${path}: ${error || "frontmatter is not a mapping"}`);
  return { data, body };
}

// Replace the `media:` block in the frontmatter with the given entries.
export function writeMediaBlock(path, media) {
  const text = readFileSync(path, "utf8");
  const parts = splitFrontmatter(text);
  if (!parts) throw new Error(`${path}: missing frontmatter`);
  const block =
    "media:\n" +
    media
      .map((m) => `  - file: ${m.file}\n    role: ${m.role}\n    sha256: ${m.sha256}`)
      .join("\n");
  const lines = parts.yaml.split(/\r?\n/);
  const start = lines.findIndex((l) => /^media:/.test(l));
  let yaml;
  if (start === -1) yaml = parts.yaml + "\n" + block;
  else {
    let end = start + 1;
    while (end < lines.length && (/^\s+/.test(lines[end]) || !lines[end].trim())) end++;
    yaml = [...lines.slice(0, start), block, ...lines.slice(end)].join("\n");
  }
  writeFileSync(path, `---\n${yaml}\n---\n${parts.body}`);
}

// Set simple top-level scalar fields.
export function setScalars(path, fields) {
  let text = readFileSync(path, "utf8");
  for (const [k, v] of Object.entries(fields)) {
    const val = v === null ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v);
    const re = new RegExp(`^${k}:.*$`, "m");
    if (re.test(text)) text = text.replace(re, `${k}: ${val}`);
    else text = text.replace(/^---\r?\n/, `---\n${k}: ${val}\n`);
  }
  writeFileSync(path, text);
}
