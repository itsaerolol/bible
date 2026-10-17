# plan.json

The edit, as data. Lives in each episode folder. `scripts/build-episode.mjs` turns it plus `transcript.json` and the pinned `design/` into the HyperFrames project.

**All times are source time**: seconds on the master audio clock (angle A, `media/audio.wav`). The builder maps them through `keep` to timeline time, so captions and graphics stay in sync after cuts.

```json
{
  "version": 1,
  "media": {
    "audio": "media/audio.wav",
    "angles": { "a": "media/work/angle-a.mp4", "b": "media/work/angle-b.mp4" },
    "angleOffsetSeconds": { "a": 0, "b": 0.7 },
    "sourceDurationSeconds": 58.2
  },
  "keep": [ { "from": 0.2, "to": 6.6 }, { "from": 7.1, "to": 11.3 } ],
  "angleCuts": [
    { "at": 0, "angle": "a" },
    { "at": 3.0, "angle": "b", "style": "j" },
    { "at": 8.2, "angle": "a", "style": "l" }
  ],
  "punches": [ { "at": 4.2, "hold": 1.5 } ],
  "emphasis": [7, 15, 21],
  "graphics": [
    { "type": "verse-card", "from": 0.4, "to": 3.6, "confirmed": true, "reason": "...", "data": { "reference": "", "text": "", "translation": "" } },
    { "type": "callout", "from": 3.8, "to": 5.6, "reason": "...", "data": { "text": "The word *rest*" } },
    { "type": "contrast", "from": 8.0, "to": 10.6, "reason": "...", "data": { "label": "NOT", "a": "...", "b": "..." } },
    { "type": "custom", "from": 9.0, "to": 12.0, "reason": "...", "src": "compositions/custom-path.html", "compositionId": "custom-path" }
  ]
}
```

`media` is written by `scripts/prep-media.mjs`. Do not hand-edit it.

## Fields

| Field | Meaning |
|---|---|
| `keep` | Source ranges kept, in order. Everything else is cut. Adjacent ranges merge. Audio gets 20 ms fades at hard cuts. |
| `angleCuts` | Which camera is on screen from `at` onward. `style`: `hard` (default), `j` (new picture arrives after its audio by `edit.jlOffsetSeconds`), `l` (new picture arrives before the previous audio ends). Angle B media time is source time plus `angleOffsetSeconds.b`. |
| `punches` | Slow ease zoom in at `at`, hold `hold` seconds, ease back out. Scale and timing from `motion.punch`. |
| `emphasis` | Transcript word indices (from `build-episode.mjs --words`) that get keyword emphasis in captions. |
| `graphics[].reason` | Required. One line: what this clarifies or emphasizes. |
| `graphics[].placement` | Optional `upper`, `center`, or `lower`. Defaults come from tokens. |
| verse-card `confirmed` | Must be `true`. Set only after he confirms the exact text (`policy/scripture.md`). Text over 260 characters must be split across cards. |
| callout text | Wrap accent words in `*asterisks*`. |
| custom | Escape hatch. Hand-written composition at `compositions/custom-<name>.html`, mounted as a sub-composition. Still bound by the banned list and the safe area. |

## Captions

Generated from `transcript.json` only, verbatim. Fix a word by editing its `text` in `transcript.json`, never in the HTML. Grouping rules and caps are in `design/tokens.json` under `captions`. A `captions.srt` sidecar is written next to `index.html`.

## Versions

`node scripts/episode-versions.mjs snapshot episodes/<id> v1` saves `plan.json`, `design/tokens.json`, and `transcript.json` under `versions/v1/`. `diff` then lists every change between versions. The after-action report is built from that diff.
