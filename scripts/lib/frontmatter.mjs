// Minimal frontmatter reader/writer for episode.md. Handles the subset in docs/schemas.md:
// scalars, one nested map (effort), and one list of maps (media). No dependencies.
import { readFileSync, writeFileSync } from "node:fs";

function parseScalar(raw) {
  const v = raw.trim();
  if (v === "" ) return "";
  if (v === "null" || v === "~") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\"/g, '"');
  }
  return v.replace(/\s+#.*$/, "");
}

export function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { yaml: m[1], body: m[2] };
}

export function parseFrontmatter(yaml) {
  const out = {};
  const lines = yaml.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) { i++; continue; }
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) { i++; continue; }
    const [, key, rest] = m;
    if (rest.trim() !== "" && !rest.startsWith("#")) {
      out[key] = parseScalar(rest);
      i++;
      continue;
    }
    // block value: nested map or list
    const block = [];
    i++;
    while (i < lines.length && (/^\s+/.test(lines[i]) || !lines[i].trim())) {
      if (lines[i].trim()) block.push(lines[i]);
      i++;
    }
    if (block.length && block[0].trim().startsWith("- ")) {
      const list = [];
      let cur = null;
      for (const b of block) {
        const t = b.trim();
        if (t.startsWith("- ")) {
          cur = {};
          list.push(cur);
          const kv = t.slice(2).match(/^([A-Za-z0-9_]+):\s*(.*)$/);
          if (kv) cur[kv[1]] = parseScalar(kv[2]);
        } else if (cur) {
          const kv = t.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
          if (kv) cur[kv[1]] = parseScalar(kv[2]);
        }
      }
      out[key] = list;
    } else {
      const map = {};
      for (const b of block) {
        const kv = b.trim().match(/^([A-Za-z0-9_]+):\s*(.*)$/);
        if (kv) map[kv[1]] = parseScalar(kv[2]);
      }
      out[key] = map;
    }
  }
  return out;
}

export function readEpisode(path) {
  const text = readFileSync(path, "utf8");
  const parts = splitFrontmatter(text);
  if (!parts) throw new Error(`${path}: missing frontmatter`);
  return { data: parseFrontmatter(parts.yaml), yaml: parts.yaml, body: parts.body };
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
