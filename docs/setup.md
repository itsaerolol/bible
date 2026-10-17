# Setup

Production runs on your own machine with Claude Code. The cloud session only scaffolds the repo.

## One-time, local

| Need | Check | Install |
|---|---|---|
| Node 22+ | `node -v` | https://nodejs.org |
| ffmpeg + ffprobe | `ffmpeg -version` | `brew install ffmpeg` / `apt install ffmpeg` |
| Python 3 + numpy (two-angle sync) | `python3 -c "import numpy"` | `pip install numpy` |
| Chrome for rendering | `npx hyperframes doctor` | `npx hyperframes browser` |
| Transcription engine | `npx hyperframes doctor` | `npx hyperframes models install parakeet` (best), or build whisper.cpp (needs cmake and a C compiler) |
| HyperFrames skills | start Claude Code in this repo | accept the plugin prompt, or run `claude plugin marketplace add heygen-com/hyperframes` then `claude plugin install hyperframes@hyperframes` |

Run `npx hyperframes@0.8.168 doctor` and fix anything marked with a cross that you need. TTS and music generation are not used here. Voice cloning and voiceover are banned by the editorial contract.

Renders are pinned to HyperFrames 0.8.168 so old episodes re-render the same. To move up, change `HF_VERSION` in `scripts/new-episode.mjs` and test one episode first.

## Footage

Footage never goes in Git. Each episode keeps originals in `episodes/<id>/media/`, which is gitignored. `episode.md` stores sha256 hashes. Back the folder up elsewhere: a drive, Drive, or R2. Nothing in this repo does that for you.

## Daily loop

1. `/episode`
2. Record, drop the files in `episodes/<id>/media/`, continue.
3. Revise through Claude only.
4. `/posted <youtube url>`

## Skills

| Command | Does |
|---|---|
| `/episode` | The whole loop for one video |
| `/clarify` | Sharpen your point before recording. Questions and mirrors only |
| `/posted <url>` | Link the video, write the after-action report |
| `/evolve` | Apply after-action reports to the design system (runs automatically at the start of `/episode`) |

## Commits

`/posted` and `/evolve` commit locally. Nothing pushes unless you push. To undo a design change, say "revert that" after `/evolve` or `git revert` the `evolve:` commit.

## Dashboard

See `docs/dashboard-setup.md`.
