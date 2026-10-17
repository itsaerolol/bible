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
