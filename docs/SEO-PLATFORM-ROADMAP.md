# SEO platform roadmap

Purpose: this document lists the phases that turn IndexFast into an SEO platform on the
architecture chosen in `docs/SEO-PLATFORM-ARCHITECTURE.md`. Each phase has concrete deliverables,
acceptance criteria and an honest status. Status words: **Done**, **In progress (this branch)**
(branch `feat/seo-platform`), **Planned**. Nothing here is deployed until the owner approves a
release.

---

## Acceptance criteria that apply to every phase

A deliverable is not "Done" until all of these hold:

1. **Gates pass:** `bun run lint`, `bunx tsc --noEmit`, `bun run test`.
2. **Tests next to the code:** pure logic (parsers, credit math, check rules, scoring) has Vitest
   coverage in a colocated `__tests__/` folder.
3. **Tenancy:** every new query is filtered by `organizationId` or reached through an
   ownership-checked site; a test calls each new operation with a foreign id and gets "not found".
4. **Credits:** every paid provider call goes through the metered DataForSEO client; the user sees
   an estimate before spend; the balance never goes negative; failures are settled or released
   (`docs/PROVIDER-COST-MODEL.md`).
5. **Parity across surfaces:** a capability in the dashboard is also reachable through MCP and
   REST, through one shared service function. SKILL.md and `docs/mcp.md` list new tools.
6. **Backward compatibility:** existing MCP tool names, REST responses and CLI behaviour do not
   change.
7. **Migrations:** additive, reviewed, with rollback SQL and a Neon branch snapshot before apply
   (`docs/DATABASE-MIGRATION-PLAN.md`).
8. **UI:** Cobalt primitives only, sentence case, no literal colours, works on phone width.
9. **Honesty:** no copy promises Google indexing or rankings; Google Indexing API stays limited to
   JobPosting and livestream pages; no invented metrics, testimonials or usage numbers.
10. **Licenses:** copied code carries its MIT header and an entry in `THIRD_PARTY_NOTICES.md`; no
    AGPL or GPL code enters `src/` (`docs/OPEN-SOURCE-LICENSE-AUDIT.md`).
11. **Docs move with code:** `AGENTS.md` and the matching `docs/*.md` are updated in the same change.
12. **Performance:** request handlers stay within Workers limits (128 MB, short CPU); heavy work
    runs in the cron or a Workflow.

---

## Phase 1: Audit and plan

| Deliverable | Status |
|---|---|
| Code audits of OpenSEO, CrawlSEO, SerpBear, CodoSEO, IndexFast, and a ranked list of other repos (research notes) | Done |
| `docs/OPENSEO-INTEGRATION-AUDIT.md` (source analysis and feature matrix) | In progress (this branch) |
| `docs/SEO-PLATFORM-ARCHITECTURE.md` (A/B/C decision, modules, tenancy, jobs, IA) | In progress (this branch) |
| `docs/SEO-PLATFORM-ROADMAP.md` (this file) | In progress (this branch) |
| `docs/OPEN-SOURCE-LICENSE-AUDIT.md`, `THIRD_PARTY_NOTICES.md` | In progress (this branch) |
| `docs/DATABASE-MIGRATION-PLAN.md`, `docs/DEPLOYMENT-ARCHITECTURE.md`, `docs/PROVIDER-COST-MODEL.md` | In progress (this branch) |

Acceptance: decisions are written down and not re-opened without new evidence; every claim cites
a file path or a source repo path.

---

## Phase 2: Foundation and keyword research

| Deliverable | Status |
|---|---|
| Migration 0011: `organizations`, `organization_members`, `sites.organization_id` (nullable), personal-org backfill | In progress (this branch) |
| Lazy `ensurePersonalOrg` on login next to `ensureUserRow` | In progress (this branch) |
| `credit_ledger` with grant, reserve, settle, release, purchase; monthly bucket reset to the plan grant (Free 250, Pro 5,000, Unlimited 25,000) | In progress (this branch) |
| `provider_cache` (sha256 key, TTL: keyword research 24h, domain 12h) | In progress (this branch) |
| `provider_credentials` (BYOK DataForSEO login, AES-GCM via `credentials.ts`) | In progress (this branch) |
| DataForSEO client port (`src/lib/providers/dataforseo`): core, envelope, labs, keyword metrics, metered client | In progress (this branch) |
| Keyword research vertical: research, save, list, remove saved keywords in dashboard, MCP and REST | In progress (this branch) |
| Credit balance and ledger on `/dashboard/billing` | In progress (this branch) |
| Security fix: IndexNow key adoption refused when another account has the domain verified | In progress (this branch) |
| Security fix: `getLatestCheck` ownership filter | In progress (this branch) |
| Security fix: `/api/track` ignores client-sent `userId` | In progress (this branch) |

Acceptance:
- Every existing user has exactly one personal org after 0011; every site has `organization_id`.
- A keyword research call with an empty balance is refused before any provider call.
- A repeated identical lookup within 24h returns from cache, costs 0 credits and writes no ledger row.
- A BYOK org is charged 0 provider credits; ledger rows still record the call.
- A second account cannot become verified for a domain another account already verified by
  pasting that site's public key.
- Free public tools make no DataForSEO calls.

---

## Phase 3: Rank tracking, domain overview, competitors

| Deliverable | Status |
|---|---|
| Rank tracking tables (configs, keywords, runs, snapshots) | Planned |
| Rank checks via DataForSEO standard queue (`task_post` then `task_get`), cron state machine for small runs, Workflow for large or scheduled runs | Planned |
| Cost estimate and approval ceiling per run (ported from OpenSEO) | Planned |
| SERP domain/URL matcher (ported from SerpBear `getSerp`) | Planned |
| Domain overview, ranked keywords, top pages (DataForSEO Labs, 12h cache) | Planned |
| SERP competitors and domain vs domain gap (`domain_intersection`) | Planned |
| `site_competitors` list | Planned |
| Tenant-isolation test suite against a Neon branch or local Postgres | Planned |

Acceptance: a scheduled run never charges for a keyword twice on one day; a failed `task_get`
does not re-post a paid task; history is queryable per keyword and device.

---

## Phase 4: Backlinks and credit top-ups

| Deliverable | Status |
|---|---|
| Backlinks summary, rows, referring domains, top pages, history, new/lost, anchors | Planned |
| `backlink_snapshots` for trends | Planned |
| Credit top-up packs via Razorpay one-time Orders, activated idempotently next to `activatePaidOrder()` (same `payments.orderId` uniqueness) | Planned |
| Refund handling for credit packs | Planned |
| Optional free backlink data from Common Crawl (offline job) | Planned |

Acceptance: a replayed Razorpay webhook never grants credits twice; a refunded pack removes only
unspent purchased credits and never makes the balance negative.

---

## Phase 5: Site audit and AI crawler access

| Deliverable | Status |
|---|---|
| Crawler on Cloudflare Workflows with a Postgres frontier, chunked pages per step, R2 for raw payloads | Planned |
| Page analyzer, discovery and URL policy ported from OpenSEO | Planned |
| Checks per `docs/OPENSEO-INTEGRATION-AUDIT.md` section 3.5, including sitemap/indexability consistency checks | Planned |
| Share-weighted health score with "points regained" per check (own implementation) | Planned |
| Crawl diff and regression alerts (became noindex, canonical changed, robots changed, sitemap shrank, error spike) | Planned |
| Core Web Vitals via PSI v5 and CrUX field data | Planned |
| AI crawler access: per-bot robots evaluation (CC0 `ai-bots.json`), synthetic bot-UA fetch, no-JS content check, llms.txt, Content-Signal | Planned |
| Audit findings link into the indexing queue (fix, then resubmit) | Planned |

Acceptance: a 10,000-page audit completes without any single invocation exceeding Workers limits;
SSRF guard re-checks every redirect hop; robots.txt and Crawl-delay are respected.

---

## Phase 6: Google reports, AI visibility, organizations for indexing

| Deliverable | Status |
|---|---|
| GSC Search Analytics ingestion (scope change from `AGENTS.md` section 15) | Planned |
| Opportunities: striking distance, low CTR, content decay, cannibalization (CrawlSEO formulas) | Planned |
| GA4 reports (ported clients and report definitions) | Planned |
| AI visibility prompt tracking across ChatGPT, Gemini, Claude, Perplexity, AI Overview, AI Mode (Workflow collection) | Planned |
| Brand lookup, prompt explorer, share of voice | Planned |
| Indexing code moves from `userId` to org membership; `(organizationId, domain)` uniqueness | Planned |
| Plan entitlement moves from the owner's `users` row to the org | Planned |
| Members, invitations, roles UI; per-member vs org credentials for Google/Bing/Yandex | Planned |
| `api_keys`, `api_usage_events`, `payments` carry `organization_id` | Planned |

Acceptance: removing a member stops their personal Google/Bing/Yandex credentials from being used
for org sites; existing API keys keep working after the move.

---

## Phase 7: Agents, integrations, agency, production quality

| Deliverable | Status |
|---|---|
| CLI: verify, queue, engines, GSC, keyword, rank and audit commands | Planned |
| SEO Autopilot: agent proposes changes and submissions, a human approves before anything is applied | Planned |
| Content Studio (briefs and drafts from keyword data) | Planned |
| WordPress companion plugin as a separate GPL-compatible package using the REST API | Planned |
| GitHub Action: audit a preview URL through the REST API, baseline gating, SARIF output | Planned |
| Agency tools: client orgs, white-label reports with sandboxed share links | Planned |
| Alert notifications by email (`EMAIL` binding) and signed webhooks | Planned |
| Rate limits on public free tools; production readiness review; staging on a Neon branch and Worker preview | Planned |

Acceptance: Autopilot never applies a change or spends credits without a recorded human approval;
the WordPress plugin contains no code from the SaaS beyond the public API contract.
