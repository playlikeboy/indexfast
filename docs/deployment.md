# Deployment, secrets and migrations

## Order of operations for a release

1. `bun run lint && bun run test`
2. Apply migrations **before** deploying code that reads new columns:
   `bun run db:migrate` (uses `DATABASE_URL` from the shell / `.env`).
3. `bun run deploy` (OpenNext build + `wrangler deploy`).
4. Smoke test: `/`, `/dashboard`, `GET /api/mcp`, Razorpay webhook test event, `/admin` cron card.

## Secrets

Runtime secrets live in Cloudflare (`wrangler secret put NAME`) and are mirrored to GitHub
(`gh secret set NAME`) for CI. `worker.ts` copies every string binding into `process.env`.

| Name | Where |
|---|---|
| `DATABASE_URL` | Worker + GitHub |
| `CREDENTIAL_ENCRYPTION_KEY` (optional, falls back to `STACK_SECRET_SERVER_KEY`) | Worker. Never rotate without re-encrypting credentials |
| `NEXT_PUBLIC_STACK_PROJECT_ID`, `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`, `STACK_SECRET_SERVER_KEY` | Worker + build env |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Worker + GitHub |
| `ADMIN_EMAILS` | Worker + GitHub |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Worker + GitHub. Google OAuth "Web application" client |
| `NEXT_PUBLIC_SITE_URL` (optional), `GOOGLE_REDIRECT_URI` (optional) | Worker + build env. Redirect defaults to `<NEXT_PUBLIC_SITE_URL>/api/integrations/google/callback` |

Google Cloud setup (not in code): register `https://indexfast.co/api/integrations/google/callback`
(and the localhost callback for dev) as an authorized redirect URI, and enable the Search Console
API and the Web Search Indexing API. The webmasters and indexing scopes are sensitive: until Google
verifies the app, only listed test users can connect. The Indexing API default quota is 200
publishes/day per project (`GOOGLE_LIMITS.indexingApiProjectPerDay`); raise the constant only after
Google raises the quota.

Local (all gitignored; templates in `.env.example` / `.dev.vars.example`):
- `.env`: everything shared across modes, plus `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`
  (wrangler reads these for deploy) and `R2_*`.
- `.env.development` / `.env.production`: optional per-mode overrides (no longer needed for billing).
- `.dev.vars`: only `NEXTJS_ENV=development` (OpenNext then loads `.env` + `.env.development`)
  and `DATABASE_URL` (the scheduled handler reads it from bindings).

## Migrations

- Edit `src/db/schema.ts`, then `DATABASE_URL=... bunx drizzle-kit generate --name <name>`.
- Migrations must be additive and safe to run before the code deploys (old code keeps working).
- `0004_reverify_sites` resets every site to unverified (the old verify button never checked
  anything). Users click Verify once; their key file is usually still in place.
- `0005_razorpay_admin_analytics` adds `payments`, `page_views`, `cron_runs`,
  `users.plan_expires_at`, `users.last_seen_at`, sync counters on `sitemaps`, and the partial
  unique index for queue dedup (with a duplicate cleanup step first).
- `0006_short_raza` adds job `priority`, `http_status`, `retry_after_at` and `urls.last_submitted_engine`.
- `0007_queue_health` adds `submission_jobs.throttle_count` (the queue reads it) and claim/prune indexes.
- `0008_engine_integrations` adds `engine_quota_usage` (the cron and queue read it).
- `bun run db:migrate` runs `src/db/migrate.ts`, which applies every pending migration in one
  transaction over the WebSocket driver. There is no `db:push`.

## Release notes: queue health + engines

1. `bun run db:migrate` (applies 0007 and 0008) before deploying this code.
2. `bun run deploy`.
3. `bun run scripts/requeue-throttled-jobs.ts` (dry run), review the counts, then re-run with `--apply`.
4. If no cron run appears in `/admin` after the next hour, check the Cloudflare cron trigger and the
   Worker deploy. The next healthy run marks a stuck `running` row as failed.
