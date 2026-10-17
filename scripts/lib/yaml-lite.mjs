// Tiny dependency-free YAML subset parser, enough for episode frontmatter (docs/schemas.md).
//
// Supports: block mappings, block sequences (of scalars or mappings), quoted and plain scalars,
// inline comments, null/bool/number detection, flow [a, b] and {a: b}, and | > block scalars.
// Not supported: anchors, tags, multi-document streams, complex keys.
//
// Scalars that look like dates or timestamps stay strings, so the JSON output matches what the
// authors wrote.

export class YamlError extends Error {}

function stripComment(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === "\\" && q === '"') i++;
      else if (c === q) {
        if (q === "'" && s[i + 1] === "'") i++;
        else q = null;
      }
    } else if (c === '"' || c === "'") {
      // a quote only opens a string at the start of a token
      if (i === 0 || /[\s,[{:]/.test(s[i - 1])) q = c;
    } else if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i).trimEnd();
    }
  }
  return s.trimEnd();
}

function unquote(s) {
  if (s.startsWith('"')) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }
  return s.slice(1, -1).replace(/''/g, "'");
}

function plainScalar(raw) {
  const v = raw.trim();
  if (v === "" || v === "~" || v === "null" || v === "Null" || v === "NULL") return null;
  if (v === "true" || v === "True" || v === "TRUE") return true;
  if (v === "false" || v === "False" || v === "FALSE") return false;
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

// ---- flow collections ----
function parseFlow(src) {
  let i = 0;
  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  function value() {
    ws();
    if (src[i] === "[") return seq();
    if (src[i] === "{") return map();
    if (src[i] === '"' || src[i] === "'") return quoted();
    let j = i;
    while (j < src.length && !",]}".includes(src[j])) {
      if (src[j] === ":" && /\s/.test(src[j + 1] ?? " ")) break;
      j++;
    }
    const t = src.slice(i, j);
    i = j;
    return plainScalar(t);
  }
  function quoted() {
    const q = src[i];
    let j = i + 1;
    while (j < src.length) {
      if (src[j] === "\\" && q === '"') j += 2;
      else if (src[j] === q) {
        if (q === "'" && src[j + 1] === "'") j += 2;
        else break;
      } else j++;
    }
    const t = src.slice(i, j + 1);
    i = j + 1;
    return unquote(t);
  }
  function seq() {
    i++;
    const out = [];
    ws();
    while (i < src.length && src[i] !== "]") {
      out.push(value());
      ws();
      if (src[i] === ",") i++;
      ws();
    }
    if (src[i] !== "]") throw new YamlError("unterminated flow sequence");
    i++;
    return out;
  }
  function map() {
    i++;
    const out = {};
    ws();
    while (i < src.length && src[i] !== "}") {
      const k = value();
      ws();
      if (src[i] !== ":") throw new YamlError("expected ':' in flow mapping");
      i++;
      out[String(k)] = value();
      ws();
      if (src[i] === ",") i++;
      ws();
    }
    if (src[i] !== "}") throw new YamlError("unterminated flow mapping");
    i++;
    return out;
  }
  const v = value();
  ws();
  if (i < src.length) throw new YamlError(`trailing text in flow value: ${src.slice(i)}`);
  return v;
}

function inlineValue(raw) {
  const s = stripComment(raw.trim());
  if (s === "") return null;
  if (s[0] === '"' || s[0] === "'") {
    const q = s[0];
    // whole value must be one quoted string
    if (s.length >= 2 && s.endsWith(q)) return unquote(s);
    throw new YamlError(`unterminated quoted string: ${s}`);
  }
  if (s[0] === "[" || s[0] === "{") return parseFlow(s);
  return plainScalar(s);
}

// ---- block structure ----
const KEY_RE = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^']|'')*)'|([^\s#:'"\-?[\]{}][^:#]*?|-[^\s:][^:#]*?))\s*:(?:\s+(.*))?$/;

function lineKey(text) {
  const m = text.match(KEY_RE);
  if (!m) return null;
  const key = m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2] !== undefined ? m[2].replace(/''/g, "'") : m[3].trim();
  return { key, rest: m[4] ?? "" };
}

export function parseYaml(text) {
  const raw = text.replace(/^﻿/, "").split(/\r?\n/);
  const lines = [];
  for (let n = 0; n < raw.length; n++) {
    const l = raw[n];
    if (/^\s*(#.*)?$/.test(l)) {
      lines.push({ blank: true, indent: 0, text: "", n, raw: l });
      continue;
    }
    if (/^\t/.test(l)) throw new YamlError(`line ${n + 1}: tabs are not allowed for indentation`);
    const indent = l.length - l.trimStart().length;
    lines.push({ blank: false, indent, text: l.trimStart(), n, raw: l });
  }
  let pos = 0;
  const skipBlank = () => {
    while (pos < lines.length && lines[pos].blank) pos++;
  };

  function blockScalar(style, parentIndent) {
    const fold = style[0] === ">";
    const chomp = style.includes("-") ? "strip" : style.includes("+") ? "keep" : "clip";
    const body = [];
    let blockIndent = null;
    while (pos < lines.length) {
      const l = lines[pos];
      if (l.blank && /^\s*$/.test(l.raw)) {
        body.push("");
        pos++;
        continue;
      }
      if (l.blank) {
        // a comment-only line inside a block scalar is content only if indented deeper
        const ind = l.raw.length - l.raw.trimStart().length;
        if (ind > parentIndent) {
          body.push(l.raw.slice(blockIndent ?? ind));
          pos++;
          continue;
        }
        break;
      }
      if (l.indent <= parentIndent) break;
      if (blockIndent === null) blockIndent = l.indent;
      body.push(l.raw.slice(Math.min(blockIndent, l.indent)));
      pos++;
    }
    while (body.length && body[body.length - 1] === "" && chomp !== "keep") body.pop();
    let out;
    if (fold) {
      out = "";
      body.forEach((ln, idx) => {
        if (idx === 0) out = ln;
        else if (ln === "") out += "\n";
        else if (body[idx - 1] === "") out += ln;
        else out += " " + ln;
      });
    } else out = body.join("\n");
    if (chomp !== "strip" && body.length) out += "\n";
    return out;
  }

  function valueAfterKey(rest, indent) {
    const r = stripComment(rest.trim());
    if (r === "|" || r === ">" || /^[|>][+-]?$/.test(r)) return blockScalar(r, indent);
    if (r !== "") return inlineValue(rest);
    // nested block or null
    skipBlank();
    if (pos >= lines.length) return null;
    const next = lines[pos];
    if (next.indent > indent) return parseBlock(next.indent);
    if (next.indent === indent && /^-(\s|$)/.test(next.text)) return parseBlock(indent); // "key:\n- a"
    return null;
  }

  function parseBlock(indent) {
    skipBlank();
    if (pos >= lines.length) return null;
    const first = lines[pos];
    if (/^-(\s|$)/.test(first.text)) return parseSeq(first.indent);
    if (lineKey(first.text)) return parseMap(first.indent);
    // lone scalar line
    pos++;
    return inlineValue(first.text);
  }

  function parseSeq(indent) {
    const out = [];
    for (;;) {
      skipBlank();
      if (pos >= lines.length) break;
      const l = lines[pos];
      if (l.indent !== indent || !/^-(\s|$)/.test(l.text)) {
        if (l.indent > indent) throw new YamlError(`line ${l.n + 1}: unexpected indentation in sequence`);
        break;
      }
      const after = l.text.replace(/^-\s*/, "");
      if (after === "" || after.startsWith("#")) {
        pos++;
        skipBlank();
        if (pos < lines.length && lines[pos].indent > indent) out.push(parseBlock(lines[pos].indent));
        else out.push(null);
        continue;
      }
      const offset = l.text.length - after.length;
      if (/^-(\s|$)/.test(after)) {
        // nested sequence on the same line
        lines[pos] = { ...l, indent: indent + offset, text: after };
        out.push(parseSeq(indent + offset));
        continue;
      }
      const k = lineKey(after);
      if (k) {
        // inline mapping start: re-parse as a mapping whose indent is the key column
        lines[pos] = { ...l, indent: indent + offset, text: after };
        out.push(parseMap(indent + offset));
      } else {
        pos++;
        out.push(inlineValue(after));
      }
    }
    return out;
  }

  function parseMap(indent) {
    const out = {};
    for (;;) {
      skipBlank();
      if (pos >= lines.length) break;
      const l = lines[pos];
      if (l.indent < indent) break;
      if (l.indent > indent) throw new YamlError(`line ${l.n + 1}: unexpected indentation`);
      if (/^-(\s|$)/.test(l.text)) break;
      const k = lineKey(l.text);
      if (!k) throw new YamlError(`line ${l.n + 1}: cannot parse "${l.text}"`);
      pos++;
      out[k.key] = valueAfterKey(k.rest, indent);
    }
    return out;
  }

  skipBlank();
  if (pos >= lines.length) return {};
  const result = parseBlock(lines[pos].indent);
  skipBlank();
  if (pos < lines.length) throw new YamlError(`line ${lines[pos].n + 1}: unexpected content`);
  return result;
}

// Split "---\nfrontmatter\n---\nbody" and parse the frontmatter.
export function parseFrontmatterDoc(text) {
  const m = text.replace(/^﻿/, "").match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n([\s\S]*))?$/);
  if (!m) return { data: null, body: text, error: "no frontmatter block" };
  try {
    const data = parseYaml(m[1]);
    return { data: data && typeof data === "object" && !Array.isArray(data) ? data : null, body: m[2] ?? "" };
  } catch (e) {
    return { data: null, body: m[2] ?? "", error: e.message };
  }
}
