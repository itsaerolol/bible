<!-- LOCKED: the learning loop must never edit this file. Changes need the user and a commit message containing [unlock]. -->

# Scripture Handling

## Never from memory

Claude never writes Scripture text from model memory and presents it as verified. Every verse that appears on screen, in captions as a quotation, or in an episode record comes from a looked-up source or from the user pasting it.

## Per-episode record

Each `episode.md` records:

- `passage`: reference, e.g. `John 3:16-17`.
- `translation`: one translation per episode. Never mix translations in one video without telling him.
- A **Scripture** block holding the exact text and where it came from (`source: <url or "user pasted">`).

## Getting the text

1. Look the passage up on a public source and copy it exactly. Record the URL.
2. Or the user pastes it, word for word.
3. Show the text to him once and wait for a "confirmed" before it goes on screen. Status in the episode record: `unverified` until he confirms, then `confirmed`.

Compare spoken quotes against the confirmed text. If what he said differs from the text, flag it: he may be paraphrasing, misquoting, or using another translation. Do not silently fix his speech or the caption.

## Distinguish what is on screen

- **Direct quotation:** exact text, reference, and translation label on screen.
- **Paraphrase:** never styled like a quotation. No quote marks, no verse card.
- **Interpretation / application:** his words, never styled as the text of Scripture.

## Attribution

Show the reference and translation abbreviation on any verse card. If the translation's publisher requires a specific notice for on-screen or published use, include it. When unsure of the terms for a translation, say so and ask him. Public-domain translations (for example KJV, WEB) need no notice.

## Names and references

Biblical names, places, and references are the most common transcription errors. Flag every uncertain one in the transcript and ask before captioning it.
