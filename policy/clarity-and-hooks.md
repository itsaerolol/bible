# Clarity and hooks policy

Version: v0 baseline. Researched: 2026-10-17. Backs flow step 2 in `docs/decisions.md` ("clarify: mirror + questions, then hook guidance").
Locked neighbours, referenced and not restated: `policy/editorial-contract.md`, `policy/scripture.md`, `policy/learning-loop.md`.
The loop may edit only the last section of this file (`policy/learning-loop.md`).

## Purpose and limits

This file tells the clarify AI how to help the creator sharpen his own point before editing, and how to help with the hook. It works the same on stated intent from intake or on a transcript of a recording he hands over.

Output goes to `episode.md`: his one-sentence point in his words, questions he skipped, and the hook log. The after-action report reads the hook log (`policy/after-action-report.md`).

### The four rules

1. **No fact check.** The AI does not judge whether the point is true, sound, or biblical. Quote accuracy is `policy/scripture.md`. What the video may claim is `policy/editorial-contract.md`.
2. **No supplying content.** Never offer ideas, wording, examples, illustrations, structure for his argument, or theology. No "you could add". Hook candidates may only select, trim, or reorder words he already said, and a reorder needs his yes (see Hook guidance). If he asks the AI to supply content, decline in one line and return to a question: "I can't supply that. In your words, what is it?"
3. **Ask and mirror.** Ask neutral questions (none may embed an answer). Reflect his point back in his words and ask "is that what you mean?". He is the only authority on what he means. A mismatch is a reason to ask again, never to correct him.
4. **Defer to the contract.** If anything here conflicts with `policy/editorial-contract.md`, the contract wins. If unsure whether a phrasing is honest, do not offer it. Ask him.

### Asking protocol

- One or two questions per turn. Most episodes need 3 to 6 questions plus mirrors. Cadence is 3 to 5 videos a week, so keep it short.
- Every question is skippable. A skip is logged as "skipped", not "unclear".
- Use his words. No praise or judgment of the point. Neutral acknowledgment only ("Got it.").
- Do not predict views or performance for any point or hook.

### Limits of the evidence

- Official YouTube hook guidance is general ("first few seconds"). No official number of seconds was found.
- Most hook craft below is practitioner advice. Treat it as a hypothesis the AAR can test, not a law.
- 3 to 5 videos a week is a small sample (`docs/decisions.md`). Channel observations are directional.
- Views never outrank the four rules. Entries under "Learned from this channel" are subordinate to them.

## Research baseline

Evidence tags: **[official]** YouTube, Google, or government documentation. **[research]** peer-reviewed or formally measured study (limits noted). **[practitioner]** creator, consultant, vendor, book, or trade-press advice; anecdotal unless stated. Lines starting "Use:" or "Inference:" are this file's reading, not a source claim.

### Shorts mechanics

- Since 2026-08-24 a view counts from the first frame, in every format. The old definition is now the "engaged view": clicking to watch or watching past the initial seconds. CTR, average view duration and retention stay anchored on engaged views. Recommendations are unchanged. Partner Program payout basis is unchanged. Posted 2026-08-19. [official] <https://blog.youtube/inside-youtube/engaged-views-youtube-explained/>
- Shorts were already counted at start or replay from 2025-03-31, with the stricter count kept as engaged views. The date comes from trade press. The official thread exists but its body could not be read. [practitioner] <https://ppc.land/youtube-changes-how-shorts-views-are-counted-from-march-31/> and [official] <https://support.google.com/youtube/thread/333869549/a-change-to-how-we-count-views-on-shorts?hl=en>
- Engaged views: "How many times viewers stayed to watch past the initial seconds, not including any loops." The threshold in seconds is not stated. [official] <https://support.google.com/youtube/answer/12220281?hl=en>
- "Stayed to watch": "The percentage of times viewers stayed to watch past the initial seconds of a Short." [official] <https://support.google.com/youtube/answer/12220281?hl=en>
- Older label for the same idea, "viewed vs swiped away": "the percentage of times that viewers viewed your Shorts versus swiped away". Help pages use both labels. [official] <https://support.google.com/youtube/answer/12942217?hl=en&co=YOUTUBE._YTVideoType%3Dshorts>
- Average percentage viewed: "Average percentage of a video watched among those who stayed to watch", calculated from engaged views and their watch time. [official] <https://support.google.com/youtube/answer/12220281?hl=en>
- Inference: average percentage viewed only describes people who stayed. A weak hook shows up in "stayed to watch", not in average percentage viewed. Read the two together.
- Views are shown "compared to your Shorts' typical performance". YouTube frames Shorts numbers against the channel's own baseline. [official] <https://support.google.com/youtube/answer/12942217?hl=en&co=YOUTUBE._YTVideoType%3Dshorts>
- Average percentage viewed can exceed 100% when viewers replay or a Short loops. Rewatches can also mean a moment confused people. Compare Shorts with Shorts. [practitioner] <https://vidiq.com/blog/post/average-view-duration/>
- Spikes in the retention report can mean "watching, rewatching, or sharing", and can mean the content was unclear. This page covers regular videos, not Shorts. [official] <https://support.google.com/youtube/answer/9314415?hl=en&co=GENIE.Platform%3DDesktop>
- Official opening advice: "Capture attention in the first few seconds to prevent viewers from scrolling." Shorts are capped at 3 minutes. No second count given. Posted 2025-04-08. [official] <https://blog.youtube/creator-and-artist-stories/your-guide-to-getting-started-with-youtube-shorts/>
- Recommendations aim at satisfaction. YouTube measures "valued watchtime" with 1 to 5 star surveys, counting only 4 and 5. Not Shorts-specific. Posted 2021-09-15. [official] <https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/>
- Shorts product lead, 2023 interview as reported: "The audience is the algorithm." Exact swipe thresholds are not public. Secondhand; original interview not opened. [official] <https://searchenginejournal.com/youtube-explains-how-shorts-algorithm-works/494953>
- Trade press reading: after the 2026 change the public view count is an exposure count, not an attention measure. [practitioner] <https://ppc.land/explaining-youtube-views/>
- Use: judge a hook by "stayed to watch" and engaged-view metrics against this channel's own recent Shorts, never by public view count and never by outside benchmarks.

### Clarity principles

- One core message. "If you attempt to say three things, you end up saying nothing." Simple means prioritizing, not dumbing down. Summary of the book, not the book. [practitioner] <https://actionablebooks.com/summaries/made-to-stick>
- Authors' page names "curiosity gaps" and "violating schemas" as techniques but does not list the six principles. [practitioner] <https://heathbrothers.com/books/made-to-stick/>
- Minto: thinking is easy to grasp when "organized as a pyramid under a single point". Her page does not say "answer first"; that is the common reading. [practitioner] <https://www.barbaraminto.com/>
- Curse of knowledge: better-informed people cannot ignore what they know when judging what others understand. [research] <https://www.cmu.edu/dietrich/sds/docs/loewenstein/CurseknowledgeEconSet.pdf>
- Tapping study: tappers estimated about half of listeners would name the tune. Body text reports 3 hits in 120 tries (2.5%); the dissertation abstract says two of 150. One dissertation, 40 tappers and 40 listeners. [research] <https://www.gwern.net/doc/psychology/cognitive-bias/illusion-of-depth/1990-newton.pdf>
- Pinker: the curse of knowledge is "the chief contributor to opaque writing". Empathy is not enough. Show a draft to a representative reader. [practitioner] <https://www.psychologicalscience.org/observer/the-curse-of-knowledge-pinker-describes-a-key-cause-of-bad-writing> and <https://news.harvard.edu/gazette/story/2012/11/exorcising-the-curse-of-knowledge>
- Teach-back: "This is not a test of the patient's knowledge: This is a test of how well you explained the concept." Clinical origin. Cites studies that 40 to 80 percent of medical information is forgotten immediately. [official] <https://www.shepscenter.unc.edu/wp-content/uploads/2013/05/Health-Literacy-Universal-Precautions-Toolkit.pdf>
- Inference: the mirror works like teach-back in reverse. If the AI's mirror does not match his intent, the viewer would likely miss it too. The mirror tests his explanation, not the AI.
- Feynman technique (explain simply, find gaps, repeat): one source concedes "no specific research or evidence" supports the technique as a whole. [practitioner] <https://www.innovationtraining.org/what-is-the-feynman-technique-and-how-to-use-it-for-learning>
- Related, better supported: self-explanation and elaborative interrogation ("why" prompts) rated moderate utility, with limited classroom evidence. [research] <https://fds.duke.edu/db/aas/pn/faculty/emarsh/publications/252743>
- Open questions "invite others to 'tell their story' in their own words without leading them in a specific direction". Repeating or rephrasing "stays close to what the speaker has said"; paraphrasing is where the speaker's meaning is inferred. State health department training handout, counseling context. [practitioner] <https://secure.in.gov/health/mch/files/ipqic/Motivational-Interviewing.pdf>
- Meta-analysis (36 studies, N = 3,025): reflections and open questions were moderately associated with more client change talk; effects small; counseling setting, so an analogy only. [research] <https://pmc.ncbi.nlm.nih.gov/articles/PMC5958907>
- Plain language: highly educated domain experts still "crave succinct information that is easy to scan". Usability study, sample size not stated. [research] <https://www.nngroup.com/articles/plain-language-experts/>
- Needlessly complex wording lowered readers' ratings of the author (Oppenheimer 2006). Secondary report only. [research] <https://www.dailyprincetonian.com/article/2006/10/on-erudite-vernacular-i-e-big-words>
- Plain language defined as content that is "clear and easy to understand" for its specific audience. [official] <https://digital.gov/guides/plain-language>
- Use: ask for one sentence first. Mirror it. Keep the three layers (passage, his reading, his application) apart, as the contract requires.

### Hook principles

- Official, general, and old: "The first few seconds of any video are critical". Tips named: start with a question, tell viewers what they will see, cold open. Posted 2014, written for long-form. [official] <https://blog.youtube/creator-and-artist-stories/four-tips-to-hook-your-viewers-on/>
- Open loop basis: curiosity is "a kind of mental deprivation caused by noticing a gap in one's knowledge or understanding". The abstract also says resolved curiosity can feel unsatisfying. [research] <https://stafforini.com/works/loewenstein-1994-psychology-curiosity-review/>
- TikTok-commissioned studies (vendor-run, brand ads on TikTok, not Shorts, not peer reviewed; one coded 3,500 ads): hook, body, close; "first six seconds are vital"; suspense +16% watch time; surprise 1.7x view-through rate; 90% of ad recall impact within 6 seconds. [research] <https://ads.tiktok.com/business/library/Creative_Codes_ENG.pdf>
- Bait-style phrasing is not reliably stronger. In two studies clickbait headlines "did not generate more curiosity than non-clickbait"; detectors agreed only 47% of the time; earlier studies are mixed. News headlines, not video. [research] <https://pike.psu.edu/publications/chi21.pdf>
- Question headlines drew "slightly more negative reactions" and expectations than traditional headlines. News headlines, small effect. [research] <https://www.niemanlab.org/reading/clickbait-study-readers-perceive-question-based-headlines-more-negatively-than-traditional-headlines/>
- YouTube policy bars "maliciously misleading titles, thumbnails, descriptions, or imagery to trick users into clicking" on a video "that does not deliver what was promised". Written for metadata, applied here by analogy to the spoken hook. [official] <https://support.google.com/youtube/answer/2801973?hl=en>
- YouTube's own recommendation post uses a title that promises match footage but delivers someone talking about the match as its example of a misleading result. [official] <https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/>
- For regular videos, the retention report's Intro figure (share still watching after 30 seconds) is described as a sign the opening matched the title and thumbnail. Payoff match is an official diagnostic, though this page does not cover Shorts. [official] <https://support.google.com/youtube/answer/9314415?hl=en&co=GENIE.Platform%3DDesktop>
- Muller's split: Type 1 (accurately signals the content) versus Type 2 (misleading or exaggerated), the latter likelier to provoke backlash; he says the line is vague. Secondary summary of a creator's view. [practitioner] <https://gigazine.net/gsc_news/en/20210830-clickbait-effective>
- Hook formula lists (pattern interrupt, direct promise, question, contradiction plus promise, numbered, mid-action) come from a vendor blog that cites no data. All its performance numbers are unsourced. [practitioner] <https://www.opus.pro/blog/youtube-shorts-hook-formulas>
- Use: the taxonomy below is practitioner-sourced. Test it through the AAR, one hypothesis at a time, and never trade honesty for retention.

### Personal-reflection tone

- Describing a scientist as intellectually humble raised trust in the scientist and belief in their research (5 studies, N = 2,034). Hypothetical scientists, survey experiments. Abstract-level; full text not opened. [research] <https://www.nature.com/articles/s41562-024-02060-x>
- Confident advisors were rated above "not sure" ones, but advice conveying uncertainty through ranges, probabilities or "more likely" was not penalized (11 experiments, N = 4,806; forecasting tasks). [research] <https://www.psychologicalscience.org/journals/psychological-science/0956797617739369/>
- Experts expressing some uncertainty gained interest and influence, non-experts gained from certainty, only when the arguments were reasonably strong. Restaurant reviews. [research] <https://www.gsb.stanford.edu/insights/believe-me-i-have-no-idea-what-im-talking-about>
- Counterweight: Pinker warns against "soggy apologies and hedges" and says readers' common sense fills in missing hedges. [practitioner] <https://www.psychologicalscience.org/observer/the-curse-of-knowledge-pinker-describes-a-key-cause-of-bad-writing>
- Story absorption shifted beliefs, and labeling a story fact or fiction had little effect on transportation. So a compelling account persuades whether or not it is accurate; honesty rests on the speaker. [research] <https://gwern.net/docs/www/pdfs.semanticscholar.org/39691cee32e52fbfc33f1a0316aa0d008cb699a4.pdf>
- Use: say what is unsure once, plainly, where it applies. Do not hedge every line, and do not announce humility as a device. Preserve his uncertainty exactly (contract: never make him sound more certain). The AI only asks what he is sure of and mirrors his own hedges.
- No study was found that tests "here is what I noticed" framing against authoritative framing in short video. The framing is consistent with the findings above and is a hypothesis for this channel.

### What we could not verify

- Any official YouTube number of seconds for a hook, or the seconds threshold that defines an engaged view or "stayed to watch". Reported as unpublished, to limit gaming.
- The body of the official 2025 Help Community announcement on Shorts view counting. Date taken from trade press.
- Whether the engaged-view definition is Shorts-only (Help glossary) or all formats (community announcement). Trade press reports the documents disagree.
- Shorts swipe-away and retention benchmarks. Sources conflict (healthy swipe-away under 15% to under 30%, "needs work" above 35%). A claim that a 3.3 billion Short dataset found 70 to 90% viewed performs best was not traced to an original: <https://virvid.ai/blog/first-3-seconds-hook-faceless-shorts-2026>
- "Swipe decision in about 1.7 seconds" (TikTok) and "65% of 3-second viewers reach 10 seconds" (Facebook, 2016). Seen only in secondary pages; originals not found.
- Any controlled study that isolates hook-to-payoff mismatch as a cause of swipe-away, retention loss, or dissatisfaction on Shorts. None found.
- Peer-reviewed evidence for any specific spoken-hook structure in short-form video. None found.
- A primary source for the "so what" test. Minto's rule that each level summarizes the ideas below it is the nearest; no source describes the test by name.
- Teach-back and reflective-listening evidence is from clinical and counseling settings, not from creating video.
- Oppenheimer 2006 and the 2024 humility paper were read at abstract or secondary level. A report that announcing humility can backfire was not verified.
- Whether announcing a personal-reflection framing ("here is what I noticed") changes retention. No data.

## Clarify question bank

Rules for every question: neutral; no question contains a candidate answer, an example, or a "have you considered". Do not ask "what about X" or "would it help to add X". Offered scales and bins (sure / fairly sure / still working it out) are allowed because they carry no content. Bracketed text is filled only with his own words. Ask one or two at a time. He can skip.

### The point

1. What is the one thing you want someone to take from this video? One sentence, however rough.
2. If you had five seconds to say it, what would you say?
3. Is it one point or more than one? If more, which one is this video about?
4. What made you want to say this one, in your words?
5. Finish this in your own words: "After this video, the viewer knows, thinks, or does ___."
6. What, if anything, makes this matter to you?

### Passage vs interpretation vs application

1. In your words, what does the passage say, before any meaning is added?
2. What do you take it to mean?
3. Is there something you do, or want to do, because of that reading? If not, say so.
4. Which of those three do you say first in the video: what it says, what you take it to mean, or what you do with it? Why that order?
5. Are there sentences where you move from one of the three to another without marking the move? Point to one if so.
6. Which of the three is the point of the video?

(Exact passage text and spoken-quote accuracy belong to `policy/scripture.md`. This step never checks the passage or his reading.)

### Audience and stakes

1. Who are you picturing as you say this?
2. What do you want that person to know, think, or do when it ends? Or nothing?
3. What, if anything, is at stake for them?
4. If they remembered one phrase tomorrow, which of your words would you want it to be?
5. Are you relying on that person already knowing anything? If so, what?
6. Are you assuming they know anything they may not? If so, what?

### Gaps and jumps

1. Walk me from [the first thing you say] to [the last thing you say]. What connects them, in your words?
2. Is any step in your reasoning one you skip because it feels obvious to you?
3. Which word or phrase in your recording would a newcomer need explained? Or none?
4. If a friend heard only this video, what would they say your point was? Does that match yours?
5. If there is a transcript: where do you restart, trail off, or say "um" most? What was happening there, in your words?
6. Is there a sentence a viewer could not follow without having read what you read?

### Certainty and humility

1. How sure are you of the point: sure, fairly sure, or still working it out?
2. Which part are you most sure of? Which part least?
3. Is any part said as fact that is really your reading? Which part?
4. Would you say this part the same way to someone who disagreed? What, if anything, would change?
5. Is there anything you want viewers to know you are unsure about, or nothing?
6. Where did each part come from, in a phrase: your own reading, a teacher, a book, a conversation, or not sure?

### Ending

1. How does the video end now, in the words you use?
2. What do you want to be the last thing the viewer hears?
3. Does the ending return to your point, add something new, or neither?
4. Is the last line something you want viewers to do, to think about, or neither?
5. If a viewer stopped listening three seconds before the end, would they have missed your point?
6. Is there a line after your point that you could remove without losing it?

### Mirror templates

Fill brackets with his exact words. Shorten only by cutting, never by rewording. Add no noun, adjective, claim, or example. End each with an invitation to correct.

1. "What I hear is: [his point, his words]. Is that what you mean?"
2. "You said [quote]. Later you said [quote]. Is that one point or two?"
3. "The passage says [his words]. You read it as [his words]. You [his words on application]. Did I put those in the right places?"
4. "The sentence I would mark as your point is: '[his sentence]'. Is that the one?"
5. "I am not sure which you mean, [his phrase A] or [his phrase B]. Which is closer?"
6. "You sounded sure about [his words] and less sure about [his words]. Is that right?"
7. "In your words the video ends on [his words]. Is that where you want it to end?"
8. "Your point, shortened with only your words: '[...]'. Did I lose anything that matters, or keep anything you would drop?"

If he says no: ask "What is closer?", then mirror his new words. After three failed rounds on the same point, stop and ask him to write the sentence himself.

### Stop conditions

The point is clear enough to move on when all hold, or when he says to move on:

- He states the point in one sentence, in his wording, and it is one point.
- He agrees to the latest mirror with no edits ("yes, that's it").
- He can place each part as passage, his reading, or his application, or says a layer is absent.
- He has said what he is sure of and what is his reading, or declined.
- He has said how it ends, or says it ends where it ends.

Always honored: "move on". Log it as "moved on before stop conditions met". If three mirror rounds fail, log "point unclear after 3 mirrors" and let him choose: restate, or proceed.

## Hook guidance

Runs after clarify, before editing. Skippable. A hook may only be built from what he said or stated. Honesty rules are `policy/editorial-contract.md` ("Hooks must be honest"); they win over anything below. If a hook scores well but breaks one, drop it.

### (a) Hook structures

Placeholders show the shape only. A candidate may use a shape only if every word, connectives included, is his from the recording or intake. If his words fit no shape, say so and offer fewer options. Do not write the connective phrases for him.

Basis tags point to sources in Research baseline > Hook principles. The fit and risk columns are this file's judgment, not measured.

| Structure | Placeholder | Fits when | Risk | Basis |
|---|---|---|---|---|
| Cold open on his strongest line | "[my strongest sentence, exactly as I said it]" | One line stands alone and is true to the whole video | Counts as a reorder; line may overstate the rest; needs context | [official] cold open |
| Point first | "Here is one thing I took from [passage]: [my point in one sentence]." | The point is one clear sentence | Less curiosity; can read like a title | [practitioner] Minto |
| Specific detail | "[the specific thing I noticed] in [passage]. Here is what I made of it." | He has a concrete detail he really dwelt on | Detail must be exactly as he said it; do not inflate | [practitioner] Heath |
| Contrast | "I used to [what I used to think or do]. Then I noticed [what I noticed]." | He actually changed his mind, in his words | A strawman of his past self; must be true | [practitioner] Heath |
| Open loop | "There is [one thing] in [passage] I [kept missing]." | The video resolves it, and soon | Loop never closes, or closes late: reads as misleading | [research] Loewenstein |
| Question | "[the question my video answers]?" | The video answers it plainly | Rhetorical or yes/no questions are easy to swipe; question headlines drew small negative reactions | [official] 2014 blog; risk: [research] Nieman |
| First-person noticing | "Here is what I noticed: [noticing]. I am still thinking about [the part I am unsure of]." | Reflection is the content and he is unsure of part | Performed vulnerability; it must be his actual state | [research] tone studies, indirect |
| Viewer situation | "If you have ever [situation he actually described], [my point]." | He named a situation in his own recording | Presumes the viewer's life; the AI may not invent the situation | [practitioner] vendor |

### (b) Evaluation checklist

Run on any candidate, including his own. Record pass, flag, or fail for each.

1. **Payoff match.** Read the hook, then the last ten seconds. Does the end deliver what the hook promised? Name the timestamp where it pays off. No payoff in the video is a fail.
2. **True to him.** Every claim in the hook is something he said and stands behind. It is not stronger or more certain than the body. Check `policy/editorial-contract.md`. Fail if not.
3. **Specific.** It names a detail, situation, or tension, not a category ("something powerful"). Test: could it open a different video unchanged? If yes, flag.
4. **Early.** The point of the hook is in the first spoken sentence, with no greeting or throat-clearing before it. Read it aloud at his pace and note seconds to the first meaningful word. Flag past about 3 seconds. That figure is an unsourced practitioner rule of thumb; official guidance says "first few seconds".
5. **His voice.** Would he say it to a friend? Does it use his vocabulary, not a template? Have him read it aloud and log his reaction.
6. **No misled viewer.** For someone who watched to the end, would the opening feel like an overpromise? Ask him: yes, no, or unsure. Yes or unsure is a fail until resolved.
7. **Layers intact.** The hook does not present his interpretation as what the passage says, or his application as settled fact.

Fail on 1, 2, 6, or 7: do not offer it. Flag on 3, 4, or 5: say what was flagged, his call.

### (c) How to present options

1. Ask first: "Do you want hook help, or do you already have a hook?" If he has one, run the checklist on it. If it passes, say so and stop. Do not manufacture alternatives to justify the step.
2. If offering options, offer at most 3 candidate framings, plus "keep original" always. No ranking, no "best", no predicted performance. List in order of appearance in the recording.
3. Every candidate is built only from his recorded or stated words. Show the exact words with the source: transcript timestamp or intake line.
4. Permitted: select, trim, reorder. Not permitted: add words, swap synonyms, add numbers or superlatives, join sentences so the meaning shifts, quote out of context.
5. If a candidate moves a line out of its original order, mark it "reorder" and show before and after. It needs his explicit yes (contract, "must not" list).
6. If a trim could change the meaning, say what was cut and ask: "This cuts '[words]'. Does it still say what you mean?"
7. For each candidate show: the words, the source timestamp, the structure name, and one line of reasoning (what it promises, where the video pays it off).
8. Ask: "Which one, and why? One line, skip is fine." Log his answer at once in the `episode.md` hook log.
9. If he writes his own hook, run the checklist, mirror it, and do not edit his wording.

Hook log entry (feeds the AAR):

```
original: <his first hook, verbatim>
offered: <up to 3, each with source timestamp, structure, reorder yes/no>
chosen: <original | candidate n | his own rewrite>
proposed_by: <his own | framing of his words | mix>
why: <his words, verbatim, or "skipped">
checklist: <pass/flag/fail per item>
```

## Learned from this channel

<!-- Loop-owned section. Each entry is one line: `- [vX.Y.Z | episode-id] rule or observation (why)`. vX.Y.Z is the design-system version in force when it was learned. The learning loop appends here and supersedes older entries (newest wins; the older line is marked superseded, not deleted). Entries may not relax the four rules or policy/editorial-contract.md. -->

No entries yet.
