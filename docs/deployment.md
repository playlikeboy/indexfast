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
| `DODO_*` (legacy, hidden) | Worker |

Local: `.env` (Next/Drizzle) and `.dev.vars` (wrangler). Both gitignored; templates in
`.env.example` / `.dev.vars.example`.

## Migrations

- Edit `src/db/schema.ts`, then `DATABASE_URL=... bunx drizzle-kit generate --name <name>`.
- Migrations must be additive and safe to run before the code deploys (old code keeps working).
- `0004_reverify_sites` resets every site to unverified (the old verify button never checked
  anything). Users click Verify once; their key file is usually still in place.
- `0005_razorpay_admin_analytics` adds `payments`, `page_views`, `cron_runs`,
  `users.plan_expires_at`, `users.last_seen_at`, sync counters on `sitemaps`, and the partial
  unique index for queue dedup (with a duplicate cleanup step first).
