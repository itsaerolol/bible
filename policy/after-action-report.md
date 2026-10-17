# After-Action Report format

Written by `/posted`. Lives inside the episode's `episode.md` under `## After-Action Report`. The next `/evolve` run reads it.

The AAR compiles what was already logged during the episode. It does not reconstruct from memory. Sources: Hook log, Decisions (with reasons), Revision log, render versions.

## Sections

### 1. Outcome
- Posted URL and `youtube_id`.
- Final duration. Renders produced (v1, v2, ...).
- Revision count.

### 2. Hook
- Original hook (his first version).
- Final hook.
- Who proposed the final one (his own, Claude's framing of his words, a mix).
- **Why he chose it** (his reason, verbatim from the log).

### 3. What the editor did vs what shipped
A table. One row per change between render v1 and the posted render:

| Area | v1 (editor) | Final (shipped) | His reason | Tag |
|---|---|---|---|---|

Areas to check every time: caption font, size, position, emphasis style, caption grouping; text animation; zoom/punch behavior; cut tightness; pauses; ending length; angle switching; J and L cuts; graphics (added, removed, resized, retimed); color; audio levels.

Tag is `lasting` or `one-off` (see `policy/learning-loop.md`).

### 4. What worked, unchanged
Things the user accepted with no edits. These count as evidence the current design-system rule is right. List them.

### 5. What he kept changing
Properties changed in this episode that were also changed in recent episodes. Name the property and the episodes.

### 6. Rules to carry forward
Each as: `property: old -> new (why)` plus tag. This is the exact input `/evolve` applies.

### 7. Open questions
Anything the user was unsure about, to ask at the start of the next run.

## Performance addendum (added later)

About 7 days after posting, once `data/analytics/videos/<youtube_id>.json` has a mature snapshot, append under `## Performance addendum`: views, engaged views, average view duration, average % viewed, where retention dropped (or "retention curve unavailable"), traffic sources, and one sentence on how the result relates to the hypothesis. State sample size. No causal claims from one video.
