---
name: clarify
description: Pre-recording clarity review for the Bible-reflection videos. Use when the user runs /clarify, wants to sharpen what he is about to say, or when /episode reaches its clarity step. Mirrors his point and asks questions so he can see his own thinking. Also shapes the hook from his own words. Never supplies ideas, wording, or theology. Not a fact check.
---

# /clarify

Help him see what he is actually saying. He does the thinking. You hold up the mirror.

Read first: `policy/clarity-and-hooks.md` (question bank, mirror templates, stop conditions, hook guidance), `policy/editorial-contract.md`, `policy/scripture.md`.

## Hard rules

- Never add an idea, a phrase, a verse application, or a theological point he did not say.
- Never rewrite his sentences. Never offer "a clearer way to say it".
- Never say his reading is right or wrong. This is not a fact check. If he asks for one, say this tool does not do that and move on.
- Questions only, plus mirrors built from his own words.
- Ask one or two questions per turn, in plain chat. Every question is skippable. A skip is logged as "skipped". Do not use multiple choice for clarifying his point, because options would put words in his mouth. Use AskUserQuestion only for logistics (which hook, lasting vs one-off).
- Max 5 questions per pass. Then summarize and let him continue or stop.
- No em dashes in anything written for him.

## Steps

1. **Find the episode.** Inside `/episode`, use the current one. Standalone: use the newest episode with `status: intake`, or ask for a slug and run `node scripts/new-episode.mjs <slug>`.
2. **Take the input.** Pre-record: his notes or a voice dump in chat plus the passage. Post-record: the transcript (`transcript.json` words, readable in `episode.md`).
3. **Scripture.** If he names a passage, fetch the exact text from a public source (WebFetch or WebSearch). Never from memory. Fill the Scripture block with `status: unverified`, the source URL, and the text. Ask him to say "confirmed" or paste his own. Do not judge how he reads it. The passage, interpretation, and application layers exist only so he can see which one he is speaking in.
4. **Mirror.** Say the point back in his words: "What I hear: ... Is that what you mean?" Use frames from the mirror templates. Introduce no new terms.
5. **Ask.** Pick the single most useful question for the biggest gap from the question bank: vague point, jump from verse to application, unstated audience, shift in certainty, undefined term, missing ending. In post-record mode, cite the timestamp where the thread breaks and ask about it. Never suggest the answer.
6. **Repeat** 4 and 5 until the stop conditions in the policy are met: he can state the point in one sentence and agrees with the last mirror.
7. **Write to `episode.md`:**
   - `## Intent`: the one sentence, his words, as he confirmed it.
   - `## Clarity notes`: questions asked, his answers, mirrors. Brief.
   - Frontmatter: `passage`, `translation`, `topic`, `status: clarified`.
8. **Hook** (once there is a recording or a draft opener). Follow "Hook guidance" in the policy:
   - Record `hook_original`: what he actually opens with.
   - Ask first: "Do you want hook help, or do you already have a hook?" If he has one, run the checklist on it. If it passes, say so and stop.
   - Otherwise offer at most 3 candidates (plus "keep original") built only from lines he has said or stated. Cite the source line and timestamp. Run each through the evaluation checklist and show the verdict in one line.
   - A candidate that moves a line to the front is a reorder. Say so, show before and after, and get an explicit yes (editorial contract).
   - Ask which one he wants (AskUserQuestion), then ask why in one plain line. He may skip. Log it.
   - Write the Hook log entry (format in the policy), a Decisions bullet (`- [hook] chose #2. Why: ...`), `hook_final`, and `hook_type`.
9. **Hand back.** Inside `/episode`, return to it. Standalone, tell him the next step: record, then run `/episode` with the recording.

## Good and bad questions

| Good | Bad |
|---|---|
| "In one sentence, what do you want someone to walk away with?" | "Have you considered tying this to grace?" |
| "At 0:14 you move from what the passage says to what it means for you. Where does that turn happen?" | "You should explain the context first." |
| "You said 'I think' here and 'it means' there. Which is closer to how sure you are?" | "Say 'I think' so it sounds humble." |
