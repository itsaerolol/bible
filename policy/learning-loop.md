<!-- LOCKED: the learning loop must never edit this file. Changes need the user and a commit message containing [unlock]. -->

# Learning Loop

How the system improves itself. Run by `/posted` (writes the AAR) and `/evolve` (reads it and updates the design system, runs at the start of every `/episode`).

## Sources of learning, in order of weight

1. **The user's corrections** during revision, plus the reason he gave. Highest signal. Applied immediately.
2. **Hook decisions:** original hook, the new hook, why he chose it.
3. **Performance addendum** (about 7 days after posting). Appended to the episode. Directional only.
4. **Haiku insights** (`data/insights.json`). Advice to the human. Not a source for automatic changes.

## What the loop may change

- Everything under `design-system/`.
- `policy/clarity-and-hooks.md`, only the section "Learned from this channel".

## What it may never change

- `policy/editorial-contract.md`
- `policy/scripture.md`
- `policy/learning-loop.md` (this file)
- Any `episodes/*/media/` original.

CI fails a commit that does this unless the message contains `[unlock]`.

## Promotion rule

Every correction becomes a rule in the next design-system version. No waiting for repeats.

To keep this safe:

- Tag each rule `lasting` or `one-off`. Default `lasting`. If the user said the change was for this video only ("just this one", "this verse needs"), tag `one-off`: record it in the AAR, do not put it in the design system.
- **Newest wins.** If a new rule conflicts with an existing one, the new one replaces it. The old rule is moved to the changelog as superseded, with its date and episode.
- If the same property flips back and forth across 3 consecutive episodes, stop applying changes to that property and ask the user which direction he wants. Record his answer as a firm rule.

## Versioning

- Semantic version in `design-system/DESIGN.md` and `design-system/tokens.json`.
- Patch bump: token value changed (font size, easing, timing).
- Minor bump: rule added, removed, or a component changed.
- Major bump: only when the user says so.
- Every bump appends to `design-system/CHANGELOG.md`: version, date, source episode, each change as `property: old -> new (why)`.
- Commit message prefix: `evolve:`. One commit per bump.
- Revert: restore the previous files from git and add a changelog entry saying the version was reverted and why.

## Episode pinning

An episode copies the design system components into its own `video/` project when it starts and records `design_system_version` in the frontmatter. Later design-system changes never alter an old episode's render.

## What an update must show the user

At the start of `/episode`, before any new work, print a short summary: version bump, what changed, because of which episode, and what it did not change. He can say "revert that" at any point.

## Small-sample honesty

3 to 5 videos a week is a small sample. Performance data adjusts delivery preferences only after it appears in more than one episode. It never changes the message, the doctrine, or the honesty rules.
