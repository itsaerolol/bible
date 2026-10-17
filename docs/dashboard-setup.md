# Dashboard setup

A daily GitHub Action pulls your YouTube data into `data/`, Haiku adds advice, and a private Vercel site shows it. Do the steps in order. About 45 minutes, most of it Google's console.

You need: a private GitHub repo with this code, a Vercel account, the Google account that owns the channel, an Anthropic API key, and Node 22 on your computer.

Until step 6 is done the site shows fabricated **MOCK DATA** (made by `scripts/make-mock-data.mjs`). The first real sync deletes it.

## 1. Google Cloud project

1. Open https://console.cloud.google.com and sign in with the Google account that owns the YouTube channel.
2. Project picker > New project. Name it `shorts-analytics`. Create, then select it.

## 2. Enable two APIs

APIs & Services > Library. Enable both:

- **YouTube Data API v3** (lists your uploads and durations)
- **YouTube Analytics API** (metrics, traffic sources, retention)

## 3. OAuth consent screen

Console menu names change. Look under **Google Auth Platform** (older UI: APIs & Services > OAuth consent screen).

1. Get started. App name `Shorts analytics`, your email as support and contact. Audience: **External**.
2. Data Access > Add scopes. Add both (read only):
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
   - `https://www.googleapis.com/auth/youtube.readonly`

   (`reports.query` requires `youtube.readonly` as well as the Analytics scope.)
3. Audience > Test users > add your own Google account.
4. **Audience > Publish app** so the status becomes **In production**.

### Why step 4 matters: the 7 day expiry

Google's docs say an External app in **Testing** status gets refresh tokens that **expire 7 days** after consent. Your daily sync would die within a week with `invalid_grant`.

Workaround, the one this guide uses: publish the app to **In production**. You do not need Google's verification for a personal tool. The app stays "unverified" (100 user cap, which is irrelevant for one user) and you click through one warning screen in step 5: Advanced > Go to Shorts analytics (unsafe). It is your own app.

If you stay in Testing anyway: rerun step 5 every 6 days and replace the `YOUTUBE_REFRESH_TOKEN` secret. Not recommended.

Other things that kill a refresh token: you revoke the app at myaccount.google.com/permissions, 6 months without use, or more than 100 tokens issued for the same client.

## 4. OAuth client

Google Auth Platform > Clients > Create client (older UI: APIs & Services > Credentials > Create credentials > OAuth client ID).

- Application type: **Desktop app**
- Name: `local helper`

Copy the **Client ID** and **Client secret**.

## 5. Get the refresh token (once, on your computer)

```bash
cd <repo>
YOUTUBE_CLIENT_ID='...' YOUTUBE_CLIENT_SECRET='...' node scripts/youtube-auth.mjs
```

A browser opens. Pick the account or brand channel that owns the Shorts, click through the unverified warning, and leave both permission boxes ticked. The terminal prints:

- `Authorized channel: <name> (UC...)`. If that is the wrong channel, run it again and pick the other account.
- the refresh token (starts with `1//`).

The token is not saved to disk. Do not commit it or paste it in chat.

## 6. GitHub secrets

Repo > Settings > Secrets and variables > Actions > New repository secret:

| Secret | Value |
|---|---|
| `YOUTUBE_CLIENT_ID` | from step 4 |
| `YOUTUBE_CLIENT_SECRET` | from step 4 |
| `YOUTUBE_REFRESH_TOKEN` | from step 5 |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com (Haiku costs cents per month) |

Optional: secret `VERCEL_DEPLOY_HOOK_URL` (step 7), and repository variable `ANTHROPIC_MODEL` (default `claude-haiku-5-5`).

Also: Settings > Actions > General > Workflow permissions: allow **Read and write** (the workflow also asks for `contents: write`).

## 7. Vercel project

1. Vercel > Add New > Project > import the repo. Keep the repo **private**.
2. **Root Directory: `dashboard`.** Framework preset Next.js is detected.
3. Environment variables (Production and Preview):
   - `DASHBOARD_PASSWORD` : a long passphrase. If this is missing in production the site returns 503 and serves nothing, by design.
   - optional `DASHBOARD_SESSION_SECRET` : extra signing secret.
   - optional `REPO_URL` : `https://github.com/<you>/<repo>` so video pages link to `episode.md`.
4. Project Settings > Build and Deployment > Root Directory, check two switches:
   - **Include source files outside of the Root Directory in the Build Step: ON.** Vercel enables it by default for projects created after Aug 2020. The dashboard's `prebuild` copies `../data` into `dashboard/.data`; without this switch `../data` does not exist during the build and the build fails with a clear message.
   - **Skip deployment: OFF.** Data commits only touch `data/`, outside the project folder, so a "skip unaffected projects" rule can skip the deploy and the site would never update. If you still see stale data, create a Deploy Hook (Settings > Git > Deploy Hooks) and store its URL as the `VERCEL_DEPLOY_HOOK_URL` secret; the workflow calls it after each data commit.
5. Deploy. In the build log look for `prepare-data: copied N file(s)`. Open the site: you should get the login page, then the dashboard with the MOCK DATA banner.

The gate: every page needs the password cookie (httpOnly, signed, 30 days). Wrong password waits 0.8 s. Sign out with the icon top right.

## 8. First manual run

Repo > Actions > **Sync analytics** > Run workflow. It takes about a minute.

What happens: episode index is rebuilt, YouTube is synced, `data/.mock` and the fake files are deleted, Haiku runs (a failure there does not block the commit), then `data: sync analytics YYYY-MM-DD` is committed and Vercel redeploys.

If a secret is missing the job logs a notice and changes nothing, so the mock data keeps working.

Expect few numbers at first: YouTube processes analytics with a **48 to 72 hour delay**. The sync holds back the last 3 days, so a video posted yesterday has no snapshot yet. It shows "No analytics yet", never a zero.

### Reading the retention-curve test

Google's docs define the retention report (`dimension elapsedVideoTimeRatio`, metrics `audienceWatchRatio` and `relativeRetentionPerformance`, filter `video==ID`, one video per request, no duration limit) but **do not say whether Shorts are supported**. Every run tests it and records the result. Find it in three places: the end of the Actions log (`RETENTION CURVE TEST: ...`), the run summary, and Overview > Sync health on the site. It counts only Shorts aged 4+ days.

| Verdict | Meaning | Do |
|---|---|---|
| `WORKS` | At least one Short returned a curve. | Nothing. Shorts with no curve are usually too new or low in views. |
| `UNAVAILABLE` | Every Short aged 4+ days returned an empty answer or an error. | Read `first_error` in `data/analytics/sync-status.json`. An empty answer with no error means the API has no curve for Shorts (or your views are below its privacy threshold). Use the CSV fallback below. |
| `INCONCLUSIVE` | No tracked Short is 4+ days old yet. | Run it again in a few days. |

A video that has a curve from the API never needs the CSV. A CSV curve is carried forward by later syncs until the API provides its own.

## 9. CSV fallback for retention

1. YouTube Studio > Analytics > open the video > Engagement (or Overview) > Audience retention > **Advanced mode** / See more > **Export current view** > CSV. Unzip if you get a zip and find the file that holds the retention chart.
2. Save it as `episodes/<episode-id>/retention.csv`.
3. `git pull`, then `node scripts/import-retention-csv.mjs <episode-id>` (or `--all`).
4. Commit `data/analytics/videos/<youtube_id>.json` and the CSV.

The episode needs `youtube_id` in `episode.md` (set by `/posted`) and the video needs at least one snapshot (about 3 days after posting).

Honest limit: Google's Help pages do not describe the export's columns or confirm the retention chart is exportable, so the importer is tolerant and prints what it detected. It accepts position as percent, ratio or time (`0:05`), retention as percent or ratio, an optional relative column, `,` `;` or tab separators, and headerless two column files. If detection guesses wrong use `--position-col` and `--retention-col`. If Studio gives you no usable export, a hand made two column file also works:

```csv
position %,retention %
0,100
5,84
10,71
...
100,38
```

## 10. How the numbers behave

- **Snapshots** are cumulative lifetime metrics at a sync date, with `data_through` (3 days earlier). Cadence: daily for the first 14 days, weekly until day 90, monthly after. That keeps the repo small (each curve is about 6 KB).
- **Views definitions changed.** Public views count from the first frame (Shorts since 2025-03-31, all videos since late August 2026: the YouTube blog says Aug 24, the API changelog says Aug 27). `engagedViews` keeps the earlier rule. Compare like with like and prefer engaged views for trends across those dates.
- **Shorts detection** is by duration: up to 180 seconds (3 minutes for uploads after 2024-10-15). The API exposes no aspect ratio, so a horizontal video under 3 minutes would count too. Long videos and private videos are skipped.
- **Studio will not match exactly.** Studio is near real time. The API lags.
- **Maturity.** Videos under 7 days carry a warning. Learning pages leave them out by default.
- **Cost.** Haiku 5.5 is about $0.10 per million input tokens. One run is a few thousand tokens. It skips when nothing changed.
- **Quota.** Each sync makes about 3 requests plus 2 per snapshotted video. Google's public pages did not give an Analytics API quota figure. If you see 429 or quota errors, run with `--max-videos 100`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Log: "YouTube secrets are not all set" | A secret is missing or misnamed | Step 6. Names must match exactly. |
| `invalid_grant` on token refresh | Token expired: Testing status (7 days), revoked, unused 6 months, or over 100 tokens | Publish the app (step 3), rerun step 5, replace `YOUTUBE_REFRESH_TOKEN`. |
| HTTP 403 `accessNotConfigured` / "API has not been used" | An API is not enabled in the project | Step 2, wait a minute, rerun. |
| HTTP 403 insufficient scopes | Token lacks a scope | Rerun step 5 and tick every box. |
| "channels.list returned no channel" | Token belongs to a different account, or brand account not chosen | Rerun step 5 and pick the channel's account. Check `Authorized channel:` line. |
| HTTP 400 on a report | Metric or dimension combination rejected | Read `first_error` in `sync-status.json`. The sync already retries without `engagedViews`. Open an issue with the message. |
| Retention test `UNAVAILABLE` | API has no curve for Shorts or views too low | Section 9. |
| Video missing on the site | Over 3 minutes, private, or published less than 3 days ago | Wait for the next sync. Check `sync-status.json` counts. |
| Hook type, passage, version show "Not linked" | No episode has that `youtube_id` | Run `/posted` or set `youtube_id` in `episode.md`. Sync logs "unmatched youtube_id" for typos. |
| MOCK DATA banner after a real sync | `data/.mock` still in the repo, or the sync never succeeded | Check the Action run. `git rm data/.mock` if the files are real. |
| Site says "Dashboard is not configured" (503) | `DASHBOARD_PASSWORD` not set for that environment | Step 7.3, redeploy. |
| Build fails: "prepare-data: ... does not exist" | Files outside the root directory are not included | Step 7.4, first switch. |
| Site does not update after a data commit | Deployment skipped, or the push did not trigger Vercel | Step 7.4, second switch, or add the deploy hook. |
| Login works then bounces back to the login page | Cookies blocked, or the site is served over plain http (the cookie is `Secure` in production) | Use https. |
| Insights page empty | No `ANTHROPIC_API_KEY`, `data/.mock` present, or the Haiku step failed | Open the "Haiku insights" step log. 401 means a bad key. The step failing never blocks the data commit. |
| Insights say "directional only" | Fewer than 5 videos with data | Expected. It improves with volume. |
| Action cannot push | Branch protection, or workflow permissions are read only | Allow the Actions bot to push, or set permissions to read and write. |
| Numbers differ from Studio | Studio is near real time, API lags 48 to 72 hours | Wait. Compare after 3 days. |

## Files

| Path | Purpose |
|---|---|
| `scripts/youtube-auth.mjs` | one-time refresh token helper |
| `scripts/sync-analytics.mjs` | daily sync (`--dry-run`, `--fixtures <dir>`, `--out <dir>`) |
| `scripts/import-retention-csv.mjs` | Studio CSV fallback |
| `scripts/build-episode-index.mjs` | `episodes/*/episode.md` to `data/episodes-index.json` |
| `scripts/haiku-insights.mjs` | advice to `data/insights.json` |
| `scripts/check-analytics-data.mjs` | validates `data/` against `docs/schemas.md` |
| `scripts/make-mock-data.mjs` | regenerates the sample data |
| `.github/workflows/sync-analytics.yml` | daily at 09:17 UTC plus manual |
| `.github/workflows/ci.yml` | dashboard typecheck and build, repo checks |
| `dashboard/` | the Next.js site |
