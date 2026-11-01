# Automation pipeline

All writes live in `src/lib/automation/service.ts`. Dashboard actions, REST, MCP and the
cron call into it; nothing else mutates sites, URLs or the queue.

## User flow

1. **Add site** (`createSiteForUser`): domain only. Checks the plan site limit, creates the
   site and its IndexNow key, discovers sitemaps, runs the first sync. Failures in discovery
   or sync are returned as a warning, never block creation.
2. **Verify** (`verifySiteForUser`): fetches `https://<host>/<key>.txt`. A matching file
   proves ownership, so it sets `sites.verified`, `automationEnabled`, the integration to
   `verified`, and queues + submits the backlog of never-submitted URLs.
   Security rules: the file must be at the site root (no subfolders, where user uploads
   could live) and must not redirect to another URL. One file serves both IndexNow and
   ownership, which is why there is no separate `.well-known` token (an interim
   implementation used `/.well-known/indexfast-verification.txt`; it was folded into this).
   Unverified sites can be synced (URLs are visible) but nothing is ever submitted.
   A failed re-check clears `sites.verified`, so nothing is sent until the file passes again;
   queued jobs simply wait. Verifying a paused site (over the plan's site limit) is refused.
   Saving a different key (`saveIndexNowKeyForUser`) sets the integration to `pending`; its
   IndexNow jobs stay queued (re-checked hourly) instead of failing with a 403.
   Already hosting an IndexNow key? `adoptExistingIndexNowKeyForUser` accepts the key or the
   key file URL, checks it *before* saving (a typo never replaces the generated key), then
   verifies. Exposed in the setup card, MCP `verify_site { existingKey }` and REST
   `POST /api/v1/sites/:site/verify { existingKey }`.
3. **Ongoing**: the hourly cron re-crawls due sitemaps and submits new/changed URLs.

## Sitemap discovery (`sitemaps.ts`)

- robots.txt `Sitemap:` lines win (at most 20 are considered).
- Otherwise common sitemap paths are probed, then RSS/Atom feeds as last resort.
- Probes read only the first 1 MB of each file, 3 at a time, so discovery memory stays bounded.
- Sources that are children of a discovered index are dropped; indexes sort first; at most 20 are kept.
- Crawl: BFS through indexes, max 100 files, 15 MB per file, URL cap from the plan. Only the
  root failing fails the source; a broken child is skipped and reported on the source
  (`site_sitemaps.last_error_message`, `sitemaps.error_message`) while the other children sync.
- `.xml.gz` sitemaps served without `Content-Encoding` are inflated (gzip magic bytes), with
  the same 15 MB limit on the inflated size.
- At most 20 sources per site are synced (primary first).

## Dedup

- **URL identity**: `canonicalizeUrl()` (url-utils.ts) lowercases host, drops fragment,
  default port and tracking params (`utm_*`, `gclid`, `fbclid`, ...). Path case and
  trailing slashes are preserved (they are different URLs to search engines).
- **Storage**: unique `(site_id, loc)` on `urls`. A URL in several sitemaps, or submitted
  manually, is one row. Within one crawl the freshest `<lastmod>` wins.
- **Queue**: partial unique index `submission_jobs_open_unique_idx` on
  `(site_id, loc, engine) WHERE status IN ('queued','processing')`. Enqueue is a bulk
  `INSERT ... ON CONFLICT DO NOTHING`.
- **Resubmission**: a changed URL is not resubmitted within `resubmitCooldownHours` (24h).
  An edit detected inside the cooldown is queued with `nextRunAt = lastSubmittedAt + 24h`
  rather than dropped (its new lastmod is already stored, so it would never be seen again).
- **Canonical query**: `%20` and `+` in a query are the same URL (stored as `+`), and a bare
  trailing `?` is dropped.

## New and changed URLs

During `syncSitemapSource`:
- existing rows are looked up in chunks of 1000;
- *new* = not tracked yet (limited by the plan's remaining URL capacity);
- *changed* = `<lastmod>` moved forward;
- new + changed are upserted in chunks of 500, unchanged rows only get `lastSeenInSitemapAt`;
- counts are stored on the `sitemaps` sync log (`url_count`, `new_count`, `changed_count`).
The dashboard "New (7d)" tab is `urls.created_at > now() - 7 days`.

## Submission queue (`processSubmissionQueue`)

1. Release `processing` jobs locked longer than 15 minutes (crashed runs).
2. Atomically claim due jobs (`UPDATE ... WHERE id IN (subquery) AND status='queued' RETURNING`),
   ordered by `priority ASC` (manual = 1, new sitemap = 5, refresh = 10), then `nextRunAt ASC`, then `createdAt ASC`
   (partial index `submission_jobs_queued_claim_idx`). Only verified sites are claimed; new/changed jobs also need
   `sites.automationEnabled`, manual jobs do not.
3. Each claimed job is classified (`classifyClaimedJob`):
   - **paused site** (plan downgrade, `getPausedSiteIdsForUsers`): back to queued for 24h;
   - **IndexNow key pending/failed re-check**: back to queued for 1h (retryable, never a 403 failure);
   - **engine not eligible** (`resolveEligibleEngines`: per-site toggle off, key not verified, or Bing on a plan
     without `limits.bing`, which includes expired plans past grace): status `skipped`, never sent;
   - otherwise sent.
4. Submit per site+engine: IndexNow batches of 1000, Bing 100. Pacing: at most **one IndexNow request per site per
   run** (`indexNowRequestsPerSitePerRun`); the rest of the claim goes back to queued with its `nextRunAt` untouched.
5. Every write to a claimed job requires `status = 'processing'` **and** the same `lockedAt` it was claimed with, so a
   slow run whose lock was recovered by another run cannot overwrite that run's result. Submission logs and
   `urls.lastSubmitted*` are written only for jobs the run still owned.
6. **Rate limits** (IndexNow 429 `TooManyRequests`, Bing `ThrottleIP` / ErrorCode 17 even with HTTP 400; one helper,
   `isRateLimited` in `search-engines.ts`):
   - never increment `attempts` and never fail a job. `submission_jobs.throttle_count` counts consecutive rate limits
     and is the backoff exponent: 1h doubling to 24h (+/-20% jitter), and never shorter than the engine's `Retry-After`
     (`max(Retry-After, exponential)`). There is no fixed fallback cooldown.
   - are stored with `httpStatus = 429` (also when detected from the message), so `getActiveThrottle()` sees them.
   - park **every** queued job of that site+engine until the cooldown ends, sharing the throttle exponent. The breaker
     is checked before every send, so the cron, "Process now" and manual submits never re-hit an engine mid-cooldown.
   - are not logged per URL in `submissions`. One deduped alert "<Engine> is rate limiting this site" is raised and
     auto-resolved on the next success, which also resets `throttle_count` for that site+engine.
7. Network/5xx errors retry up to 3 attempts (5 min base, 2h cap, Retry-After honoured); other errors fail at once with
   one de-duplicated alert per site.
8. `deadline` (cron only): no batch starts after it; unsent claimed jobs go back to queued.

`retryFailedForUser` re-queues URLs whose last submission failed (dashboard "Retry failed"). A manual submit promotes
already-queued jobs for those URLs to priority 1. `drainSiteQueueForUser` ("Process now") checks ownership and that the
site is not paused, and clamps `maxJobs` to 1..`maxDrainJobsInline` (1000).

Credentials are AES-GCM encrypted at rest. Decryption tries `CREDENTIAL_ENCRYPTION_KEY` and then
`STACK_SECRET_SERVER_KEY`, so adding the dedicated key later does not lock existing rows; rows that are plaintext or
only open with the fallback key are re-encrypted with the primary key when read.

Engines: IndexNow (needs a verified key) on every plan; Bing only on plans with `limits.bing` (Pro/Unlimited) with a
verified per-user key. `saveBingApiKeyForUser` and enabling `setBingAutomationForSite` refuse other plans.
`removeBingApiKeyForUser(userId)` deletes the user's key, which stops Bing on every site. Per-site control is
`setBingAutomationForSite`; deleting a site's bing row would fall back to auto-submit on.

### Recovering jobs failed by old 429 handling

Before rate limits stopped counting as attempts, many jobs ended `failed` with `http_status = 429`.
`scripts/requeue-throttled-jobs.ts` moves them back to `queued` (attempts and `throttle_count` reset), one job per
site+URL+engine, skipping any URL that already has an open job, with `next_run_at` spread over 24 hourly slots per
site+engine and never before an active cooldown, so recovery does not re-trigger the ban.

```bash
bun run scripts/requeue-throttled-jobs.ts                         # dry run: prints counts per site, writes nothing
bun run scripts/requeue-throttled-jobs.ts --apply                 # re-queue over 24h
bun run scripts/requeue-throttled-jobs.ts --apply --spread-hours=48
```

Run it only after the throttle-count migration (`0007_queue_health`) is applied and the new queue code is deployed.

## Engines (`src/lib/engines/`)

IndexNow stays the default for every site (it fans out to Bing, Yandex, Seznam, Naver, Yep).
Everything below is optional. Engine clients (`gsc.ts`, `yandex.ts`, `baidu.ts`,
`google-oauth.ts`) are pure HTTP + parsing with unit tests; `google-service.ts` and
`extra-engines.ts` hold the DB side. Plan gates live in `plans.ts`
(`gscInspectionsPerDay`, `yandex`, `baidu`, `googleIndexingApi`).

| Engine | Stored as | Plan | Notes |
|---|---|---|---|
| Google Search Console | `user_integrations` `google` (encrypted refresh token, scopes) + `site_integrations` `gsc` (matched property) | All; Free 100 inspections/day/site, paid 2,000 | OAuth at `/api/integrations/google/start` -> `/callback`. Site matched to `sc-domain:<domain>` (most specific wins) or `https://<host>/` / `http://<host>/` URL-prefix property; unverified entries ignored |
| Google Indexing API | `site_integrations` `google_indexing_api`, queue engine `google_indexing_api` | Paid | Same OAuth token (indexing scope). Needs property Owner. Each page's live JSON-LD must pass `checkGoogleIndexingEligibility` (JobPosting, or BroadcastEvent nested inside a VideoObject); other pages become `skipped` jobs, never sent, no quota used |
| Yandex Webmaster recrawl | `user_integrations` `yandex` (encrypted OAuth token) + `site_integrations` `yandex` (host id) | Paid | Host must be verified in Yandex Webmaster. Daily quota read from `GET .../recrawl/quota` before each group |
| Baidu push | `site_integrations` `baidu` (encrypted token, today's `remain`) | Paid, verified site | Saving the token pushes the homepage once (Baidu has no read-only check). `remain` from each answer limits the next push; unknown remain sends a 1-URL probe |

Queue integration (`service.ts`): `loadEngineState` also loads the optional engines;
`resolveEligibleEngines` appends `resolveExtraEngines` (plan flag + setup complete + site
toggle; manual submits ignore the toggle, never the plan). `submitEngineBatch` dispatches to
`submitExtraEngineBatch`. Before sending a Yandex/Baidu group, `getEngineRunBudget` caps it
at the remaining quota; the rest is re-queued for the engine's next midnight (Moscow /
Beijing). Google Indexing API and Yandex send one URL per request (batch size 1); Baidu 500.
Rate limits reuse the shared throttle path: quota answers are reported as 429 with a
Retry-After until the engine's midnight.

Quotas we cannot read back are counted in `engine_quota_usage` (one atomic upsert that only
succeeds while `used + n <= limit`): URL Inspection per property per Pacific day
(min(plan, 2,000)) and per UTC minute (600), and the Indexing API's project-wide 200/day
(the default quota is per Google Cloud project, so all users share it). A Google 429 marks
the day (message mentions "per day") or the minute as used up.

Search Console behaviour:
- After a sync finds new URLs on a verified site, that sitemap is resubmitted
  (`PUT webmasters/v3/sites/{property}/sitemaps/{feedpath}`); needs Owner or Full user.
  Failures land on the `gsc` row's `lastErrorMessage`, never in the sync.
- URL Inspection writes `urls.gscStatus` (Google's coverage text), `indexingStatus`
  (PASS -> indexed, blocked states -> blockers, FAIL/NEUTRAL -> not_indexed) and
  `lastCheckedAt`, plus a `checks` row (`gsc_inspection`). Only an inspection may set
  `indexed`; live diagnostics keep Google's verdict on a pass.
- Deindexing alert: when an inspection returns not indexed for a URL whose previous
  verdict was `indexed`, an `indexing_drop` alert ("Pages dropped out of Google's index")
  is raised, one open alert per site, refreshed with the latest URL.

Diagnostics (`evaluateUrlDiagnostics`, `src/lib/automation/diagnostics.ts`) check HTTP status,
redirects (warn), `noindex` in meta or `X-Robots-Tag` (fail), canonical mismatch (warn) and
robots.txt disallowing Googlebot or `*` (fail; an unreachable robots.txt fails open).
- Access tokens are cached per isolate until 60s before expiry. `invalid_grant` on refresh
  marks the connection `failed` until the user reconnects. Disconnect revokes at Google and
  deletes the token plus every `gsc` / `google_indexing_api` site row.

## Cron (`runScheduledAutomation`, hourly from `worker.ts`)

`worker.ts` awaits the whole run (and registers it with `waitUntil`), so the scheduled event is not cut off mid-run.

0. Mark `cron_runs` rows still `running` after 20 minutes as `failed` ("Timed out"): a killed run cannot do this itself.
1. `downgradeExpiredPlans()` (see docs/billing.md).
2. `findDueSites()`: sites with a source never synced or older than the owner's plan interval (Free 24h, paid 1h,
   computed in SQL with the same grace rule as `resolveEntitlement`), oldest first, skipping paused sites. There is no
   per-run site cap: sites sync until the 6-minute sync budget, which is also checked before every sitemap file.
3. Drain up to 2000 queue jobs until the 10-minute mark.
4. Search Console URL Inspection (`runScheduledGscInspections`): never-checked URLs first, then those last checked
   over 7 days ago; at most 300 per run, 50 per site, 2 minutes, stopping a property when its quota is used up.
5. Prune `api_usage_events` older than 90 days and `engine_quota_usage` rows older than 3 days.
6. Finish the `cron_runs` row. Each step is isolated: a failing step is recorded and the others still run; the row ends
   `failed` with every step's error, or `success`. The admin panel shows the last 12.

Run locally: `bun run cron:dev` then hit `/__scheduled`.

## Migrations

`bun run db:migrate` (`src/db/migrate.ts`) uses the Neon WebSocket driver so all pending migrations and their journal
rows apply in one transaction: a failing statement rolls the whole run back.
`0008_engine_integrations` adds `engine_quota_usage` (needed before deploying the engine integrations).

## Limits (`constants.ts`)

Runtime bounds protecting the Worker live in `AUTOMATION_LIMITS` / `ENGINE_BATCH_SIZE`; Google quotas and the
inspection batch bounds in `GOOGLE_LIMITS`.
Per-plan limits live in `plans.ts`. Do not mix them.
