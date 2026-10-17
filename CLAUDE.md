# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal video system. The owner records short vertical talking-head videos (YouTube Shorts) about lessons from reading the Bible. This repo clarifies his point beforehand (`/clarify`), edits the recording with HyperFrames (`/episode`), learns from each posted video (`/posted`, `/evolve`), and monitors YouTube performance in a private dashboard. He is a developer. Be direct and brief. No em dashes in anything you write.

Why things are the way they are: `docs/decisions.md`. Read it before changing structure. Data contracts: `docs/schemas.md` and `docs/plan-schema.md`. Local setup: `docs/setup.md`, `docs/dashboard-setup.md`.

## Commands

There is no test runner. Correctness comes from the validators, HyperFrames `check`, and fixture dry-runs.

```bash
# Episode workflow (normally driven by /episode)
node scripts/new-episode.mjs <slug> [--date YYYY-MM-DD]     # scaffold episodes/<id>, pin the design system
node scripts/prep-media.mjs episodes/<id>                    # working copies, audio.wav, angle sync, sha256 into episode.md
node scripts/build-episode.mjs episodes/<id> [--words]       # plan.json + transcript.json -> index.html, compositions/, captions.srt
node scripts/episode-versions.mjs snapshot|diff episodes/<id> v1 [vN]
node scripts/qa-render.mjs episodes/<id>/media/renders/v1.mp4

# Inside an episode folder (HyperFrames is pinned to 0.8.168 in its package.json)
npx --yes hyperframes@0.8.168 transcribe media/audio.wav --dir .   # --dir . matters: without it the file lands in media/
npm run check        # lint + runtime + layout + contrast. Must show 0 errors
npm run snapshot -- --at 1.5,4,9    # stills; open the contact sheet
npm run render       # 1080x1920 mp4 into media/renders/

# Repo checks (also run in CI)
node scripts/validate-episodes.mjs        # frontmatter, plan rules, banned effects, no tracked footage
node scripts/check-locks.mjs              # locked policy files and evolve-commit scope; needs full git history
node scripts/check-analytics-data.mjs     # data/ against docs/schemas.md

# Analytics (needs YOUTUBE_* and ANTHROPIC_API_KEY for real runs)
node scripts/sync-analytics.mjs --fixtures scripts/fixtures/youtube --dry-run   # offline test of one sync
node scripts/make-mock-data.mjs --force                                         # regenerate labeled mock data
node scripts/import-retention-csv.mjs <episode-id>                              # Studio retention CSV fallback

# Dashboard (Next.js, dashboard/)
npm run dev | build | typecheck   # prepare-data copies ../data into dashboard/.data first
```

Single-episode iteration: edit `plan.json` or `transcript.json`, rerun `build-episode.mjs`, then `npm run check`.

## Architecture

**An episode is a self-contained HyperFrames project pinned to a design-system version.** `new-episode.mjs` copies `design-system/` into `episodes/<id>/design/`, and the episode records `design_system_version`. Later design changes never alter an old render. Style corrections made during revision edit the episode's `design/tokens.json`, not the global one.

**Generated vs authored.** `index.html`, `compositions/captions.html`, `compositions/gfx-N.html`, and `captions.srt` are overwritten by `build-episode.mjs`. Never hand-edit them. Authored inputs are `plan.json` (edit decisions, all in source time), `transcript.json` (fix words here, keep timings), and `design/`. The escape hatch is `compositions/custom-*.html` referenced from a `custom` graphic. The builder maps source time to timeline time through `plan.keep`, which is what keeps captions and graphics synced after cuts. Two angles share one continuous audio track, so J and L cuts are only picture-switch offsets.

**The learning loop is a data flow through git-tracked files, not a service.** Revisions go through Claude and are logged in `episode.md`; `episode-versions.mjs` snapshots plan, tokens, and transcript per render so the after-action report is an exact diff. `/posted` writes the AAR. `/evolve` (run first by every `/episode`) reads unapplied AARs, edits `design-system/**` and only the "Learned from this channel" section of `policy/clarity-and-hooks.md`, bumps the version, and commits `evolve: vX.Y.Z from <episode>`. `check-locks.mjs` enforces that those commits touch nothing else and that `policy/editorial-contract.md`, `policy/scripture.md`, and `policy/learning-loop.md` change only with `[unlock]` in the commit message. The loop's rules (newest wins, one-off vs lasting, flip-flop guard) live in `policy/learning-loop.md`.

**Analytics pipeline.** GitHub Action `sync-analytics.yml` (daily): `build-episode-index.mjs` -> `sync-analytics.mjs` (YouTube Data + Analytics APIs) -> `haiku-insights.mjs` -> commits `data/`. The dashboard's `prepare-data` copies `data/` in at build, so a push redeploys it on Vercel behind a password gate. Videos join to episodes by `youtube_id`. `data/.mock` marks fabricated data and the dashboard shows a banner while it exists. Missing metrics are `null` plus an `unavailable` entry, never 0. The Shorts retention curve may not exist in the API; the first real sync records a verdict in `data/analytics/sync-status.json` and the CSV importer is the fallback. The password gate is `dashboard/src/proxy.ts` (Next 16 renamed middleware). Vercel needs "include source files outside the root directory" on and "skip deployment" off, or data-only commits never redeploy; `docs/dashboard-setup.md` has the exact settings.

Episode frontmatter is read by one dependency-free parser, `scripts/lib/yaml-lite.mjs`. `scripts/lib/frontmatter.mjs` only rewrites the `media:` block and scalars in place. Keep frontmatter inside the subset in `docs/schemas.md`.

## Rules that are easy to break

- `policy/editorial-contract.md` and `policy/scripture.md` outrank everything, including the design system and his passing remarks. Improve delivery, never silently change meaning. Never write Scripture from memory; look it up or have him paste it, and he confirms before a verse card renders (`build-episode.mjs` refuses unconfirmed verse text).
- Never modify originals. `episodes/*/media/` is gitignored; footage and renders never enter git. Back-ups are his job.
- Every graphic needs a `reason`. Banned effects: strobe, flicker, glow bursts, shake, lens flares, glitch (`validate-episodes.mjs` scans templates and custom compositions).
- You cannot watch or hear video. State what you inspected (transcript, snapshots, qa-render) and what needs him.
- `/posted` and `/evolve` commit locally. Never push unless he asks.

## HyperFrames gotchas (verified)

- Sub-composition files need the content inside `<template>`. The host element and the composition root inside it must have different `id`s (hosts are `host-<id>`); duplicate ids silently break lookups.
- Register timelines on `window.__timelines["<composition-id>"]`, paused, deterministic. No `Date.now`, no unseeded random, no network fetches at render.
- `check` contrast warnings can be sampled mid-fade or over test footage. Confirm against a snapshot before acting. Layout errors are real.
- Use the `/hyperframes*` skills for custom compositions. `.claude/settings.json` offers the plugin locally. Cloud sessions do not load plugins and have no footage, so real runs happen on his machine.
