# IndexFast — Agent Guide

> Single source of truth for AI agents and human contributors working in this repo.
> Read this end-to-end before making non-trivial changes. Update it whenever the
> architecture, commands, schema, or conventions change.

---

## 1. What this project is

**IndexFast** is an agent-ready SEO indexing operations platform. It helps
teams and AI agents find unindexed pages, diagnose technical blockers, push
URLs into safe search-engine discovery pipelines, and manage launch resources.
It is a server-rendered web app for end users, a REST/MCP backend for agents,
and a Cloudflare Worker cron job that runs automation in the background.

### High-level product surface

| Surface | Route | Purpose |
|---|---|---|
| Marketing site | `/`, `/about`, `/pricing`, `/contact`, `/privacy`, `/terms` | Public landing + blog + free tools + agent-first copy |
| Comparisons | `/compare`, `/compare/[slug]` | "IndexFast vs X" pages from `comparisons` in `marketing-data.ts` (dated, sourced, no competitor prices) |
| AI briefs | `/llms.txt`, `/llms-full.txt` | Route handlers built by `src/lib/llms.ts` from plans.ts and the content data (no static file in `public/`) |
| Free SEO tools | `/tools/*` (11 tools) | No-signup utilities — index checkers, sitemap extractor, IndexNow key generator, llms.txt generator, AI crawler checker, etc. |
| Resources | `/resources`, `/resources/directories`, `/resources/tools`, `/resources/skill`, `/resources/google-indexing-api`, `/resources/search-engines`, `/resources/search-engines/[engine]` (one guide per engine in `search-engines.ts`) | Free SEO resources, 100+ prioritized directories, third-party tools, downloadable SKILL.md, Google API guardrails, search engine API specs |
| Auth (Stack Auth) | `/handler/[...stack]`, `/login`, `/signup` | Sign-in / sign-up / account screens |
| Dashboard | `/dashboard`, `/dashboard/sites/[siteId]?view=overview\|urls\|queue\|sitemaps\|settings`, `/dashboard/connect`, `/dashboard/billing` | Protected app for vibe coders: add a site by domain, install one key file, everything else is automatic. See `docs/dashboard.md` |
| Admin | `/admin` | Verified `ADMIN_EMAILS` only (404 otherwise): revenue, MRR, users, traffic analytics, cron health, plan grants. See `docs/admin.md` |
| REST API | `/api/v1/*` | Bearer API-key interface for sites, verify, sitemaps, URLs, submissions, queue, diagnostics, engines (`bing`, `yandex`, `baidu`, `gsc`, `inspect`) and resources |
| Google OAuth | `/api/integrations/google/start`, `/api/integrations/google/callback` | Connects a user's Google account for Search Console inspection/sitemap submit and the gated Google Indexing API |
| MCP | `/api/mcp` | Authenticated JSON-RPC MCP server for AI IDEs (all plans). See `docs/mcp.md` |
| Billing | `/api/webhooks/razorpay` (+ server actions) | Razorpay prepaid 30-day plans. Only the legacy Dodo webhook (`/api/webhooks/dodo`) remains; the Dodo checkout and customer portal routes were removed. See `docs/billing.md` |
| Analytics | `/api/track` | Cookie-less first-party page view beacon feeding `/admin` |
| Automation cron | `worker.ts` → `runScheduledAutomation()` | Hourly: expire plans, sync due sitemaps, drain submission queue, Search Console inspections, prune usage/quota rows, log `cron_runs`. See `docs/automation.md` |

The platform uses IndexNow (Bing + others) on every plan. Paid plans add the Bing
Webmaster API, Yandex recrawl, Baidu push and Google Search Console (URL inspection,
sitemap submit; Free gets a small daily inspection allowance). Google's Indexing API is
gated to eligible JobPosting and livestream BroadcastEvent pages only. Engine clients live
in `src/lib/engines/` (IndexNow/Bing stay in `src/lib/automation/search-engines.ts`).

---

## 2. Tech stack (pin these mental models)

- **Runtime:** Cloudflare Workers (edge) — 128 MB memory, 10 ms CPU per request, Web Crypto only
- **Framework:** Next.js 16 App Router + React 19
- **Build/deploy:** OpenNext for Cloudflare (`opennextjs-cloudflare build && deploy`)
- **Package manager / scripts:** Bun
- **Type system:** TypeScript 5.7, strict mode, `@/*` → `./src/*` alias
- **Styles:** Tailwind CSS v4 with `@theme` (no `tailwind.config.ts`); every token in `src/app/globals.css`
- **Design system:** Cobalt. Rules in `DESIGN.md` (read it before any UI work); primitives in `src/components/ui` (import from `@/components/ui`)
- **Database:** Neon serverless PostgreSQL (HTTP driver at runtime, WebSocket driver for migrations) + Drizzle ORM
- **Auth:** Stack Auth (`@stackframe/stack`) — `StackProvider` wraps the app, `stack` singleton in `src/stack.ts`
- **Billing:** Razorpay Orders (prepaid). DodoPayments remains only as a legacy webhook
- **Tests:** Vitest (node environment), tests colocated in `__tests__/` folders
- **Linting:** ESLint flat config via `next/core-web-vitals` + `next/typescript`
- **Icons:** `lucide-react`
- **Cron:** `wrangler.jsonc` declares `0 * * * *` (hourly) — see `worker.ts`

---

## 3. Commands

```bash
# local
bun run dev                # next dev (OpenNext CF bindings auto-wired in next.config.ts)
bun run build              # prep .open-next stub + next build (do not run while `bun run dev` holds .next)
bun run lint               # ESLint flat config
bun run test               # Vitest, runs ./src/**/*.test.ts
bun run cf-typegen         # wrangler types → ./cloudflare-env.d.ts
bun run db:generate        # drizzle-kit generate (reads src/db/schema.ts)
bun run db:migrate         # bun run src/db/migrate.ts: applies ./drizzle/*.sql in one transaction
                           # (there is no db:push; always generate a migration)
bun run cron:dev           # wrangler dev --test-scheduled (run scheduled handler locally)

# deploy (Cloudflare)
bun run deploy             # opennextjs-cloudflare build && wrangler deploy
bun run upload             # build + upload source map (no deploy)
bun run preview            # build + wrangler preview
```

> **Reminder:** there is no `next start` in production — Next runs through
> OpenNext on the Worker (`worker.ts` re-exports `.open-next/worker.js`).

---

## 4. Repository layout

```
.
├── AGENTS.md                   # ← you are here
├── DESIGN.md                   # Cobalt design system rules (tokens, roles, primitives)
├── PRODUCT.md                  # product positioning and copy rules
├── README.md                   # user-facing project readme
├── plan.md / spec.md / todo.md # planning artifacts (do not edit casually)
├── docs/                       # extended agent context: billing, automation, mcp, dashboard, admin, deployment
├── package.json                # Bun + scripts
├── wrangler.jsonc              # Worker config: name, cron, assets, images, services
├── worker.ts                   # CF entrypoint: fetch + scheduled handler
├── open-next.config.ts         # OpenNext CF config (cache overrides)
├── next.config.ts              # Calls initOpenNextCloudflareForDev() for local bindings
├── drizzle.config.ts           # drizzle-kit config (reads DATABASE_URL)
├── drizzle/                    # generated SQL migrations
│   ├── 0000_useful_mathemanic.sql
│   ├── 0001_add_dashboard_indexes.sql
│   ├── 0002_add_automation_tables.sql
│   ├── 0003_cold_thundra.sql
│   ├── 0004_reverify_sites.sql
│   ├── 0005_razorpay_admin_analytics.sql
│   ├── 0006_short_raza.sql             # job priority, http_status, retry_after_at
│   ├── 0007_queue_health.sql           # submission_jobs.throttle_count + claim/prune indexes
│   └── 0008_engine_integrations.sql    # engine_quota_usage
├── scripts/requeue-throttled-jobs.ts  # one-off: requeue jobs failed by old 429 handling (dry run, then --apply)
├── cloudflare-env.d.ts         # generated by `bun run cf-typegen`
├── eslint.config.mjs           # flat config
├── postcss.config.mjs          # Tailwind v4 PostCSS plugin
├── vitest.config.ts            # node env, `@` alias
├── tsconfig.json               # ES2024, bundler resolution, strict
├── public/                     # static assets (favicon, og image, install.sh, skill file, etc.)
└── src/
    ├── stack.ts                # StackServerApp singleton
    ├── app/                    # App Router
    │   ├── layout.tsx          # root: fonts, StackProvider, JSON-LD (Org + SoftwareApplication), PageViewTracker
    │   ├── page.tsx            # marketing landing (composes Hero, Problem, Solution, ...)
    │   ├── actions.ts          # "use server" — all auth-gated mutating actions
    │   ├── globals.css         # Tailwind v4 + every Cobalt token (the only place colours/sizes are defined)
    │   ├── sitemap.ts          # MetadataRoute.Sitemap (static + tools + blog + resources)
    │   ├── robots.ts           # disallows /dashboard, /admin, /api/, /login, /signup, /handler/; names AI crawlers explicitly
    │   ├── about | contact | pricing | privacy | terms | login | signup /page.tsx
    │   ├── handler/[...stack]/page.tsx  # StackHandler mount point
    │   ├── blog/               # 11 long-form posts (data in lib/marketing-data.ts); _components/PostShell + PostFaq
    │   ├── compare/            # comparison hub + [slug] pages (data: comparisons in marketing-data.ts)
    │   ├── llms.txt/ llms-full.txt/  # route handlers -> src/lib/llms.ts
    │   ├── tools/              # 11 free tools (data in lib/marketing-data.ts; server actions in tool-actions.ts)
    │   ├── resources/          # directories, third-party tools, SKILL, Google API guardrails
    │   ├── api/
    │   │   ├── v1/             # REST API routes authenticated by hashed API keys
    │   │   ├── mcp/            # JSON-RPC MCP endpoint
    │   │   ├── integrations/google/  # OAuth start + callback
    │   │   ├── track/          # first-party page view beacon (admin analytics)
    │   │   └── webhooks/       # razorpay/ (active), dodo/ (legacy)
    │   ├── admin/              # layout.tsx (requireAdmin) + page.tsx (analytics, revenue, cron, grants)
    │   └── dashboard/
    │       ├── layout.tsx      # auth guard, ensureUserRow, AppShell + plan banner
    │       ├── page.tsx        # websites list / one-input onboarding
    │       ├── sites/[siteId]/page.tsx  # setup, stats, URLs, sitemaps, activity, settings
    │       ├── connect/page.tsx         # MCP + API keys
    │       ├── billing/page.tsx         # Razorpay plans, expiry, history
    │       ├── loading.tsx / error.tsx
    ├── components/
    │   ├── ui/                 # Cobalt primitives: Button, Field, Panel, Status/Badge, Table, Tabs,
    │   │                       # CodeBlock, Keycap, Container/Stack/Section, EmptyState, Stat, stack-theme
    │   ├── marketing/          # landing: Hero, Solution (#features), SearchEnginesShowcase, FAQ,
    │   │                       # HomePricing, FinalCTA (#cta), Footer, Navbar, landing/ (#agents); Pricing reads VISIBLE_PLANS
    │   ├── tools/              # ToolPage, ToolRunner, ToolResult, tool-leads
    │   └── app/                # dashboard/admin: ui.tsx (adapter over @/components/ui), client.tsx, toast,
    │                           # AppShell (data-scope="app"), AppNav, views/ (Home, Site, Connect, Billing, Admin)
    ├── db/
    │   ├── schema.ts           # Drizzle schema (see §6)
    │   ├── index.ts            # neon() + drizzle() HTTP client
    │   ├── migrate.ts          # `bun run db:migrate` (WebSocket driver, transactional)
    │   ├── app-queries.ts      # dashboard read queries (user scoped)
    │   └── admin-queries.ts    # admin aggregates (platform wide)
    └── lib/
        ├── url-utils.ts        # normalizeHost / normalizeSitemapUrl / normalizeUrlForHost / getErrorMessage / getSiteHost
        ├── marketing-data.ts   # tools[] + blogPosts[] + comparisons[] (data, no JSX)
        ├── seo.ts              # withPageSeo (canonical/OG per page), SoftwareApplication offers from plans.ts, articleJsonLd
        ├── llms.ts             # builds /llms.txt and /llms-full.txt
        ├── mcp/server.ts       # MCP method/tool/resource/prompt implementation
        ├── auth.ts             # session helpers, ensureUserRow, admin gate
        ├── platform/           # plans.ts (pricing + expiry policy), entitlements.ts, razorpay*.ts,
        │                       # api-keys, http, operations (REST/MCP), legacy billing.ts/dodo.ts
        ├── resources/          # 100+ submission directories + third-party SEO tool data
        ├── engines/            # Google OAuth + Search Console (gsc.ts), Google Indexing API service,
        │                       # Yandex, Baidu, extra-engine wiring, quota windows; __tests__/
        └── automation/
            ├── service.ts      # core engine: site settings, sitemap sync, IndexNow/Bing, queue runner
            ├── search-engines.ts  # IndexNow + Bing HTTP clients, key gen, payload builders
            ├── sitemaps.ts     # parseSitemapXml, fetchSitemapTree (BFS), discoverSitemapUrls
            ├── credentials.ts  # AES-GCM encrypt/decrypt, maskCredential
            ├── diagnostics.ts  # evaluateUrlDiagnostics (checks rows with checkType 'diagnostics')
            ├── constants.ts    # AUTOMATION_LIMITS, GOOGLE_LIMITS, ENGINE_BATCH_SIZE, ENGINE_LABELS, endpoints
            └── __tests__/      # vitest suites (see §12)
```

---

## 5. Cloudflare Worker entrypoint

`worker.ts` is the production entrypoint:

```ts
export default {
  fetch: handler.fetch,                  // re-exported from .open-next/worker.js
  async scheduled(controller, env, ctx) {
    // 1. copy every string binding (secrets included) → process.env
    // 2. if missing, throw (cron will not silently run)
    // 3. ctx.waitUntil(runScheduledAutomation())
  },
} satisfies ExportedHandler<CloudflareEnv>;
```

`runScheduledAutomation()` (`src/lib/automation/service.ts`) is the single
background entry point. It:

1. Downgrades users whose paid period ended more than 3 days ago (`downgradeExpiredPlans`).
2. Finds sitemap sources due under the owner's plan interval (Free 24h, paid 1h),
   skipping paused sites. Loads at most `maxDueSitesScanned` (1000) due sites and keeps
   syncing until the 6 minute `syncTimeBudgetMs` runs out.
3. Calls `processSubmissionQueue()` to drain up to 2000 jobs inside the 10 minute `cronTimeBudgetMs`.
4. Runs Search Console URL inspections (`runScheduledGscInspections`), bounded by
   `GOOGLE_LIMITS` (per-run count, per-property daily/minute quota, 2 minute budget, sites in random order).
5. Prunes `api_usage_events` older than 90 days and `engine_quota_usage` rows older than 3 days.
6. Records the run in `cron_runs` (shown in `/admin`); `summary` includes `sitesDue`, queue counts
   (`skippedCount`, `deferredCount`), `gscInspection`, `prunedUsageEvents`, `prunedQuotaRows`.
   A `running` row older than 20 minutes is closed as failed by the next run.

---

## 6. Database schema (Drizzle / Postgres)

Schema lives in `src/db/schema.ts`. All tables cascade on `sites.id` deletion.
User IDs are `text` (Stack Auth user IDs); site/row IDs are `uuid` defaulting
to `random()`.

| Table | Purpose | Notable columns |
|---|---|---|
| `users` | Mirrors Stack Auth profile | `id` (PK, Stack user id), `email`, `billingTier` (`free`/`pro`/`unlimited`, hidden legacy `indie`/`growth`/`agency`/`scale`), `planExpiresAt` (end of prepaid period; null on a paid tier = legacy Dodo), `lastSeenAt` |
| `payments` | Razorpay order ledger | `orderId` (unique), `paymentId`, `plan`, `amount` (minor units), `currency`, `status` (`created`/`paid`/`failed`/`refunded`), `periodStart`, `periodEnd` |
| `page_views` | First-party analytics | `path`, `referrer` (host), `country`, `device`, `visitorHash` (daily rotating) |
| `cron_runs` | Cron heartbeat | `status`, `summary` (jsonb), `errorMessage`, `startedAt`, `finishedAt` |
| `sites` | Connected web properties | `domain`, `indexingHost` (preserves `www`), `verified`, `automationEnabled`, `verificationToken`, `sitemapUrl` (primary), unique `(userId, domain)` |
| `site_sitemaps` | Configured sitemap sources per site | `url`, `isPrimary`, `status` (`active`/`disabled`/`failed`), `lastSyncAt`, `lastErrorAt`, `lastErrorMessage`, unique `(siteId, url)` |
| `site_integrations` | Per-site provider integrations | `provider` (`indexnow`, `bing` (per-site auto-submit), `gsc` (matched property), `google_indexing_api`, `yandex` (host id), `baidu` (encrypted token)), `status` (`pending`/`verified`/`failed`/`disabled`), `encryptedSecret`, `publicConfig` (jsonb: host, keyLocation, submitNewUrls, submitChangedUrls), `automationEnabled` |
| `user_integrations` | Per-user provider credentials | `provider` (`bing`, `google` (OAuth refresh token), `yandex` (OAuth token)), `encryptedSecret`, `publicConfig` (lastValidationStatus, siteUrl) |
| `sitemaps` | Sync history log (per source sync) | `status` (`pending`/`syncing`/`success`/`failed`), `lastSyncTime`, `errorMessage`, `urlCount`, `newCount`, `changedCount` |
| `urls` | Discovered / submitted URLs | `loc`, `priority`, `lastmod`, `changefreq`, `indexingStatus` (`indexed`/`not_indexed`/`unknown`/`blockers`), `gscStatus`, `httpStatus`, `lastCheckedAt`, `lastSeenInSitemapAt`, `lastSubmittedAt`, `lastSubmissionStatus`, `lastSubmittedEngine`, unique `(siteId, loc)` |
| `checks` | Diagnostic results | `checkType` (`diagnostics` from `evaluateUrlDiagnostics`, `gsc_inspection` from Search Console), `status` (`pass`/`warn`/`fail`), `details` (jsonb) |
| `submission_jobs` | Submission queue | `urlId?`, `loc`, `engine` (`indexnow`/`bing`/`google_indexing_api`/`yandex`/`baidu`), `reason` (`new`/`changed`/`manual`), `status` (`queued`/`processing`/`success`/`failed`/`skipped` = engine off, not on plan or refused by the Google guardrail; never sent), `priority`, `attempts`, `throttleCount`, `httpStatus`, `retryAfterAt`, `nextRunAt`, `lockedAt`, `lastErrorMessage` |
| `submissions` | Submission log | `engine` (`indexnow`/`google_indexing_api`/`bing`/`yandex`/`baidu`), `status` (`submitted`/`success`/`failed`), `responseMessage`, `attempt` |
| `alerts` | Operator alerts | `alertType` (`indexing_drop`/`error_detected`/`sitemap_failure`), `resolved` |
| `api_keys` | Hashed IndexFast API keys | `keyPrefix`, `keyHash`, `scopes`, `status`, `lastUsedAt`, `expiresAt`, unique `keyHash` |
| `api_usage_events` | API/MCP usage log | `apiKeyId`, `userId`, `method`, `route`, `statusCode`, `metadata` |
| `billing_customers` | Dodo customer mapping | `userId`, `dodoCustomerId`, `email` |
| `subscriptions` | Dodo subscription state | `dodoSubscriptionId`, `dodoProductId`, `plan`, `status`, current period, cancel flag |
| `engine_quota_usage` | Counters for quotas engines do not report (GSC inspection per property, Google Indexing API per project) | `quotaKey`, `window` (day or UTC minute), `used`; unique `(quotaKey, window)`; atomic reserve |
| `billing_events` | Webhook audit log (Dodo and `razorpay.*`) | `eventId`, `eventType`, `payload`, `processedAt` |
| `google_integrations` | Unused (service-account era); Google now uses `user_integrations` provider `google`. Can be dropped in a later migration | |

Indexes worth knowing: partial unique `submission_jobs_open_unique_idx`
`(siteId, loc, engine) WHERE status IN ('queued','processing')` (queue dedup),
unique `(siteId, loc)` on `urls` (URL dedup), unique `orderId` on `payments`,
`(siteId, indexingStatus)` on `urls`, `(siteId, status)` on `submission_jobs`,
`(status, nextRunAt)` on `submission_jobs`, `(siteId, resolved, createdAt)` on
`alerts`, unique `(userId, domain)` on `sites`.

Read-side queries: `src/db/app-queries.ts` (dashboard: `getDashboardHome`,
`getSitePage`, `getConnectPage`; always filtered by `userId`) and
`src/db/admin-queries.ts` (`getAdminOverview`; platform-wide, admin only).
Both use parallel `Promise.all` to keep page latency low.

---

## 7. API, MCP, CLI, resources, and billing

- API keys are created in `/dashboard/connect`. Plaintext is shown once;
  the database stores only SHA-256 hashes plus a short prefix.
- API scopes live in `src/lib/platform/plans.ts`: `sites:read`, `sites:write`,
  `submissions:write`, `diagnostics:write`, `resources:read`, `billing:read`, `mcp:use`.
- `/api/v1/*` routes use `withApiAuth()` (`src/lib/platform/http.ts`) and shared
  operations in `src/lib/platform/operations.ts`. Any `:siteId` accepts a domain too.
- Every authenticated call checks the user's *current* entitlement and monthly quota
  (`authenticateApiRequest`). Quota errors return 429.
- `/api/mcp` needs `mcp:use` and works on every plan; only `tools/call` counts toward
  quota. Notifications return 202. Details: `docs/mcp.md`.
- Plans (single source of truth `src/lib/platform/plans.ts`): Free, Pro $19, Unlimited $99,
  each paid plan a prepaid 30-day period. Legacy tiers are hidden, never removed.
- Payments: Razorpay only in the UI (`docs/billing.md`). Only the Dodo webhook stays for
  legacy subscribers; the Dodo checkout and customer portal routes were removed.
- MCP tools include engine management: `list_engines`, `get_google_connection`, `inspect_url`,
  `submit_sitemap_to_gsc`, `set_yandex_token`, `set_baidu_token`, `set_engine_auto_submit`,
  `remove_engine`, plus the Bing tools. `remove_bing_api_key` deletes the user's key (all sites).
- Expiry policy: active -> 3-day grace -> Free limits, extra sites paused, nothing
  deleted. Enforced at read time (`resolveEntitlement`) and by the cron.
- The downloadable agent skill is served from `/resources/skill` and
  `public/resources/skill/SKILL.md` (keep its tool list in sync with `server.ts`).
- `public/install.sh` / `cli/` is the CLI; it uses the REST API, keep responses
  backward compatible (`POST /api/v1/sites` still returns `site`).

---

## 8. Automation pipeline

Full detail in `docs/automation.md`. Summary:

- `createSiteForUser` (domain only) -> plan site limit check -> IndexNow key ->
  sitemap discovery (robots.txt first, parallel probes) -> first sync.
- `verifySiteForUser` fetches `https://<host>/<key>.txt`. A match **is** ownership
  verification: sets `verified`, `automationEnabled`, and submits the backlog.
  There is no separate manual "mark verified" step any more.
- URL dedup: `canonicalizeUrl()` + unique `(siteId, loc)`. Queue dedup: partial unique
  index + `ON CONFLICT DO NOTHING`. Changed URLs (lastmod moved) are not resubmitted
  within 24h.
- Queue: stale lock recovery (15 min), atomic claim ordered by priority (manual 1, new 5, refresh 10) then nextRunAt,
  IndexNow batches of 1000 / Bing 100. A 429 / ThrottleIP parks every queued job of that (site, engine) and the
  cooldown is persisted (checked by `getActiveThrottle` before each send); rate limits never fail a job, backoff
  1h doubling to 24h. Network/5xx errors get 3 attempts (5 min base). Exponential backoff with +/-20% jitter,
  Retry-After parsing, de-duplicated alerts.
- Request-driven queue runs (dashboard "Process now", MCP, API) stop after 25 s
  (`inlineQueueTimeBudgetMs`). A Baidu test send no longer parks the rest of the backlog until midnight.
- Optional engines (Bing API, Yandex, Baidu, Google Indexing API) need a paid plan and are opt-in
  per site; Free/expired plans or paused sites make the setters throw (actions turn that into
  `ActionResult`). Google Indexing API jobs that fail the JobPosting/livestream guardrail become `skipped`.
- Sync bulk-upserts in chunks of 500; never loop one query per URL.
- Runtime bounds: `src/lib/automation/constants.ts`. Plan limits: `plans.ts`.

---

## 9. Authentication & authorization

- Stack Auth is the source of truth for user identity.
- `src/stack.ts` exports a `StackServerApp` with `tokenStore: "nextjs-cookie"`
  and routes sign-in/sign-up/afterSignIn to the dashboard.
- `src/app/layout.tsx` wraps the app in `<StackProvider>` / `<StackTheme>`.
- `src/app/handler/[...stack]/page.tsx` renders `<StackHandler>` for the
  full Stack auth UI (`/handler/sign-in`, `/handler/sign-up`, account
  settings, etc.).
- `src/lib/auth.ts` is the only session helper: `requireSessionUser()` (pages),
  `requireActionUser()` (actions), `ensureUserRow()` (mirror row + throttled
  `lastSeenAt`), `isAdmin()` / `requireAdmin()`.
- Admin = verified primary email in `ADMIN_EMAILS`. The verified check is required:
  an unverified signup with the admin's address must never get in. Non-admins get 404.
- `middleware.ts` redirects signed-out users away from `/dashboard/*` and `/admin/*`.
- Server Actions in `src/app/actions.ts` authenticate first, then
  delegate to `lib/automation/service.ts` functions that take an explicit
  `userId` and re-validate ownership before any write (see
  `getSiteForUser`, `getSiteSettings`).
- After every successful action, `revalidatePath` is called for the affected
  dashboard routes — never edit the cache manually.
- Server actions return `ActionResult` (`{ ok, message | error, data? }`) rather than
  throwing, because Next hides thrown messages in production.
- API/MCP access never uses Stack Auth cookies. It uses hashed IndexFast API
  keys with Bearer auth and explicit scopes.

---

## 10. Environment variables

**Local `.env` (consumed by Next + Drizzle):**
```
DATABASE_URL=                       # Neon Postgres connection string
NEXT_PUBLIC_STACK_PROJECT_ID=       # Stack Auth project id (public)
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=
STACK_SECRET_SERVER_KEY=            # Stack Auth server key (secret)
DODO_PAYMENTS_API_KEY=              # Dodo bearer token
DODO_PAYMENTS_WEBHOOK_KEY=          # Dodo webhook signing key
DODO_PAYMENTS_RETURN_URL=           # e.g. https://indexfast.co/dashboard
DODO_PAYMENTS_ENVIRONMENT=          # test_mode or live_mode
DODO_PRODUCT_ID_INDIE=
DODO_PRODUCT_ID_GROWTH=
DODO_PRODUCT_ID_AGENCY=
DODO_PRODUCT_ID_SCALE=
RAZORPAY_KEY_ID=                    # Razorpay (the only checkout shown in the UI)
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=            # webhook: https://indexfast.co/api/webhooks/razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_CURRENCY=                  # optional, default USD
ADMIN_EMAILS=sh20raj@gmail.com      # comma separated, must be verified in Stack Auth
CREDENTIAL_ENCRYPTION_KEY=          # optional, falls back to STACK_SECRET_SERVER_KEY
NEXT_PUBLIC_SITE_URL=https://indexfast.co
GOOGLE_CLIENT_ID=                   # Google OAuth "Web application" client
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=                # optional; default <NEXT_PUBLIC_SITE_URL>/api/integrations/google/callback
```

Google setup: register the callback URL (and the localhost one for dev) as an authorized
redirect URI, enable the Search Console API and the Web Search Indexing API. The webmasters and
indexing scopes are sensitive, so until Google verifies the app only listed test users can connect.

All runtime secrets are also set with `wrangler secret put` and mirrored with
`gh secret set`. See `docs/deployment.md`.

**Cloudflare `.dev.vars` (wrangler dev / cron:dev only):**
```
NEXTJS_ENV=development              # OpenNext then loads .env + .env.development
DATABASE_URL=                       # scheduled handler reads it from bindings
```

`.env.development` / `.env.production` hold only the Dodo test vs live keys.
`.env` also holds `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` (wrangler deploy
credentials, account must match `wrangler.jsonc` `account_id`) and `R2_*`.
Production Worker secrets are set with `wrangler secret put` (see `docs/deployment.md`).

> Credentials (IndexNow keys, Bing API keys, Google refresh tokens, Yandex and Baidu tokens) are stored AES-GCM encrypted
> (`enc:v1:` prefix, `credentials.ts`). The key derives from
> `CREDENTIAL_ENCRYPTION_KEY`, falling back to `STACK_SECRET_SERVER_KEY`.
> Rotating either secret makes existing credentials unreadable. Legacy plaintext
> rows are re-encrypted lazily on read (`upgradeLegacySecret` in `service.ts`).

**`wrangler.jsonc`** sets:
- `compatibility_date: "2026-06-01"`, `nodejs_compat`,
  `global_fetch_strictly_public`
- `assets.directory: ".open-next/assets"` (build output)
- `triggers.crons: ["0 * * * *"]` (hourly)
- `images.binding: "IMAGES"`
- `services` self-reference for cache
- `observability.enabled: true`, `upload_source_maps: true`

---

## 11. Conventions & gotchas

### Coding style
- **Use Cobalt tokens through Tailwind utilities** (`bg-background`, `bg-panel`, `text-ink`,
  `text-muted`, `border-rule`, `rounded-card`, `font-display`) and primitives from
  `@/components/ui`. No literal colours or hex in `className`. `DESIGN.md` is the rule book;
  `src/app/globals.css` holds every token. The retired brutalist utilities (`label-mono`,
  `display`, `stat`, `text-highlight`, `bg-grid`, `--app-*`, `--chart-*`) are deleted; do not re-add them.
- **Server Actions** go in `src/app/actions.ts`; never call Drizzle directly
  from a client component.
- **No raw SQL** in app code. Drizzle query builder only (Drizzle `sql` templates for
  aggregates such as `cast(count(...) as int)` are fine).
- **Always validate `userId` ownership** before reading/writing `sites`,
  `urls`, etc. Use the `*ForUser` helpers in `service.ts`.
- **Always `revalidatePath`** the affected dashboard routes after a write.
- **API keys are hashed.** Never persist plaintext IndexFast API keys. Third-party
  credentials go through `encryptSecret()`; never write them unencrypted.
- **MCP tools share service logic.** Do not create parallel business logic in
  `src/lib/mcp/server.ts`; delegate to `src/lib/platform/operations.ts` or
  automation services.
- **No emojis** in code or docs unless the user explicitly asks.
- **Intent comments are required.** Every module starts with a short block comment saying
  *why it exists* and what rules it enforces; non-obvious logic (dedup, idempotency,
  expiry, security checks, limits) gets a comment explaining the reason, not the mechanics.
  Do not narrate obvious code.
- **Docs move with code.** `docs/*.md` is the extended context for agents
  (`billing`, `automation`, `mcp`, `dashboard`, `admin`, `deployment`). Any change to
  plans, billing, the pipeline, MCP tools, routes, env vars or schema must update the
  matching doc and this file in the same change.
- **Pricing lives in one place.** Read plans/limits from `src/lib/platform/plans.ts`;
  never hardcode prices or limits in components.
- **Payments are idempotent.** Activation must go through `activatePaidOrder()`; never
  update `users.billingTier` for a payment anywhere else.

### Domain rules
- **`indexingHost` is authoritative** for the host IndexNow/Bing see. It
  defaults to `domain` but can preserve `www`. Always use `getSiteHost(site)`
  (`site.indexingHost || site.domain`) when building external URLs.
- **Sitemap and submitted URLs must match `indexingHost` exactly.** The
  normalizers in `lib/url-utils.ts` enforce this; respect it in new code.
- **Secrets in DB** are encrypted (see the note in §10).
- **Domain proof gates submission.** Nothing is ever submitted for a site with
  `verified = false`. Verification = the IndexNow key file at the site root, fetched
  without redirecting to another URL. Migration `0004_reverify_sites` reset all
  earlier verified flags because the old button never checked anything.
  Sites already hosting an IndexNow key can reuse it (`adoptExistingIndexNowKeyForUser`).
- **Serverless HTTP DB.** Drizzle uses `@neondatabase/serverless` over HTTP.
  Each query is a fetch — prefer `Promise.all` for parallel reads (as
  `app-queries.ts` does).
- **OpenNext dev bindings** are enabled via `initOpenNextCloudflareForDev()`
  in `next.config.ts`. Without it, `getCloudflareContext()` will throw in
  `next dev`.

### Cloudflare runtime
- ~128 MB memory, ~10 ms CPU per request budget on HTTP. The cron handler
  is allowed more time but still bounded.
- `crypto.subtle` is available; `Buffer` is available via Node compat.
- No OpenNext incremental cache is configured, so never set `dynamicParams = false` on a dynamic
  route: prerendered params are not served from the Worker and every page 404s. Validate the
  param and call `notFound()` instead (see `src/app/compare/[slug]/page.tsx`).
- `process.env` is empty inside the scheduled handler — `worker.ts` copies every string
  binding from `env` into `process.env` before calling `runScheduledAutomation`, and throws
  if `DATABASE_URL` is missing.
- `GET /api/health` returns 503 when the database is unreachable or no cron run has succeeded
  in 2 hours; the daily smoke test (`scripts/smoke-test.sh`) checks it.
- `next.config.ts` `headers()` sets HSTS, `X-Frame-Options: DENY` / `frame-ancestors 'none'`,
  nosniff, Referrer-Policy and Permissions-Policy on every route. No full CSP yet (it must
  allow Razorpay Checkout and Stack Auth).

### Tailwind v4 specifics
- Use `@import "tailwindcss";` and `@custom-variant dark (&:where(.dark, .dark *));`
  at the top of `globals.css`.
- Define theme tokens inside `@theme static { ... }` / `@theme inline { ... }`, **not** a config file.
- `data-scope="app"` on the app shell root (`AppShell.tsx`) switches to the fixed 1.2 app type
  scale and gutter; wrap app content in `<Container width="app">`.
- To switch themes we toggle the `dark` class on `<html>` from a tiny
  inline script in `<head>` (no FOUC) plus a `ThemeToggle` component.

### React 19 / Next 16 specifics
- Route segment params and searchParams are **promises** in Next 15+:
  `params: Promise<{ siteId: string }>` and must be awaited.
- Use Server Actions bound via `.bind(null, ...)` for per-row forms (see
  `dashboard/sites/[siteId]/page.tsx`).
- `redirect()` from `next/navigation` is the way to bounce unauthenticated
  users — `notFound()` for missing rows.

---

## 12. Tests

`vitest` with `node` environment and the `@` alias mirrored from `tsconfig`.

Suites live in `__tests__/` next to the code (30 files). Highlights:
- `lib/automation/__tests__/` — credentials, sitemaps + sitemap-tree, url-utils, search-engines,
  submission-queue, requeue, bing-automation, diagnostics
- `lib/engines/__tests__/` — engines (eligibility/wiring), google-oauth, gsc, yandex-baidu
- `lib/platform/__tests__/` — plans (expiry/grace/legacy, paused sites), razorpay + razorpay-billing,
  billing (Dodo), api-key-utils, auth, http, google-indexing guardrail
- `lib/mcp/__tests__/mcp.test.ts` — protocol negotiation, notifications, tool listing/errors
- `lib/resources/__tests__/` — directory catalog and search-engine specs
- `app/tools/__tests__/` — tool-actions (free tool server actions, `ToolResult` shape), robots-rules
- `app/admin/__tests__/admin-queries.test.ts`, `app/blog/__tests__/content-index.test.ts`,
  `app/dashboard/sites/[siteId]/__tests__/params.test.ts`, `components/app/views/site/__tests__/google-tone.test.ts`

Add new tests next to the file under test. Keep them focused on
pure functions; the DB/Worker code is exercised by hand via `bun run dev`
and `bun run cron:dev`.

---

## 13. Marketing data & SEO

- `src/lib/marketing-data.ts` is the single source of truth for `tools[]`
  (11 entries), `blogPosts[]` (11 entries) and `comparisons[]` (5 entries). Update there and the
  `/tools`, `/blog`, and `/sitemap.xml` pages update automatically.
- `src/app/sitemap.ts` enumerates static routes, tool routes, blog routes, resources routes,
  comparison routes and per-engine guides. `src/app/robots.ts` disallows `/dashboard`, `/admin`,
  `/api/`, `/login`, `/signup`, `/handler/`, and repeats that for a named group of AI crawlers
  (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, ...) so they are explicitly allowed elsewhere.
  Cloudflare's managed robots.txt (AI Crawl Control) prepends a block list at the edge; keep it off.
- Every public page builds its metadata with `withPageSeo(path, {...})` (`src/lib/seo.ts`): self
  canonical, og:url/title/image, Twitter card, `article` type for posts. The root layout sets no
  canonical on purpose (it would leak to every child). Titles are bare; the template adds "| IndexFast".
- FAQPage JSON-LD only where the FAQ is visible: blog posts use `PostFaq`, tool pages render their
  `faqJsonLd` items as `GuideTopic` rows, comparison pages render `faqs`.
- `src/lib/resources/directories.ts` stores the 100+ prioritized directory
  catalog. Do not auto-submit to third-party directories unless an official
  API supports it; provide deep links, checklists, and tracking instead.
- `src/lib/resources/tools.ts` stores curated third-party SEO tools.
- The root layout emits `Organization` and `SoftwareApplication` JSON-LD. `FAQPage`
  is emitted only on `/`, generated from the exported `faqs` array in
  `components/marketing/FAQ.tsx` so markup always matches the visible FAQ. Keep the FAQ claims honest —
  the platform explicitly does **not** guarantee Google indexing and uses
  Google's Indexing API only for eligible JobPosting/livestream pages.
- Design: Cobalt (see `DESIGN.md`). Cool paper, hairline rules, Familjen Grotesk heads over IBM
  Plex Sans, code on graphite, keycap buttons, one cobalt accent. Build from `@/components/ui`.
  The brutalist acid-lime look (`#ccff00`, Geist, zero radius, uppercase tracked labels) is
  retired; never bring it back. Sentence case for labels and headings.
- Landing sections: Hero, Solution (`#features`), SearchEnginesShowcase, `#agents` (MCP, CLI,
  REST, SKILL.md snippets), HomePricing (`#pricing`), FAQ, FinalCTA (`#cta`,
  `components/marketing/FinalCTA.tsx`, re-exported from Footer.tsx and also used on /pricing and /about).
- Engine claims on the landing page and in `plans.ts` features (Bing API, Yandex, Baidu, Google
  Indexing API on paid plans; Search Console inspection once connected) must match the code in
  `src/lib/engines` and `service.ts`. Trim the copy if any of that wiring is removed.

---

## 14. Operational playbook

| Scenario | Where to look / what to do |
|---|---|
| A new site is failing to sync | Check `site_sitemaps.lastErrorMessage` and `alerts` (filter `alertType='sitemap_failure'`). Common causes: 4xx on sitemap URL, host mismatch, malformed XML. |
| IndexNow submissions are failing | Confirm the key file is reachable at `publicConfig.keyLocation` and the body matches `key`. Re-run "Verify IndexNow key" on the settings page. |
| Bing API key is invalid | `user_integrations.lastErrorMessage` after a failed save; the action wraps `InvalidParameter` into a clearer message. |
| API key stopped working | Check `/dashboard/api-keys`, `api_keys.status`, scope list, expiry, and billing plan gates. Plaintext cannot be recovered; create a new key. |
| MCP request is rejected | Confirm Bearer auth, `mcp:use` scope, and monthly quota (429). Inspect `src/lib/mcp/server.ts` for exact tool names. |
| Paid but plan not active | Look up `payments` by order id. `created` = no webhook/verify yet (check Razorpay webhook deliveries, `RAZORPAY_WEBHOOK_SECRET`); `billing_events` with `razorpay.*` shows what arrived. Fix by hand with "Grant a plan" in `/admin`. |
| User says sites stopped syncing | Likely expired past grace -> Free -> extra sites paused. Check `users.plan_expires_at`. |
| Dodo webhook did not update billing (legacy) | Check `billing_events` for the event ID and `DODO_PAYMENTS_WEBHOOK_KEY`. |
| Google Indexing API page rejected | Confirm JSON-LD contains `JobPosting` or `BroadcastEvent` inside `VideoObject`; otherwise use sitemap/GSC workflows. |
| Hourly cron is silent | Check the Cron card in `/admin` (`cron_runs`). Confirm `wrangler.jsonc` cron is still `0 * * * *`, `DATABASE_URL` is set as a Worker secret, and `worker.ts.scheduled` is not throwing. The throw is intentional — failed binding surfaces immediately. |
| Local dev can't reach DB | Ensure `DATABASE_URL` is in `.env`. The DB module throws on import if it's missing. |
| Want to add a new submission engine | Add a client in `src/lib/engines/`, a provider string for `site_integrations` / `user_integrations`, `ENGINE_BATCH_SIZE` + `ENGINE_LABELS` in `constants.ts`, an `ENGINE_CATALOG` row in `db/admin-queries.ts`, wire it in `extra-engines.ts` (`resolveExtraEngines`) and the queue sender in `service.ts`, and gate it on a `PlanLimits` flag. |
| Google connection fails | Check `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, that the redirect URI matches exactly, the APIs are enabled, and (before app verification) that the user is a listed test user. |
| GSC inspections stop | `cron_runs.summary.gscInspection.quotaStops` / `errors[]`; per-property counters in `engine_quota_usage`. |
| Want to add a new diagnostic check | Insert a row in `checks` with the desired `checkType`, set `urls.indexingStatus` accordingly, and consider whether to add an alert dedupe key (see `evaluateUrlDiagnostics` in `diagnostics.ts` and `runDiagnosticsForUser` in `operations.ts`). |
| Want to add a new free tool | Add a `ToolDefinition` to `tools` in `lib/marketing-data.ts` and create `src/app/tools/<slug>/page.tsx`. The index/listing/sitemap pick it up automatically. |
| Want to add a new blog post | Add a `BlogPost` to `blogPosts` in `lib/marketing-data.ts` and create `src/app/blog/<slug>/page.tsx`. |

---

## 15. Things explicitly out of scope

- **Full Search Console data ingestion** (performance reports, coverage exports). Only URL
  inspection and sitemap submit are wired. Live SERP-based checks (the free tools) are separate.
- **Backlink / off-page data** — not in product.
- **Black-hat / grey-hat techniques** — explicitly disavowed in the FAQ.
- **General-purpose Google Indexing API submissions** — not allowed. Google
  Indexing API remains gated to eligible JobPosting and livestream pages.
- **Silent third-party directory automation** — not allowed unless an official
  API explicitly supports submission.

---

## 16. Glossary

- **IndexNow** — protocol at `https://api.indexnow.org/indexnow`. POST a
  JSON `{ host, key, keyLocation, urlList }`. Verifying ownership requires
  hosting `{key}.txt` at the site root containing the key.
- **Bing Webmaster API** — `https://ssl.bing.com/webmaster/api.svc/json`.
  `GetUrlSubmissionQuota` to validate a key + `SubmitUrlBatch` to submit.
- **Verification** — hosting the IndexNow key file at `https://<host>/<key>.txt`.
  The legacy `verificationToken` column is still generated but unused.
- **`indexingHost`** — the exact host used for IndexNow (preserves `www`).
  Defaults to `domain`.
- **`lastSyncAt`** — last time a sitemap source was crawled. Cron picks
  sources with `lastSyncAt IS NULL OR lastSyncAt < now - 1h`.
- **MCP** — Model Context Protocol endpoint at `/api/mcp`, authenticated by
  IndexFast API keys, available on every plan.
- **Grace period** — 3 days after `planExpiresAt` with full paid access before Free.
- **Paused site** — a site beyond the plan's site limit (newest first); kept but not synced.
- **IndexFast API key** — plaintext starts with `idxf_`, shown once, stored as
  SHA-256 hash in `api_keys`.
- **Razorpay** — the billing provider shown to users (prepaid Orders).
- **DodoPayments** — legacy billing provider; only its webhook remains, for existing subscribers.
- **Cobalt** — the design system (`DESIGN.md`, tokens in `globals.css`, primitives in `src/components/ui`).
- **Google Indexing API guardrail** — helper that only allows JobPosting or
  livestream BroadcastEvent-in-VideoObject pages to be queued.

---

*Last reviewed 2026-11-01 after the Cobalt redesign, the Google/Yandex/Baidu engines, queue health
work and removal of the Dodo checkout/portal routes. Keep this file and docs/ in sync with schema and pipeline changes.*
