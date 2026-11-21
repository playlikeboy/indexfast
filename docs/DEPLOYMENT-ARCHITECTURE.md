# Deployment architecture

Purpose: this document describes how the SEO platform runs on Cloudflare: one public origin, one
Worker entrypoint, which bindings and secrets exist today and which are planned, how CI works,
how staging is done, and how a release is shipped and rolled back. The release checklist for
today's app is in `docs/deployment.md`; this file extends it for the SEO platform work. No deploy,
DNS change or production migration happens without the owner's explicit approval.

---

## 1. Topology

```
Browser / agent / CLI
        |
        v
https://indexfast.co  (Cloudflare Custom Domain, wrangler.jsonc "routes")
        |
        v
Worker "indexfast" (worker.ts)
  fetch      -> OpenNext (.open-next/worker.js) -> Next.js 16 App Router
                 /, /tools/*, /blog/*, /dashboard/*, /admin, /api/v1/*, /api/mcp, ...
  scheduled  -> runScheduledAutomation() (hourly "0 * * * *")
  Workflows  -> SiteAuditWorkflow, RankCheckWorkflow, AiVisibilityWorkflow   (planned)
        |
        +--> Neon Postgres (HTTP driver at runtime)
        +--> R2 bucket for crawl payloads (planned)
        +--> Browser Rendering (planned)
        +--> DataForSEO, Google APIs, IndexNow, Bing, Yandex, Baidu (outbound fetch,
             global_fetch_strictly_public)
        +--> service binding "indexfast-jobs" (fallback only, see 2.2)
```

Rules:

- **Single origin** `https://indexfast.co`. No customer-facing subdomains (no `app.`, `api.`,
  `audit.`). MCP stays at `/api/mcp`, REST at `/api/v1/*`.
- **Own resources only.** Every KV, R2, Workflow and Durable Object is created in IndexFast's
  Cloudflare account (`account_id` in `wrangler.jsonc`). OpenSEO's resource IDs are never copied.
- Outbound fetches keep `global_fetch_strictly_public` (already set), plus the existing
  `assertSafeExternalUrl` and per-hop redirect checks for user-supplied URLs.

---

## 2. `worker.ts` exports

### 2.1 Today (Done)

| Export | Purpose |
|---|---|
| `default.fetch` | Copies string bindings into `process.env`, then OpenNext handler |
| `default.scheduled` | Hourly automation; throws if `DATABASE_URL` is missing |
| `DOQueueHandler`, `DOShardedTagCache` | Re-exported from OpenNext |

### 2.2 Planned

| Export | Purpose | Phase |
|---|---|---|
| `SiteAuditWorkflow` | Crawl in chunks (discovery, pages, finalize, vitals), Postgres frontier, raw payloads in R2 | 5 |
| `RankCheckWorkflow` | Large or scheduled rank runs: `task_post`, wait, `task_get`, persist | 3 |
| `AiVisibilityWorkflow` | Prompt collection across engines | 6 |

Each Workflow class is exported from `worker.ts` and declared in `wrangler.jsonc` `workflows`
with `script_name` omitted (same script). Workflow steps call the same `src/lib/seo/*` services
as the request path and bind env the same way `scheduled` does.

Fallback: if the OpenNext bundle size or CPU limits make in-Worker Workflows impractical, the
Workflow classes move to an internal Worker `indexfast-jobs` with `workers_dev = false` and no
routes. The app reaches it only through a service binding. It is never publicly addressable, so
the single-origin rule holds.

Short polling state machines (DataForSEO `task_post` then `task_get` for small batches, monthly
credit reset, cache pruning) run in the existing hourly cron over Postgres job tables.

---

## 3. Bindings

| Binding | Type | Status | Notes |
|---|---|---|---|
| `ASSETS` | Static assets (`.open-next/assets`) | Done | |
| `IMAGES` | Images | Done | |
| `EMAIL` | `send_email` | Done | Contact/feedback today; alert notifications planned |
| `WORKER_SELF_REFERENCE` | Service (self) | Done | OpenNext cache |
| Cron `0 * * * *` | Trigger | Done | |
| `SITE_AUDIT_WORKFLOW`, `RANK_CHECK_WORKFLOW`, `AI_VISIBILITY_WORKFLOW` | Workflows | Planned | Names to be fixed when added |
| `CRAWL_BUCKET` | R2 (new bucket, for example `indexfast-crawl`) | Planned | Raw HTML and Lighthouse payloads with lifecycle expiry; never customer-public |
| `BROWSER` | Browser Rendering | Planned | JS-rendering checks; metered |
| `JOBS` | Service binding to `indexfast-jobs` | Planned, only if needed | Fallback in 2.2 |
| Rate limiting binding for free tools | Rate limit | Planned | Public free-tool actions have no rate limit today |

After adding bindings, run `bun run cf-typegen` to refresh `cloudflare-env.d.ts`.

---

## 4. Secrets

Existing (see `docs/deployment.md` for where each is set): `DATABASE_URL`,
`CREDENTIAL_ENCRYPTION_KEY` (optional, falls back to `STACK_SECRET_SERVER_KEY`),
`NEXT_PUBLIC_STACK_PROJECT_ID`, `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`,
`STACK_SECRET_SERVER_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_CURRENCY`, `RAZORPAY_PRICE_*`, `ADMIN_EMAILS`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_SITE_URL`,
`CONTACT_FROM_EMAIL`, `CONTACT_NOTIFY_EMAIL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

New for the SEO platform:

| Name | Status | Purpose |
|---|---|---|
| `DATAFORSEO_LOGIN` | In progress (this branch) | Platform DataForSEO API login (Basic auth) |
| `DATAFORSEO_PASSWORD` | In progress (this branch) | Platform DataForSEO API password |
| `OPENROUTER_API_KEY` | Planned | LLM calls for prompt research and Autopilot |
| `GOOGLE_PSI_API_KEY` | Planned | PageSpeed Insights v5 and CrUX |

Set with `wrangler secret put NAME` and mirror with `gh secret set NAME`. Without the DataForSEO
secrets, paid research features must report "not configured" instead of failing at call time;
BYOK orgs still work. Per-org BYOK credentials live in `provider_credentials`, encrypted with
`CREDENTIAL_ENCRYPTION_KEY`; rotating that key makes them unreadable (same rule as other stored
credentials).

---

## 5. CI

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/deploy.yml` | push to `main`, manual | Install, prep stub, `tsc --noEmit`, lint, tests, **`bun run db:migrate` against production**, OpenNext build and `wrangler deploy` |
| `.github/workflows/health-check.yml` | daily 03:30 UTC, pull requests, push to `main`, manual | Quality gates and live smoke test; opens or updates one issue on failure; never deploys |

Consequence: merging `feat/seo-platform` into `main` migrates production and deploys. Treat the
merge as the release and take the Neon snapshot first (`docs/DATABASE-MIGRATION-PLAN.md`
section 6). Feature work stays on the branch until the owner approves.

New CI secrets to mirror when features ship: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` (only if
tests or build need them; unit tests must not call DataForSEO).

---

## 6. Staging

- **Database:** a Neon branch from production per release candidate. Point `DATABASE_URL` at it
  for `bun run dev`, `bun run preview` and `bun run cron:dev`.
- **Worker:** `bun run upload` (`opennextjs-cloudflare upload`) uploads a new Worker version
  without routing traffic to it; test it through its version preview URL. `bun run preview` runs
  the built Worker locally with bindings.
- **Workflows:** exercise locally with `wrangler dev`; on a preview version, run against a test
  site the owner controls.
- **Providers:** use a DataForSEO sandbox or a low-limit login for staging, never the production
  login with no cap.
- Preview URLs are for operators only; they are not customer-facing subdomains.

---

## 7. Release

1. Branch is green: lint, typecheck, tests.
2. Owner approves the release.
3. Snapshot production Neon (branch).
4. Apply migrations (CI does this on merge to `main`, or manually with `bun run db:migrate`).
5. Run the verification queries in `docs/DATABASE-MIGRATION-PLAN.md` section 5.
6. Deploy (merge to `main`, or `bun run deploy`).
7. Smoke test: `/`, `/dashboard`, `GET /api/mcp`, `GET /api/health`, one keyword research call
   on an internal org, Razorpay webhook test event, `/admin` cron card after the next hour.
8. Watch Workers logs and the credit ledger for unexpected spend for 24 hours.

## 8. Rollback

| Problem | Action |
|---|---|
| Bad Worker code | `wrangler rollback` to the previous version (or `wrangler versions deploy` of the previous version id). Migrations are additive, so the older code still works |
| Runaway provider spend | Remove or rotate `DATAFORSEO_PASSWORD` (paid features then report "not configured"); the balance cap already prevents negative balances |
| Bad migration objects | See rollback SQL in `docs/DATABASE-MIGRATION-PLAN.md` section 7 |
| Data damage | Restore from the pre-release Neon branch (last resort; loses writes after the snapshot) |
| Workflow stuck | Terminate the instance from the Cloudflare dashboard or `wrangler workflows instances terminate`; the job row is reconciled by the next cron run |
