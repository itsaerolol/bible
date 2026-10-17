---
name: posted
description: Close an episode after it is posted to YouTube. Links the video ID, writes the after-action report from the logged decisions and the exact plan diff. Use when the user runs /posted with a YouTube URL or says the video is posted.
---

# /posted <youtube url>

Read first: `policy/after-action-report.md`, `policy/learning-loop.md`.

## Steps

1. **Episode.** Use the newest episode with `status: review`. If more than one, ask.
2. **Link.** Parse the video ID from the URL (watch, youtu.be, or shorts form). Set `youtube_id`, `posted_at` (now, ISO 8601), `status: posted`. Compute `duration_sec` from the final render with ffprobe. Ask which render version was posted if it is not obvious. Hash the final render with sha256 and add it to `media`.
3. **Fill the gaps in the why log.** Read the Decisions and Revision log. For any change with no reason, ask once, one line each, all in a single message. He may answer "skip". Do not invent reasons.
4. **Diff.** `node scripts/episode-versions.mjs diff episodes/<id> v1 v<final>`. Make sure the final version was snapshotted first (`snapshot` the current state as `v<final>`).
5. **Write `## After-Action Report`** exactly as `policy/after-action-report.md` defines:
   Outcome, Hook (original, final, who proposed it, his reason), the editor-vs-shipped table built from the diff plus the Revision log, What worked unchanged, What he kept changing (compare with the 3 previous posted episodes' AARs), Rules to carry forward (`property: old -> new (why)` with `lasting` or `one-off`), Open questions.
   - Items he did not change are evidence the rule is right. List them.
   - Use only what is in the logs and the diff. Mark anything uncertain as such.
6. **Index.** Run `node scripts/build-episode-index.mjs` if present so `data/episodes-index.json` includes the new `youtube_id`.
7. **Validate.** `node scripts/validate-episodes.mjs`.
8. **Commit locally** with message `episode: <id> posted, AAR written`. Stage only this episode's folder (media is gitignored) and `data/episodes-index.json`. Never push. Tell him it is ready to push when he wants.
9. **Tell him** the AAR headline in 3 lines and that `/episode` will apply it automatically next time. Remind him that about 7 days from now the performance addendum can be added.

## Performance addendum (later)

When asked, or when `/episode` finds a posted episode older than 7 days without one: read `data/analytics/videos/<youtube_id>.json`. If the latest snapshot is mature, append `## Performance addendum` per the policy. State sample size. If retention is unavailable, say so. No causal claims from one video.
