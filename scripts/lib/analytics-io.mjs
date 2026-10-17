// Shared helpers for the analytics scripts: JSON I/O, dates, small math. No dependencies.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function readJson(path, fallback = undefined) {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing file: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`invalid JSON in ${path}: ${e.message}`);
  }
}

// Pretty JSON, but arrays of flat objects ("rows") stay one row per line so retention curves do not
// bloat git diffs. Everything else is indented with 2 spaces.
export function stringifyData(value) {
  const isScalar = (v) => v === null || typeof v !== "object";
  const isFlatObj = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every(isScalar);
  function walk(v, depth) {
    const pad = "  ".repeat(depth);
    const pad1 = "  ".repeat(depth + 1);
    if (isScalar(v)) return JSON.stringify(v);
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      if (v.every(isScalar)) return "[" + v.map((x) => JSON.stringify(x)).join(", ") + "]";
      if (v.every(isFlatObj)) return "[\n" + v.map((x) => pad1 + JSON.stringify(x)).join(",\n") + "\n" + pad + "]";
      return "[\n" + v.map((x) => pad1 + walk(x, depth + 1)).join(",\n") + "\n" + pad + "]";
    }
    const keys = Object.keys(v).filter((k) => v[k] !== undefined);
    if (keys.length === 0) return "{}";
    return "{\n" + keys.map((k) => `${pad1}${JSON.stringify(k)}: ${walk(v[k], depth + 1)}`).join(",\n") + "\n" + pad + "}";
  }
  return walk(value, 0) + "\n";
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, stringifyData(value));
  renameSync(tmp, path);
}

export const isoDate = (d) => d.toISOString().slice(0, 10);

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export const isDateStr = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export function median(values) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export const round = (n, dp) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 10 ** dp) / 10 ** dp : null);

// GitHub Actions log helpers (plain text elsewhere).
const inActions = !!process.env.GITHUB_ACTIONS;
export const log = {
  info: (m) => console.log(m),
  notice: (m) => console.log(inActions ? `::notice::${m}` : `NOTICE: ${m}`),
  warn: (m) => console.warn(inActions ? `::warning::${m}` : `WARN: ${m}`),
  error: (m) => console.error(inActions ? `::error::${m}` : `ERROR: ${m}`),
};

export function parseArgs(argv, spec = {}) {
  // spec: { flagName: "bool" | "string" | "number" | "list" }
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      out._.push(...argv.slice(i + 1));
      break;
    }
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    const name = (eq > 0 ? a.slice(2, eq) : a.slice(2)).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const kind = spec[name];
    if (!kind) throw new Error(`unknown option: ${a}`);
    if (kind === "bool") {
      out[name] = true;
      continue;
    }
    const val = eq > 0 ? a.slice(eq + 1) : argv[++i];
    if (val === undefined) throw new Error(`option --${name} needs a value`);
    if (kind === "number") {
      const n = Number(val);
      if (!Number.isFinite(n)) throw new Error(`option --${name} needs a number, got "${val}"`);
      out[name] = n;
    } else if (kind === "list") (out[name] ??= []).push(val);
    else out[name] = val;
  }
  return out;
}
