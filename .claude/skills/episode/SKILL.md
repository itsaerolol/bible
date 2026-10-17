---
name: episode
description: Run the full loop for one Bible-reflection video. Start a new episode or resume one. Updates the design system from the last after-action report, grills or takes a recording, runs clarity and hook guidance, edits with HyperFrames, handles revisions with inline why-capture. Use when the user runs /episode, says new video, or hands over a recording.
---

# /episode

One entry point for the whole production loop. Everything is logged to the episode's single `episode.md`.

Read first, every time: `CLAUDE.md`, `policy/editorial-contract.md`, `policy/scripture.md`, `policy/learning-loop.md`, `design-system/DESIGN.md`. They outrank everything here.

Never claim you watched or listened to media beyond what you inspected (transcript, snapshots, qa-render output). Say what was inspected and what needs his eyes and ears.

## 0. Evolve first

Before any new work, run `/evolve`. It reads the last after-action report and updates the design system. Show its summary. If there is nothing new, say so in one line and continue.

Then add any missing performance addenda: for each posted episode older than 7 days with no `## Performance addendum` content and a mature snapshot in `data/analytics/videos/<youtube_id>.json`, append one using the procedure at the end of `/posted`. Skip silently if `data/` has no real data (`data/.mock` exists).

Then check for an unfinished episode (`status` not `posted`) in `episodes/`. If one exists, ask whether to resume it or start new.

## 1. Set up

- New: ask for a working slug, run `node scripts/new-episode.mjs <slug>`. The episode copies the current design system into its own `design/` folder and records the version.
- Check tools once per session: `node -v` (22+), `ffmpeg -version`, `python3 -c "import numpy"`, and that the HyperFrames skills are installed (`/hyperframes`). If missing, point to `docs/setup.md`.

## 2. Intake. Two entry modes

**A. No recording yet.** Run `/clarify` in pre-record mode: grill on the verse and the concept. He talks, you ask. When the Intent is confirmed, tell him to record and come back with the files. Stop here. Resuming later continues at B.

**B. He hands over a recording.** Skip the grilling.
1. Put files in `episodes/<id>/media/` as `angle-a.mp4` (and `angle-b.mp4` if there are two). Originals are never modified.
2. `node scripts/prep-media.mjs episodes/<id>`: working copies, `audio.wav`, angle sync, sha256 hashes into the frontmatter.
3. From the episode folder: `npx --yes hyperframes@0.8.168 transcribe media/audio.wav --dir .`. Always pass `--dir .`, otherwise the file lands in `media/`. It writes `transcript.json` with word timestamps. If the engine is missing, see `docs/setup.md`.
4. Read the transcript. Flag uncertain words, especially names, places, and verse references. Ask him about each before captioning. Correct `transcript.json` text only, keep timings. Copy the readable corrected text into `## Transcript`.
5. If a quoted verse appears, verify it against the confirmed Scripture block (see `policy/scripture.md`). Flag differences. Do not silently fix.

## 3. Clarity and hook

Run `/clarify` in post-record mode on the transcript: mirror his point, ask at most a few questions about where the thread is unclear, then the hook step. Confirm the Intent and set `hook_original` / `hook_final`. A hook that reorders his lines needs his explicit yes.

## 4. Edit

1. Print the word index: `node scripts/build-episode.mjs episodes/<id> --words`.
2. Write `plan.json` (schema in `docs/plan-schema.md`):
   - `keep`: source-time ranges. Remove false starts, filler, pauses over `edit.maxPauseSeconds`. Keep reflective pauses up to `edit.reflectivePauseSeconds`. Start on speech. End `edit.endHoldSeconds` after the last word.
   - `angleCuts`: at phrase boundaries, `style` hard, `j`, or `l`.
   - `punches`: zoom in on pivotal turns only.
   - `emphasis`: word indices. One or two per caption group at most.
   - `graphics`: each with a `reason`. Verse cards need `confirmed: true` and the exact confirmed text. Add a graphic only when it clarifies or emphasizes. Quiet moments stay quiet. Fill `## Graphics plan` in `episode.md`.
3. `node scripts/build-episode.mjs episodes/<id>`. Fix every error. Read warnings.
4. From the episode folder: `npm run check` (lint, runtime, layout, contrast), then `npx --yes hyperframes@0.8.168 snapshot --at <key times>` and view the contact sheet. Fix what you see. Use the `/hyperframes*` skills for custom compositions (escape hatch: `compositions/custom-<name>.html`, plan type `custom`), still inside the banned list and safe area.
5. `npm run render`, then `node scripts/qa-render.mjs episodes/<id>/media/renders/v1.mp4`.
6. `node scripts/episode-versions.mjs snapshot episodes/<id> v1`. Add `### v1 (editor render)` to the Revision log with a short summary of cuts, graphics, and their reasons.
7. `node scripts/validate-episodes.mjs`. Set `status: review`, `duration_sec`.
8. Hand back. Say what you inspected (transcript, snapshots at these times, qa checks) and what you could not (how it sounds, how it feels). Ask for timestamped notes.

## 5. Revise

All changes go through you. He may not finish in another editor, or the after-action diff breaks. Say so once if he mentions another tool.

For each change he asks for:
1. Apply it. Style changes (font size, easing, position) go in the episode's `design/tokens.json`. Cuts, graphics, and timing go in `plan.json`.
2. Ask why in one plain line. He may skip. Log it immediately under the version in the Revision log: area, before, after, his reason, and `lasting` or `one-off` (default `lasting`; ask only if it is unclear). Also add a Decisions bullet.
3. Rebuild, check, snapshot, render `v<n>`, run `qa-render`, snapshot version `v<n>`. Increment `effort.revisions`.
4. Anything touching the editorial contract (meaning, order, certainty, words) is flagged with exact before and after and needs his yes.

Repeat until he says it is final. Keep the final render path in the Revision log.

## 6. Posted

When he says it is posted, run `/posted <youtube url>`.

## Failure handling

- Render fails: read the error, fix the cause, never skip checks to get a render.
- Weak angle sync (confidence under 8): tell him, ask him to confirm by ear.
- Footage not 9:16: it was center-cropped. Tell him.
- Transcript looks like gibberish or hallucinated silence text: stop, ask him, do not caption it.
