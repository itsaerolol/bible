import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Channel, Dataset, Episode, Insights, SyncStatus, VideoFile } from "./types";

// dashboard/.data is a copy of the repo's data/ folder made by scripts/prepare-data.mjs.
const DATA_DIR = path.join(process.cwd(), ".data");

let cache: Dataset | null = null;

function readJson<T>(rel: string, warnings: string[]): T | null {
  const p = path.join(DATA_DIR, rel);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch (e) {
    warnings.push(`${rel} could not be read: ${(e as Error).message}`);
    return null;
  }
}

export function loadDataset(): Dataset {
  if (cache) return cache;
  const warnings: string[] = [];
  const mock = fs.existsSync(path.join(DATA_DIR, ".mock"));
  const channel = readJson<Channel>("analytics/channel.json", warnings);
  const status = readJson<SyncStatus>("analytics/sync-status.json", warnings);
  const insights = readJson<Insights>("insights.json", warnings);
  const index = readJson<{ episodes: Episode[] }>("episodes-index.json", warnings);

  const videos: VideoFile[] = [];
  const vdir = path.join(DATA_DIR, "analytics", "videos");
  if (fs.existsSync(vdir)) {
    for (const f of fs.readdirSync(vdir).sort()) {
      if (!f.endsWith(".json")) continue;
      const v = readJson<VideoFile>(`analytics/videos/${f}`, warnings);
      if (v && Array.isArray(v.snapshots)) videos.push(v);
      else if (v) warnings.push(`analytics/videos/${f} has no snapshots array`);
    }
  }
  videos.sort((a, b) => b.published_at.localeCompare(a.published_at));

  const lastSyncAt = status?.generated_at ?? channel?.generated_at ?? null;
  const allSnaps = videos.flatMap((v) => v.snapshots.map((s) => s.date)).sort();
  const refDate = status?.sync_date ?? (lastSyncAt ? lastSyncAt.slice(0, 10) : (allSnaps.at(-1) ?? null));
  const dataThrough =
    status?.data_through ??
    videos
      .flatMap((v) => v.snapshots.map((s) => s.data_through ?? s.date))
      .sort()
      .at(-1) ??
    channel?.daily.at(-1)?.date ??
    null;

  cache = {
    mock,
    channel,
    videos,
    episodes: index?.episodes ?? [],
    insights,
    status,
    refDate,
    lastSyncAt,
    dataThrough,
    warnings,
  };
  return cache;
}
