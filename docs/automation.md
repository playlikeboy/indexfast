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
   - If a 429 or `Retry-After` is encountered, trips the circuit breaker for that `siteId:engine` immediately.
   - All subsequent claimed batches for that engine in the current run are postponed cleanly without incrementing attempt count or hammering search engine endpoints.
   - Exponential backoff with randomized jitter (±20%) ensures retries are spread across time to prevent thundering herds (base 15 min for 429 cooling, 5 min for 5xx/network errors).
   - Jobs store `httpStatus`, `retryAfterAt`, and scheduled `nextRunAt`.
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
