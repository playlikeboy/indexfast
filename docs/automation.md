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
   Already hosting an IndexNow key? `adoptExistingIndexNowKeyForUser` accepts the key or the
   key file URL, checks it *before* saving (a typo never replaces the generated key), then
   verifies. Exposed in the setup card, MCP `verify_site { existingKey }` and REST
   `POST /api/v1/sites/:site/verify { existingKey }`.
3. **Ongoing**: the hourly cron re-crawls due sitemaps and submits new/changed URLs.

## Sitemap discovery (`sitemaps.ts`)

- robots.txt `Sitemap:` lines win.
- Otherwise common sitemap paths are probed in parallel, then RSS/Atom feeds as last resort.
- Sources that are children of a discovered index are dropped; indexes sort first.
- Crawl: BFS through indexes, max 100 files, 15 MB per file, URL cap from the plan.

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
   ordered by `priority ASC` (manual = 1, new sitemap = 5, refresh = 10), then `nextRunAt ASC`, then `createdAt ASC`.
3. Submit per site+engine: IndexNow batches of 1000, Bing 100.
4. **429 Circuit Breaker & Adaptive Retry**:
   - Parses search engine `Retry-After` headers (both integer seconds and HTTP-date strings).
   - A rate limit (IndexNow 429 `TooManyRequests`, Bing `ThrottleIP` / ErrorCode 17) trips the breaker for that `siteId:engine`
     and parks **every** queued job of that site+engine (not only this run's) until the cooldown ends.
   - The cooldown is persisted in `submission_jobs` (`httpStatus = 429`, future `nextRunAt`). `getActiveThrottle()` checks it
     before every send, so the cron, "Process now" and manual submits never re-hit an engine mid-cooldown (that extends the ban).
   - Throttled jobs never fail terminally: the 3-attempt cap only applies to network/5xx errors. 429 backoff starts at 1h,
     doubles per attempt and caps at 24h (+/-20% jitter). Network/5xx backoff is 5 min base, 2h cap.
   - Throttled attempts are not logged per URL in `submissions` (that produced 57k noise rows). One deduped alert
     "<Engine> is rate limiting this site" is raised and auto-resolved on the next success.
   - `retryFailedForUser` re-queues URLs whose last submission failed (dashboard "Retry failed").
   - A manual submit promotes already-queued jobs for those URLs to priority 1.
5. Final outcomes update `urls.lastSubmittedAt`, `urls.lastSubmissionStatus`, and `urls.lastSubmittedEngine`; every attempt is
   logged in `submissions`; failures raise one de-duplicated alert per site, success resolves it.

Credentials are AES-GCM encrypted at rest and lazily re-encrypted if a legacy plaintext row
is read. Only jobs of verified sites are claimed (`FOR UPDATE SKIP LOCKED`).

Engines: IndexNow (needs verified key) always; Bing only on Pro/Unlimited with a verified
per-user key.

## Cron (`runScheduledAutomation`, hourly from `worker.ts`)

1. `downgradeExpiredPlans()` (see docs/billing.md).
2. `findDueSites()`: sources never synced or older than the owner's plan interval
   (Free 24h, paid 1h), skipping paused sites, max 40 sites per run, 10-minute time budget.
3. Sync each, then drain up to 2000 queue jobs.
4. Write a `cron_runs` row (status, summary, error). The admin panel shows the last 12.

Run locally: `bun run cron:dev` then hit `/__scheduled`.

## Limits (`constants.ts`)

Runtime bounds protecting the Worker live in `AUTOMATION_LIMITS` / `ENGINE_BATCH_SIZE`.
Per-plan limits live in `plans.ts`. Do not mix them.
