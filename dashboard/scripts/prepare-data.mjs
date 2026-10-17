// Copy ../data (committed by the daily Action) into dashboard/.data so the build only reads files inside
// the project directory. Runs before `dev` and `build` (npm pre-scripts).
//
// Vercel note: with Root Directory set to `dashboard`, ../data is only visible if the project builds from
// the full clone. If the copy cannot find it, the build fails loudly instead of deploying an empty site.
// Override the source with DASHBOARD_DATA_SRC=/path/to/data.
import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(here, "..");
const src = resolve(process.env.DASHBOARD_DATA_SRC ?? join(projectDir, "..", "data"));
const dest = join(projectDir, ".data");

function walk(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      const r = walk(p);
      files += r.files;
      bytes += r.bytes;
    } else {
      files++;
      bytes += s.size;
    }
  }
  return { files, bytes };
}

if (!existsSync(src)) {
  const onCi = !!(process.env.VERCEL || process.env.CI || process.env.GITHUB_ACTIONS);
  if (onCi) {
    console.error(
      `prepare-data: ${src} does not exist. On Vercel, keep "Include source files outside of the Root Directory in the Build Step" enabled (Project Settings > Build and Deployment > Root Directory), or set DASHBOARD_DATA_SRC.`,
    );
    process.exit(1);
  }
  if (existsSync(dest)) {
    console.warn(`prepare-data: ${src} not found, keeping the existing .data`);
  } else {
    console.warn(`prepare-data: ${src} not found. The dashboard will render empty states. Run: node ../scripts/make-mock-data.mjs`);
  }
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
const { files, bytes } = walk(dest);
const mock = existsSync(join(dest, ".mock"));
console.log(`prepare-data: copied ${files} file(s), ${(bytes / 1024).toFixed(0)} KB from ${src} to .data${mock ? " (MOCK DATA)" : ""}`);
