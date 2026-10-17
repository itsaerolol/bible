// Design-system token helpers shared by the episode scripts.
import { readFileSync } from "node:fs";

export function loadTokens(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

// Flatten scalars to CSS custom properties: captions.maxWidth -> --captions-max-width
export function flattenTokens(obj, prefix = [], out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const path = [...prefix, kebab(k)];
    if (v && typeof v === "object" && !Array.isArray(v)) flattenTokens(v, path, out);
    else if (typeof v === "string" || typeof v === "number") out["--" + path.join("-")] = v;
  }
  return out;
}

export function tokensToCss(tokens, fontUrl) {
  const vars = flattenTokens(tokens);
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return (
    `@font-face { font-family: "${tokens.font.family}"; src: url("${fontUrl}") format("woff2"); font-weight: 100 900; font-display: block; }\n` +
    `:root {\n${lines.join("\n")}\n}`
  );
}
