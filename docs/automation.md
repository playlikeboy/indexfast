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
   manual jobs first.
3. Submit per site+engine: IndexNow batches of 1000, Bing 100.
4. Network/429/5xx -> retry with backoff 10, 20, 40 min up to 3 attempts. Other errors fail fast.
5. Final outcomes update `urls.lastSubmittedAt/lastSubmissionStatus`; every attempt is
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
