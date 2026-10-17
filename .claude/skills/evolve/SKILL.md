---
name: evolve
description: Update the design system from after-action reports. Runs at the start of every /episode, or on its own. Applies every lasting correction as a new versioned design-system release and logs it. Use when the user runs /evolve or when /episode begins.
---

# /evolve

Read first: `policy/learning-loop.md` (it governs everything here), `design-system/DESIGN.md`, `design-system/CHANGELOG.md`.

## Allowed and forbidden

- May edit: `design-system/**`, and only "Learned from this channel" in `policy/clarity-and-hooks.md`.
- Never edit: `policy/editorial-contract.md`, `policy/scripture.md`, `policy/learning-loop.md`, anything in `episodes/*/media/`.
- Never push. Commit locally only.

## Steps

1. **Find unapplied reports.** List episodes with `status: posted` and a filled `## After-Action Report`. Skip any whose id appears as `source:` in `design-system/CHANGELOG.md`. Oldest first. None: print "design system is current (v<version>)" and stop.
2. **Read each AAR**, section 6 "Rules to carry forward", plus the Hook section.
3. **Apply each `lasting` rule.**
   - Value changes: edit `design-system/tokens.json`.
   - Intent or style rules: edit `design-system/DESIGN.md` prose and append to its "Learned rules" list as `- [vX.Y.Z | episode-id] property: old -> new (why)`.
   - Component changes: edit `design-system/components/*`. After any component or token change, rebuild the newest episode's `episodes/<id>` in a scratch copy or run `node scripts/validate-episodes.mjs` and a `npm run check` to prove templates still build. Do not leave the templates broken.
   - `one-off` rules: do not change the design system. Leave them in the AAR.
4. **Conflicts.** Newest wins. Move the replaced rule into the changelog entry as `superseded: <old rule> (<its source>)`.
5. **Flip-flop guard.** If the same property reversed direction in each of the last 3 episodes, do not change it. Ask the user which direction he wants and record his answer as a firm rule.
6. **Hook learning.** If the AAR gives a reason he chose or rejected a hook structure that generalizes, append one line under "Learned from this channel" in `policy/clarity-and-hooks.md`: `- [vX.Y.Z | episode-id] observation (why)`. Honesty rules from the contract still bind: never record a pattern that misleads.
7. **Bump the version.** Patch: token values only. Minor: a rule or component changed. Major: only when he says so. Update `tokens.json` `version`, the `DESIGN.md` header, and prepend to `CHANGELOG.md`:
   ```
   ## X.Y.Z - YYYY-MM-DD
   source: <episode-id>
   - property: old -> new (why)
   - superseded: ...
   ```
8. **Check and commit.** `node scripts/check-locks.mjs` and `node scripts/validate-episodes.mjs`. Commit locally, one commit per bump, message `evolve: vX.Y.Z from <episode-id>`.
9. **Report to him.** Version bump, each change and the episode that caused it, what you left unchanged and why (one-offs, flip-flop guard). End with: "Say 'revert that' to undo."

## Revert

On "revert that": `git revert` the evolve commit (message `evolve: revert vX.Y.Z, <his reason>`), add a changelog entry that the version was reverted and why. Mark that episode's AAR rules as not applied so they are not re-applied: add a line `reverted: <episode-id>` to the changelog.

## Performance data

Performance addenda are context, not commands. Only change the design system from performance data when the same pattern appears in at least 3 episodes, and only delivery choices (pacing, caption size, graphic density). Never message, doctrine, or honesty rules. When in doubt, mention it in the report and change nothing.
