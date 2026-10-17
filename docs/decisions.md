# Decisions

Source of truth for what was settled in the design grill (2026-10-17). Agents read this before changing structure. Update it when a decision changes.

## The three systems

1. **Edit pipeline.** Talking-head recording in, vertical captioned video with purposeful graphics out. HyperFrames renders it.
2. **Learning loop + YouTube monitor.** Every posted video gets an after-action report (AAR). The next run reads it and rewrites the design system. A private dashboard tracks YouTube performance.
3. **Clarity.** Pre-recording review that sharpens the user's own point. Not a fact check. Claude asks and mirrors. It never supplies ideas, wording, or theology.

Nothing else is in scope. Instagram, auto-publishing, a review website, and a monorepo were dropped.

## Settled

| Topic | Decision |
|---|---|
| Runtime | Cloud session sets up the repo. Real production runs locally (Claude Code on the user's machine). |
| Cadence | 3 to 5 videos per week. Templates and reusable components matter. |
| Format | Vertical 1080x1920, YouTube Shorts. |
| Guardrails kept | Editorial contract. Scripture verification. |
| Guardrails dropped | Approval gate. Separate raw + corrected transcript files. Edit-metadata tracking beyond what the AAR needs. |
| Structure kept | One folder per episode. Policy docs. Reusable graphics component library. |
| Revisions | All edits go through the repo agent so the diff is exact. No finishing in another editor. |
| Why capture | Inline, one line, skippable. Claude asks when the user picks a hook, rejects a cut, or requests a change. Logged to `episode.md` at once. |
| Hook help | Before editing. Claude helps shape a better hook. The AAR records original hook, new hook, and why the user chose it. |
| Learning loop trigger | Start of every `/episode` run: read the last AAR, update the design system, then start the video. |
| Promotion | Every correction goes into the next design-system version instantly. Newest correction wins on conflict. Every change is logged and revertible. |
| Loop may rewrite | `design-system/**` and `policy/clarity-and-hooks.md`. |
| Loop may never touch | `policy/editorial-contract.md`, `policy/scripture.md`, `policy/learning-loop.md`. CI enforces it. |
| Performance signal | Corrections now. Retention and performance data arrives about 7 days after posting and is appended to that episode as a performance addendum. Later runs weigh it in. |
| Episode record | One markdown file per episode (`episode.md`): intent, transcript, clarity output, hook log, decisions with reasons, revision log, AAR, performance addendum. |
| Original video | Lives in `episodes/<id>/media/`, gitignored. `episode.md` records sha256 hashes. Back up outside Git. |
| Transcription | `hyperframes transcribe` (word-level timestamps, local whisper or parakeet). |
| Scripture | Translation set per episode. Claude looks up the exact text from a public source and records the source. The user may paste it instead. Never quoted from model memory. |
| Dashboard | YouTube only. Studio-style but tailored. Everything the API exposes: watch time, average view duration, average % viewed, drop-off, retention curve, traffic sources, engagement, subs. Plus Haiku recommendations. |
| Dashboard data | YouTube Analytics API, daily GitHub Action, JSON committed to `data/`. |
| Dashboard hosting | Private repo, Vercel, password gate. No database. |
| Retention risk | Shorts retention curve availability through the API is unconfirmed. First sync tests it. Fallback: drop the Studio retention CSV into the episode folder and the importer plots it. |
| Haiku | Runs in the daily Action. Reads stats plus episode metadata. Advises only. Never edits the design system. |

## Baseline design (v0, dictated by the user)

Treat as the starting design system. Corrections evolve it.

- Captions with **keyword emphasis**. The user dictated "call in keyword emphasis". Interpreted as callout emphasis on the pivotal words.
- Ease in and ease out on all motion.
- Punch-in and punch-out zooms.
- J cuts and L cuts. J cut: the next clip's audio starts before its picture. L cut: the previous clip's audio continues over the next picture.
- Text enters by fade in plus slide down, or fade in plus slide up.
- Fade in plus blur in: big blur resolving to none.
- **Banned:** strobe or flicker lighting, Sapphire-style flicker, glow bursts, camera or screen shake.
- Overall feel: clean, minimal, high production quality.
- Up to **two camera angles** to cut between.

## Flow

```
/episode
  0. evolve: read last AAR, update design system (new version)
  1. intake: grill on verse + concept, OR user hands over recording (skips grilling)
  2. clarify: mirror + questions, then hook guidance (before editing)
  3. edit: render v1 from the design system
  4. revise: user feedback via Claude. Claude logs each change + the why
  5. /posted <youtube url>: link video ID, write AAR
Next /episode starts at 0 and reads that AAR.
```

## Defaults chosen without asking (change if wrong)

- `/posted` takes the YouTube URL as the posted signal.
- Conflicting corrections: newest wins, older rule logged as superseded.
- Daily Haiku model: `claude-haiku-5-5`, overridable by env var.
- Dashboard auth: single password from an env var.
- Multi-angle sync: audio cross-correlation, local script.

## Known risks

- Instant promotion means one mood or experiment can warp the style. Mitigation: versioned, logged, revertible, one-off vs lasting tagged in the AAR.
- Letting the loop rewrite hook policy can drift toward engagement bait. Mitigation: hook honesty rules live in the locked editorial contract.
- 3 to 5 videos per week is a small sample. Haiku advice is directional only.

## Dashboard build notes

- The gate is `dashboard/src/proxy.ts`. With `DASHBOARD_PASSWORD` unset in production every route returns 503. It never serves open.
- Snapshots are tiered to keep the repo small: daily for the first 14 days, weekly to day 90, monthly after. Metrics are lifetime values through `data_through` (sync date minus 3 days).
- Haiku runs only when its input changed. It never runs on mock data. It cannot edit episodes or the design system.
- The first real sync deletes all mock data and records the Shorts retention verdict (`works`, `unavailable`, `inconclusive`) in `data/analytics/sync-status.json`, shown under Overview > Sync health.
- Risks to check on first deploy: commits by the Actions bot may not trigger a Vercel build (use the optional `VERCEL_DEPLOY_HOOK_URL` secret), and Vercel's "skip deployment" for unaffected projects can skip data-only commits.
- Views definition changed in late August 2026 (public views count from the first frame). `engagedViews` keeps the older meaning and is the basis for retention. Compare like with like.

## Verified during setup (2026-10-17)

Tested in the cloud session with synthetic footage and a synthetic voice (test fixtures only):

- HyperFrames 0.8.168: `check` passes (0 errors), `snapshot` frames look right, `render --resolution portrait` produces 1080x1920 H.264 30 fps with AAC audio.
- `hyperframes transcribe --dir .` with Parakeet returns word-level JSON (`[{id,text,start,end}]`). The builder reads it.
- `scripts/build-episode.mjs`: keep ranges, caption remapping after cuts, two-angle J and L cuts, punch zooms, verse card, callout, contrast.
- `scripts/sync-angles.py` recovered a planted 0.7 s offset with high confidence.
- `scripts/qa-render.mjs`, `scripts/episode-versions.mjs`, `scripts/check-locks.mjs`, `scripts/validate-episodes.mjs`.

Not tested, needs your first real run:

- Real footage and a real voice. Caption sizes, safe areas, and the dim levels are starting guesses.
- The four skills end to end. They are instructions, not code.
- Live YouTube API calls, the Vercel deploy, and the daily Action. No credentials here.
- Whether the YouTube Analytics API returns a Shorts retention curve. The first sync will tell.
- The Claude Code plugin prompt for HyperFrames from `.claude/settings.json` (cloud sessions do not load plugins).
