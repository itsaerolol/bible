# Design System

**Version: 0.1.0** (seed, dictated by the user on 2026-10-17)

Owned by the learning loop. `/evolve` rewrites this file and `tokens.json` after each posted video. Rules are in prose here. Numbers are in `tokens.json`. When they disagree, `tokens.json` wins for values and this file wins for intent.

Do not edit `policy/editorial-contract.md` or `policy/scripture.md` from here. They outrank this file.

## Feel

Clean, minimal, high production quality. The speaker's face and delivery are the anchor. Graphics explain or emphasize. They never decorate. Quiet moments stay quiet.

## Banned

Strobe or flicker lighting. Sapphire-style flicker or glow bursts. Camera or screen shake. Lens flares. Glitch effects. If a request needs one, stop and ask.

## Canvas and safe area

1080x1920, 30 fps. Keep captions and graphics inside the safe area in `tokens.json` (`safe.*`): clear of the Shorts UI at the bottom and right, and clear of the top bar. The speaker's face stays unobstructed.

## Captions

- Verbatim. Punctuation cleanup and removing stutters only (see editorial contract).
- Grouped by phrase, not by sentence. Break on pauses, sentence ends, and the word and time caps in `tokens.json`.
- **Keyword emphasis:** one to two pivotal words per group get the emphasis color, heavier weight, and a slight scale. Not every group needs one. Choose words that carry the meaning of the point, never random adjectives.
- Entrance: fade plus slide up. Exit: quick fade. Ease out in, ease in out.
- Never covers the face. Sits in the lower area above the bottom safe edge.
- Font: Inter (vendored). Do not swap without a recorded reason.

## Text and graphics motion

Allowed entrances, all with ease in and ease out:

| Name | Use |
|---|---|
| `fade-slide-up` | Captions, labels, contrast terms |
| `fade-slide-down` | Callouts that arrive from above |
| `fade-blur` | Soft reveals |
| `fade-blur-slide-up` | Verse cards |
| `fade-blur-slide-down` | Callouts, key phrases |

Blur-in means a large blur resolving to zero. Exits are a quick fade. Nothing bounces, wiggles, or overshoots.

## Camera and cuts

- **Punch-in / punch-out:** slow ease-in-out zoom on the picture layer to land an emphasis word or a turn in thought. Minimum gap between punches in `tokens.json`. Punch out to reset.
- **Two angles:** cut between angle A and B at phrase boundaries or to reset energy. Minimum shot length in `tokens.json`.
- **J cut:** the next angle's picture lags the audio. **L cut:** the previous angle's picture stays while the next line starts. Audio runs on one continuous track so cuts never break the voice. Offset in `tokens.json`.
- Start on speech. No intro, no logo. Tighten pauses longer than `edit.maxPauseSeconds`, except reflective pauses up to `edit.reflectivePauseSeconds`. Hold `edit.endHoldSeconds` after the last word.

## Graphic components (in `components/`)

| Component | Purpose |
|---|---|
| `captions` | Phrase captions with keyword emphasis |
| `verse-card` | Reference, exact verse text, translation label. Only for direct quotations that the user confirmed. |
| `callout` | One key phrase on screen |
| `contrast` | Two ideas set against each other |

Every substantive graphic carries a one-line reason in `episode.md` (what it clarifies). Do not add one to fill time. Escape hatch: custom compositions are allowed when the idea needs them, still within the Banned list and safe area.

## Learned rules

<!-- /evolve appends here. Format: - [vX.Y.Z | episode-id] property: old -> new (why) -->

No entries yet.
