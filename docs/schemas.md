# Schemas

Shared contracts between episodes, scripts, the Action, and the dashboard.

## Episode frontmatter (`episodes/<id>/episode.md`)

`id` is `YYYY-MM-DD-slug`, also the folder name.

```yaml
---
id: 2026-10-20-example-slug
title: ""
status: intake        # intake | clarified | editing | review | posted
passage: ""           # e.g. "John 3:16-17"
translation: ""       # e.g. "ESV"
topic: ""
hook_type: ""         # question | bold-claim | story | verse-first | contrast | other
hook_original: ""
hook_final: ""
design_system_version: ""   # version pinned when the episode started
duration_sec: null
youtube_id: null      # set by /posted
posted_at: null       # ISO 8601, set by /posted
hypothesis: ""        # one thing this video tests
effort:
  revisions: 0
  edit_minutes: null
media:
  - file: media/angle-a.mp4
    role: angle-a     # angle-a | angle-b | audio | render
    sha256: ""
---
```

## Generated files in `data/` (committed by the Action)

### `data/episodes-index.json`
Built by `scripts/build-episode-index.mjs` from every `episodes/*/episode.md` frontmatter.
```json
{ "generated_at": "ISO", "episodes": [ { "...frontmatter fields..." } ] }
```

### `data/analytics/channel.json`
```json
{
  "generated_at": "ISO",
  "channel_id": "",
  "daily": [ { "date": "YYYY-MM-DD", "views": 0, "engagedViews": 0, "estimatedMinutesWatched": 0, "subscribersGained": 0, "subscribersLost": 0 } ]
}
```

### `data/analytics/videos/<youtube_id>.json`
```json
{
  "video_id": "",
  "title": "",
  "published_at": "ISO",
  "duration_sec": 0,
  "is_short": true,
  "episode_id": "2026-10-20-example-slug or null",
  "snapshots": [
    {
      "date": "YYYY-MM-DD",
      "metrics": {
        "views": 0, "engagedViews": 0, "estimatedMinutesWatched": 0,
        "averageViewDuration": 0, "averageViewPercentage": 0,
        "likes": 0, "comments": 0, "shares": 0,
        "subscribersGained": 0, "subscribersLost": 0
      },
      "traffic_sources": [ { "source": "SHORTS", "views": 0 } ],
      "retention_curve": [ { "t": 0.0, "audienceWatchRatio": 1.0, "relativeRetentionPerformance": 0.5 } ],
      "retention_source": "api",
      "unavailable": [ "retention_curve" ]
    }
  ]
}
```
Rules: `retention_curve` is `null` when unavailable and the field name goes in `unavailable`. Never write 0 for a missing metric. `retention_source` is `api` or `csv`.

### `data/insights.json` (Haiku)
```json
{
  "generated_at": "ISO",
  "model": "",
  "based_on": { "videos": 0, "date_range": ["YYYY-MM-DD", "YYYY-MM-DD"] },
  "summary": "",
  "recommendations": [
    { "title": "", "rationale": "", "evidence": ["video_id"], "confidence": "low|medium|high" }
  ],
  "caveats": [ "small sample" ]
}
```

### `data/.mock`
If this file exists, `data/` holds fabricated sample data. The dashboard shows a MOCK DATA banner. The sync script deletes it on the first real sync.

## Schema notes

Deviations and additions made by the analytics scripts (`scripts/sync-analytics.mjs`, `import-retention-csv.mjs`, `haiku-insights.mjs`, `make-mock-data.mjs`). All additions are optional for readers. `scripts/check-analytics-data.mjs` enforces this file.

Video snapshots
- All 10 `metrics` keys are always present. A metric YouTube did not return is `null`, and its name (for example `"likes"`) is listed in `unavailable`. Never `0`.
- Units: `averageViewPercentage` is percent 0 to 100, `averageViewDuration` is seconds, `estimatedMinutesWatched` is minutes. `audienceWatchRatio` is a ratio and can exceed 1 when parts are rewatched.
- `retention_source` is `null` when `retention_curve` is `null`. A curve has at least 5 points, `t` ascending in 0..1 (the API returns 0.01 to 1.00).
- `traffic_sources` is `null` when unavailable (and listed in `unavailable`). Entries may carry `engagedViews` and `estimatedMinutesWatched` besides `views`. `source` is the Analytics `insightTrafficSourceType` value, for example `SHORTS`, `YT_SEARCH`, `SUBSCRIBER`.
- Extra optional snapshot fields: `data_through` (last day YouTube had fully processed), `partial` (true in the first 2 days of data), `retention_note` and `traffic_note` (why a field is null, for example `api_error: HTTP 400 ...` or `api_empty`), `retention_carried_from` (date of the csv snapshot a curve was carried forward from), `retention_csv`, `retention_imported_at`.
- `date` is the sync date. Metrics are cumulative lifetime values through `data_through`, which is the sync date minus 3 days (YouTube's 48 to 72 hour processing delay). The same-date snapshot is replaced.
- Cadence: a new snapshot is written daily for the first 14 days of a video, weekly until day 90, monthly after.
- A video with no complete data yet (published after `data_through`) is written with `snapshots: []`.
- Only Shorts are written (duration up to 180 s). `is_short` stays in the schema for `--include-long`.

`data/analytics/channel.json`
- `daily` is channel wide, ascending, through the data lag. A day YouTube returned no row for is absent, not zero. Metrics inside a row may be `null`.

`data/analytics/sync-status.json` (new)
- Written by every real sync: `generated_at`, `sync_date`, `data_through`, `lag_days`, `mode` (`real`, `fixtures` or `mock`), counts of uploads and snapshots, `retention` (`eligible`, `api_ok`, `api_empty`, `api_error`, `csv_carried`, `verdict` of `works`, `unavailable` or `inconclusive`, `first_error`), `traffic`, `episodes` (`linked`, `unmatched_youtube_ids`), `notes`. This is where the retention-curve API test result lives.

`data/insights.json`
- Optional additions: `sample` (`videos`, `mature_videos`) and `input_hash` (lets the script skip a run when nothing changed). With fewer than 5 videos every `confidence` is `low`. `high` needs 20 or more videos older than 7 days.

`data/episodes-index.json`
- Episodes are sorted by `id`. `media` is normalised to `[]` when empty. `generated_at` is kept when the episode list did not change, to avoid empty commits.
- With `data/.mock` present the script leaves the file alone unless `--force` is passed.

`data/.mock`
- The first real sync also deletes the fabricated `data/analytics/` folder and `data/insights.json`, not just the flag file.
