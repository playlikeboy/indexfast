# SEO platform architecture

Purpose: this document records how IndexFast grows from an indexing tool into an SEO platform
(keyword research, rank tracking, domain and backlink intelligence, site audit, AI visibility,
Google reports) without splitting into two products. It states the chosen foundation, the module
layout, how tenancy is enforced, how long jobs run, and how the dashboard, MCP, REST and CLI share
one code path. Source analysis is in `docs/OPENSEO-INTEGRATION-AUDIT.md`; data model in
`docs/DATABASE-MIGRATION-PLAN.md`; runtime topology in `docs/DEPLOYMENT-ARCHITECTURE.md`.

---

## 1. Options considered

- **A. IndexFast foundation.** Keep the Next.js 16 + OpenNext Worker. Port OpenSEO's pure logic
  (DataForSEO fetchers and envelope, crawler page analyzer, issue checks, discovery, URL policy,
  keyword/domain/backlinks/rank/AI-visibility services, Postgres Drizzle tables, GSC/GA4 clients)
  and rebuild the UI in Cobalt.
- **B. OpenSEO foundation.** Fork OpenSEO and move IndexFast's indexing, users, billing and
  sites into it.
- **C. Hybrid.** Run OpenSEO as an internal service next to IndexFast and call it from the
  IndexFast app.

### 1.1 Scores

Scale 1 (poor) to 5 (good) for IndexFast's situation. Equal weights.

| Criterion | A: IndexFast foundation | B: OpenSEO foundation | C: Hybrid service |
|---|---|---|---|
| Implementation complexity | 3. Port logic, rewire to server actions and MCP | 2. Migrate users, billing, auth, sites, indexing engines and MCP contracts into another framework | 2. Two apps plus a service contract and data sync |
| Development time | 3. Feature by feature, shippable per phase | 2. Large up-front migration before any new value ships | 3. Fast first demo, slow to make coherent |
| Feature completeness | 4. Reaches parity phase by phase; indexing already ahead | 5. SEO features day one; indexing must be rebuilt | 4. Both feature sets, inconsistent UX |
| Code reuse | 4. Pure logic copied with MIT header; UI rebuilt | 4. Most OpenSEO code reused; IndexFast code rewritten | 5. Both reused as is |
| Performance | 4. One Worker, one DB, no internal hops | 4. Comparable | 2. Extra network hop and duplicated reads |
| Scalability | 4. Workflows for long jobs; Neon scales | 4. Comparable | 3. Two systems to scale and keep in step |
| Auth | 5. Stack Auth unchanged; existing sessions keep working | 1. Every user moves to Better Auth | 1. Two auth systems to reconcile |
| Multi-tenancy | 4. New `organizations` model, personal org per user | 4. Better Auth orgs exist, but IndexFast data needs remapping | 2. Two tenant models to map |
| DB consistency | 5. One Neon Postgres, one Drizzle schema | 3. Postgres plus legacy dual D1 schema tree | 1. Two databases |
| Cloudflare compatibility | 5. Already deployed | 4. Native, but needs new resources and beta tooling | 4. Both native |
| Maintenance | 4. Stable deps; no beta pins added | 2. `effect` 4 beta, `alchemy` 2 beta, vite plugin beta sha, two MCP SDK generations | 1. Two codebases, two dependency trees |
| Deployment reliability | 5. Existing pipeline, single Worker | 3. New pipeline, two Workers | 2. Two deploys that must stay compatible |
| **Total (of 60)** | **50** | **38** | **30** |

### 1.2 Decision

**Architecture A is chosen.** Reasons:

1. It keeps existing Stack Auth users, Razorpay billing history, Neon data, verified sites, and
   the published MCP, REST and CLI contracts (`POST /api/v1/sites` still returns `site`).
2. It keeps the Cobalt UI and one design system.
3. OpenSEO is TanStack Start + Better Auth + Autumn/Stripe with many pre-release dependencies and
   a dual D1/Postgres schema. Porting its logic is cheaper than migrating our users, billing and
   auth into it.
4. C is rejected because it means two auth systems and two databases to reconcile, which is the
   most likely place for tenant leaks and billing drift.

---

## 2. Module layout

New code follows the existing rule: business logic in `src/lib`, server actions in
`src/app/actions.ts` (or per-feature action files), read queries in `src/db/*-queries.ts`,
MCP and REST as thin adapters.

```
src/lib/
  org/                     # organizations, members, personal-org ensure, role checks
    service.ts             # ensurePersonalOrg, getOrgForUser, requireOrgRole
  credits/                 # one credit ledger for every paid provider call
    ledger.ts              # grant, reserve, settle, release, purchase; balance math
    pricing.ts             # estimate -> credits; ceil(providerCostUsd * 1.3 * 1000)
    monthly.ts             # calendar-month reset to the plan grant
  providers/
    dataforseo/            # ported from OpenSEO server/lib/dataforseo (MIT header)
      core.ts              # fetch, Basic auth, timeout, retries on 5xx, error classes
      envelope.ts          # DataForSEO response envelope parse + cost extraction
      labs.ts, keyword-metrics.ts, serp.ts, backlinks.ts, ai.ts, ...
      client.ts            # metered client: cache -> reserve -> call -> settle/release
    cache.ts               # provider_cache read/write (sha256 key, TTL)
    credentials.ts         # BYOK lookup; decrypt via src/lib/automation/credentials.ts
  seo/
    keywords/              # research, save, list, remove (this branch)
    rank-tracking/         # Phase 3
    domain/                # Phase 3
    backlinks/             # Phase 4
    audit/                 # Phase 5: analyzer, checks, discovery, url-policy, score
    ai-visibility/         # Phase 5/6
    google-reports/        # Phase 6: GSC search analytics, GA4, opportunities
  automation/, engines/, platform/, mcp/   # existing indexing code, unchanged in shape
```

Rules:

- Ported files start with an intent comment and the MIT notice naming the source (for example
  "Adapted from OpenSEO, Copyright (c) 2026 Ben Senescu, MIT"). The full list lives in
  `THIRD_PARTY_NOTICES.md` at the repo root.
- `cloudflare:workers` imports in ported code are replaced with `process.env` or
  `getCloudflareContext()`.
- Every outbound paid call goes through `providers/dataforseo/client.ts`. No feature calls
  `core.ts` directly. This is what makes the credit cap reliable.

---

## 3. Request flow

### 3.1 Paid data request (example: keyword research)

```
Dashboard form / MCP tools/call / REST POST
  -> auth (Stack session, or idxf_ API key with scope)
  -> resolve org: getOrgForUser(userId) (+ role check)
  -> resolve site: site must belong to the org (ownership-checked lookup)
  -> src/lib/seo/keywords.research(ctx, input)
       -> provider_cache lookup (sha256(endpoint + normalized params))
            hit and fresh -> return, ledger row with 0 credits
       -> BYOK? provider_credentials for org -> use their login, credits 0
       -> estimate credits; reserve in one transaction (fails if balance insufficient)
       -> DataForSEO call
            success -> settle on reported cost; write cache
            charged failure -> settle on reported cost
            uncharged failure -> release reservation
  -> ActionResult / JSON-RPC result / JSON
```

### 3.2 Indexing request

Unchanged: `src/lib/automation/service.ts` and `src/lib/platform/operations.ts`. In Phase 6 site
lookups move from `userId` to "member of the site's org".

---

## 4. Tenancy

### 4.1 Model

- Auth stays Stack Auth (identity only). Stack Auth teams are not used: per-request team lookups
  cost Neon/Stack round trips and CPU on the Workers budget.
- `organizations` (id uuid, name, ownerUserId, personal bool, credit columns) and
  `organization_members` (orgId, userId, role `owner` | `admin` | `member`).
- Every user gets a personal org: backfilled in migration 0011, ensured lazily on login next to
  `ensureUserRow()` in `src/lib/auth.ts`.
- **Project = existing `sites` row.** There is no separate `projects` table, so OpenSEO
  projects and IndexFast sites never drift apart. `sites.organization_id` is added nullable and
  backfilled from the owner's personal org.
- New SEO tables carry both `organizationId` and `siteId` (site-optional tables, such as saved
  keywords not tied to a site, carry `organizationId` and a nullable `siteId`).
- Plan entitlement stays on the org owner's `users` row in this phase. Moving entitlement to the
  org is later work (Phase 6).

### 4.2 Enforcement rules

1. Every query on a tenant table is filtered by `organizationId`, or it reaches the row through
   an ownership-checked site (`getSiteForUser` / `resolveSiteForUser` / `requireOwnedSite` today,
   org-aware versions later).
2. Child tables without a tenant column (for example rank snapshots under a run, audit pages
   under an audit) are reached only through a checked parent. A bare child id from a caller is
   never looked up alone.
3. Helpers take the tenant id in their signature. Bare `siteId` helpers are allowed only for the
   cron and Workflow system actor, and are named or commented as such.
4. Caller-supplied ids (site, keyword, list, run) are joined to the verified org in the same
   query, not checked in a separate step that a refactor can drop.
5. Third-party credentials (`provider_credentials`, Google tokens) are decrypted only inside the
   provider layer and never returned to clients.
6. `/api/track` ignores a client-sent `userId` (security fix in this branch).
7. `getLatestCheck` takes and applies an ownership filter (security fix in this branch).
8. IndexNow key adoption is refused when another account already has the domain verified; that
   user must host a fresh key unique to them (security fix in this branch).

### 4.3 Tests

- Pure tests for credit math, cache keys, envelope parsing, and ownership predicates.
- A tenant-isolation suite (Planned, Phase 7 at the latest) calls every org-scoped operation
  with a foreign org's site id, keyword id and list id, and expects "not found". It runs against
  a Neon branch or a local Postgres fixture.

---

## 5. Background jobs

| Job kind | Mechanism | Why |
|---|---|---|
| Sitemap sync, submission queue, GSC inspections, plan expiry | Existing hourly cron (`worker.ts` `scheduled` -> `runScheduledAutomation`) | Done; bounded budgets in `constants.ts` |
| Short polling state machines (DataForSEO `task_post` then `task_get`, monthly credit reset) | Hourly cron plus Postgres job tables | Few steps, state in DB, idempotent per row |
| Long jobs: site audit crawl, scheduled rank checks across many keywords, AI visibility collection | Cloudflare Workflows exported from `worker.ts` | Durable steps, retries per step, no 30-minute single invocation |
| Fallback if bundle size or CPU forces it | Internal Worker `indexfast-jobs` (`workers_dev = false`, no routes) reached by a service binding | Keeps the public origin single |

Rules:

- Paid Workflow steps do not retry automatically after the provider charged (no double charge).
  The step settles on the reported cost and records the failure.
- Jobs are idempotent per row: a re-run picks up where the job table says it stopped.
- Our own Cloudflare resources only. OpenSEO's KV, D1, R2 and Workflow IDs are never reused.

---

## 6. MCP, REST and CLI unification

- One service function per capability in `src/lib/seo/<feature>` or `src/lib/platform/operations.ts`.
- Dashboard server actions, MCP tools (`src/lib/mcp/server.ts`), REST routes (`src/app/api/v1/*`)
  and the CLI (via REST) are adapters that authenticate, resolve org and site, and call that
  function. No business logic is duplicated in `server.ts` (existing rule in `AGENTS.md`).
- MCP tool names follow existing style (`snake_case`, verb first). Keyword tools in this branch:
  research, save, list, remove saved keywords. Exact names are defined in `server.ts` and
  mirrored in `public/resources/skill/SKILL.md`.
- REST adds new scopes in `src/lib/platform/plans.ts` when a feature writes or spends credits.
  Existing responses stay backward compatible.
- Credit spend is visible to agents: paid tools return the credits charged and the remaining
  balance, and an estimate tool exists before any large job.

---

## 7. Information architecture

Single domain `https://indexfast.co`. All app routes live under `/dashboard`. No customer-facing
subdomains, no iframes.

| Nav group | Routes (planned paths) | Status |
|---|---|---|
| Overview | `/dashboard` | Done (sites list); SEO overview cards Planned |
| Research | `/dashboard/research/keywords`, `/dashboard/research/domain`, `/dashboard/research/backlinks`, `/dashboard/research/competitors` | Keywords In progress (this branch); others Planned |
| Tracking | `/dashboard/tracking/rankings`, `/dashboard/tracking/ai-visibility` | Planned |
| Site health | `/dashboard/sites/[siteId]` (audit, indexing, sitemaps, Search Console views) | Indexing and sitemaps Done; audit and Search Console reports Planned |
| Agents | `/dashboard/connect` (MCP, API keys, CLI) | Done |
| Billing | `/dashboard/billing` (plan, credit balance, ledger) | Plan Done; credit balance and ledger In progress (this branch) |
| Settings | `/dashboard/settings` (organization, members, provider credentials / BYOK) | Planned |

Site-scoped views keep the existing `?view=` pattern on `/dashboard/sites/[siteId]`. Research
tools that are not tied to a site take an optional site selector.

---

## 8. Design system

- Cobalt only (`DESIGN.md`, tokens in `src/app/globals.css`, primitives from `@/components/ui`).
- OpenSEO's client UI is a reference for flows and fields, never copied markup or styles.
- No iframes or embedded third-party UIs. Charts use the existing `BarChart` pattern or a new
  Cobalt primitive.
- Credit costs are shown next to every action that spends credits, before the user confirms.
