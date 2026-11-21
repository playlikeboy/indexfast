# OpenSEO integration audit

Purpose: this document records what we found when we read OpenSEO, CrawlSEO, SerpBear, CodoSEO
and about 50 other open-source repositories, and what IndexFast takes from each. It is the input
for the architecture (`docs/SEO-PLATFORM-ARCHITECTURE.md`), the roadmap
(`docs/SEO-PLATFORM-ROADMAP.md`) and the license rules (`docs/OPEN-SOURCE-LICENSE-AUDIT.md`).
All source repos were read from code at the commits listed below, on 2026-11-21. No source repo
was modified and no third-party test suite was executed. IndexFast's own gates were run
(`bun run test` 33 files / 189 tests, `bunx tsc --noEmit`, `bun run lint`, all passing on `main`
at `a134226`).

Status words used in this repo's planning docs: **Done**, **In progress (this branch)**,
**Planned**. This branch is `feat/seo-platform`.

---

## 1. Summary

- IndexFast stays the foundation (architecture A). OpenSEO's pure logic is ported into it;
  OpenSEO's framework, auth, billing and Cloudflare resources are not.
- OpenSEO (MIT) is the primary donor for paid SEO data features: DataForSEO client, keyword,
  domain, backlinks, rank tracking, AI visibility, site audit analyzer, GSC/GA4 clients.
- CrawlSEO (MIT) donates small pure modules: robots policy, noindex detection, on-page checks,
  GSC opportunity math (striking distance, low CTR, decay, cannibalization), alert rules.
- SerpBear (MIT) donates only API-vendor adapter shapes and SERP matching logic. Its scraping
  providers, auth and storage are skipped.
- CodoSEO (AGPL-3.0) is ideas only. No code, tests, templates or message text are copied. The one
  exception is its CC0 data file `crates/geo/data/ai-bots.json`.
- IndexFast already beats every donor on indexing automation (IndexNow, Bing API, GSC inspection,
  Yandex, Baidu, guarded Google Indexing API, throttle-aware queue). OpenSEO's IndexNow module
  is skipped.

---

## 2. Source projects

### 2.1 IndexFast (this repo)

| Item | Finding |
|---|---|
| License | Proprietary |
| Stack | Next.js 16.2.6 App Router, React 19, `@opennextjs/cloudflare` 1.19.x, Drizzle 0.45 on Neon HTTP, `@stackframe/stack` 2.8.108, Razorpay Orders, Vitest 4, Tailwind 4, Cobalt design system |
| Runtime | One Cloudflare Worker `indexfast` (`wrangler.jsonc`), entry `worker.ts` (fetch + hourly `scheduled`), Custom Domain `indexfast.co` |
| Tests | 33 Vitest files, 189 tests, pure functions only. No DB integration or tenant-isolation tests |
| Tenancy | `users.id` (Stack user id) is the only tenant key. No org/team/member model |
| Billing | Per user: `users.billingTier`, `users.planExpiresAt`. No credit ledger |
| Security | No cross-tenant data leak found. Latent findings: claimable ownership through a public IndexNow key (`service.ts` `adoptExistingIndexNowKeyForUser`), unscoped `getLatestCheck(urlId)` (`operations.ts`), helpers that trust a bare `siteId`, forgeable `userId` in `/api/track`, no rate limit on public free-tool actions, check-then-insert site limit |
| Cloudflare fit | Native (it runs there today) |

### 2.2 OpenSEO

| Item | Finding |
|---|---|
| Upstream | github.com/every-app/open-seo, HEAD `af3f995f`, package 0.1.31 |
| License | MIT, "Copyright (c) 2026 Ben Senescu". Internal skill `.agents/skills/deslop` is MIT "Copyright (c) 2026 Stephen D. Turner" (not needed) |
| Activity | Active, large codebase (~66k LOC client, ~66k server, ~1,465 files under `src/`) |
| Stack | TanStack Start + Router + Query + Form, React 19, Vite 8 with `@cloudflare/vite-plugin` pinned to a beta sha, Better Auth 1.6.22 (organization + api-key plugins), Drizzle 0.45 with dual SQLite (D1) and Postgres (Hyperdrive) schema trees, Autumn (Stripe) billing, OpenRouter LLMs, MCP SDK 1.32 |
| Background | 4 Cloudflare Workflows (site audit, rank check, AI visibility, local rank), 2 Durable Objects (SAM chat agent, audit scratchpad), crons `*/5 * * * *` and `17 3 * * *`. A second Worker `open-seo-audit` hosts the audit engine |
| Quality | High: service/repository layering, Zod at every boundary, design specs per feature (`docs/maintainers/specs/0001-0022`), knip/oxlint/tsc in CI |
| Tests | 312 Vitest files (~1,445 cases), 6 Playwright specs including MCP tenant isolation, `tests/badseo` fixture site |
| Dependency risk | Many pre-release pins: `effect@4.0.0-beta.93`, `alchemy@2.0.0-beta.61` (patched), `cf@1.0.0-beta.14`, vite plugin beta sha, `vitest@5`, `vite@8`, `agents@0.28.1`, `@cloudflare/think@0.19.0`, two MCP SDK generations side by side, vendor packages `@every-app/*` (license unverified) |
| Security | Good: encrypted OAuth tokens, encrypted crawler credentials, `global_fetch_strictly_public`, redirect re-validation, CSP report endpoint, Svix-verified webhooks, paid Workflow steps without retries. Watch: isolation is app-layer only and child tables carry no tenant column; public share links serve agent-authored HTML; `local_noauth` mode disables auth; free tools spend platform DataForSEO budget (guarded by a Durable Object budget and rate limit) |
| Cloudflare fit | Native, but its Workers, KV, D1, R2 and Workflow IDs belong to OpenSEO. We never reuse them |
| Commercial restriction | None beyond keeping the MIT notice. Do not reuse the "OpenSEO" brand |

### 2.3 CrawlSEO

| Item | Finding |
|---|---|
| License | MIT, "Copyright (c) 2026 crawlseo" (`package.json` author "Brandson Digital"). `packages/mcp` also MIT |
| Activity | 126 commits, 121 in the last 6 months, last commit 2026-11-02. Version 0.3.6 |
| Stack | Next 16.2.2, React 19.2.4, Prisma 6.19, Auth.js v5 beta, MCP SDK 1.29, undici 7, robots-parser 3, nodemailer, zod 4. Separate long-running worker process; deploys with Docker or Vercel |
| Tests | 97 Vitest files, PGlite for DB tests |
| Quality | Good. Crawler engine is one 1,635-line file with regex HTML parsing |
| Security | Good: DNS-pinned SSRF guard, per-hop redirect checks, body caps, HMAC webhooks, AES-256-GCM tokens, CSV formula-injection escaping. Rate limit is in-memory only. `lib/google/autocomplete.ts` uses an unofficial Google endpoint |
| Cloudflare fit | Not as a whole (Prisma, Node `dns`/`net`, undici agents, 30-minute crawls). Pure modules port cleanly |
| Commercial restriction | None beyond the MIT notice |

### 2.4 SerpBear

| Item | Finding |
|---|---|
| License | MIT, "Copyright (c) 2022 Amruth Pillai" (kept exactly as written, although the maintainer is towfiqi) |
| Activity | Maintenance mode: 6 commits in 6 months, release 3.1.2 on 2026-10-30 |
| Stack | Next 12.3.4 pages router (EOL), Sequelize + native `sqlite3`, axios, cheerio, croner, cryptr |
| Tests | 10 Jest files, UI only. No tests on scrapers or refresh |
| Security | Weak: single env password, one global API key compared with `===`, JWT without expiry claim, API keys in query strings, `/api/notify` unauthenticated until 3.1.1 |
| Cloudflare fit | None as is. Adapter objects and `getSerp` matching are portable after replacing axios/cheerio with `fetch` |
| Commercial restriction | MIT notice. Three providers (`proxy`, `scrapingrobot`, `scrapingant`) scrape Google HTML directly, which violates Google's terms. They are excluded |

### 2.5 CodoSEO

| Item | Finding |
|---|---|
| License | AGPL-3.0-only (SafrowLabs). Exception: `crates/geo/data/ai-bots.json` and its schema are CC0-1.0 |
| Activity | 404 commits in about 5 weeks (2026-10-03 to 2026-11-10), version 0.1.0-rc.1 |
| Stack | Rust 2024, tokio, reqwest, axum, `lol_html`, rmcp. ~149k lines in 12 crates. CLI, local MCP, web app, hosted REST + MCP |
| Tests | ~1,979 Rust tests plus insta snapshots |
| Cloudflare fit | Not applicable (native binary). WASM would still be AGPL |
| Commercial restriction | AGPL: porting code into a network service obliges releasing IndexFast's source. Ideas only, with a clean-room note of who read what |

---

## 3. Feature matrix

Column key. "Existing IndexFast" is what runs on `main` today. "Final decision" names the reuse
mode and target module. Reuse modes: **Keep** (IndexFast code stays), **Port** (copy-adapt with
MIT header, see `THIRD_PARTY_NOTICES.md` at the repo root), **Reimplement** (our own code from the
idea), **Install** (dependency), **Skip**.

### 3.1 Keyword intelligence

| Feature | Existing IndexFast | OpenSEO | CrawlSEO | Additional sources | Final decision |
|---|---|---|---|---|---|
| Seed keyword research (related, suggestions, ideas) | None | Full: DFS Labs `related_keywords`, `keyword_suggestions`, `keyword_ideas` live; Ads `keywords_for_keywords`; modes auto/related/suggestions/ideas (`research/research.ts`) | None | SerpBear Google Ads API (needs per-user developer token) | Port OpenSEO to `src/lib/seo/keywords`. In progress (this branch) |
| Volume, KD, CPC, intent, monthly trend | None | Full: `keyword_overview/live`, Ads `search_volume/live` (`keyword-metrics.ts`, `labs.ts`) | None | - | Port with keyword research. In progress (this branch) |
| Local (sub-country) volume | None | Full via Ads (`local-volume.ts`, `LOCAL_VOLUME_COST_USD=0.09`) | None | - | Port later with rank tracking locations. Planned |
| Question keywords (PAA) | None | Absent as a mode | None | - | Reimplement as a filter over suggestions. Planned |
| Keyword clustering | None | Agent skill only | None | `mcp-serp-clustering` (skip); write own: pairwise top-10 URL overlap, cluster at >= 3 shared | Reimplement. Planned |
| Saved keyword lists, tags, export | None | Full: `saved_keywords`, tags, assignments, `keyword_metrics` | GSC-based saved keywords | - | Port save/list/remove in this branch (In progress); tags and CSV export Planned |
| Keyword research response cache | None | R2 JSON cache, 24h, `CACHE_VERSION=5` | None | - | Reimplement as Postgres `provider_cache` (24h). In progress (this branch) |
| Google autocomplete ideas | None | None | `autocomplete.ts` (unofficial endpoint) | - | Skip (terms risk) |

### 3.2 Rank tracking

| Feature | Existing IndexFast | OpenSEO | CrawlSEO | Additional sources | Final decision |
|---|---|---|---|---|---|
| Scheduled SERP rank checks | None | Full: `task_post` then `task_get/advanced`, devices, depth 10-100, daily/weekly/monthly, cost estimate and approval ceiling, pinned keywords, subset runs (`RankTrackingService.ts`, `RankCheckWorkflow.ts`) | GSC average position per query/day (`RankSnapshot`), not SERP | SerpBear smart pagination, provider registry | Port OpenSEO service logic; run as Cloudflare Workflow or cron state machine. Planned (Phase 3) |
| Position history storage | None | `rank_check_runs`, `rank_snapshots` with SERP features | Prisma rows | SerpBear JSON map in a text column (skip) | Own Postgres tables (see `docs/DATABASE-MIGRATION-PLAN.md`). Planned |
| Domain / URL SERP matching | None | Yes | - | SerpBear `getSerp` (www, subdomains, exact URL) | Port SerpBear matcher. Planned |
| Alternative SERP vendors | None | DataForSEO only | - | SerpBear adapters for SerpApi, Serper, SearchApi, ValueSERP (API vendors only) | Port adapter shape only if a second vendor is needed. Planned, low priority |
| Direct Google HTML scraping | None | None | None | SerpBear `proxy`, `scrapingrobot`, `scrapingant` | Skip (Google terms) |
| Local geo-grid rank tracking | None | Full (maps endpoints, grid tables, map tiles) | None | - | Planned after core rank tracking; large effort |
| Rank change digest | None | Dashboard | Alerts | SerpBear email digest | Reimplement on Cloudflare `EMAIL` binding. Planned |

### 3.3 Domain intelligence

| Feature | Existing IndexFast | OpenSEO | CrawlSEO | Additional sources | Final decision |
|---|---|---|---|---|---|
| Domain overview (traffic, keywords count, rank) | None | Full: `domain_rank_overview/live`, 12h cache (`DomainService.ts`) | DFS domain overview, BYO key | - | Port. Planned (Phase 3) |
| Ranked keywords | None | Full: `ranked_keywords/live` with filters | None | - | Port. Planned |
| Top pages | None | Full: `relevant_pages/live` | GSC pages | - | Port. Planned |
| SERP competitors for a keyword set | None | Full: `serp_competitors/live` | None | - | Port. Planned |
| Domain vs domain keyword gap | None | Web free tool only (`domain_intersection/live`) | None | - | Port into dashboard (paid, credit metered). Planned |
| Competitor list per site | None | `project_competitors` | None | - | Reimplement as `site_competitors`. Planned |

### 3.4 Backlinks

| Feature | Existing IndexFast | OpenSEO | CrawlSEO | Additional sources | Final decision |
|---|---|---|---|---|---|
| Summary, rows, referring domains, top pages, history, new/lost | None | Full: `/v3/backlinks/summary`, `backlinks`, `referring_domains`, `domain_pages_summary`, `history` live | DFS `/backlinks` | Common Crawl webgraph (free, quarterly, offline DuckDB job); Canonry does this | Port OpenSEO. Planned (Phase 4). Common Crawl free tier Planned, later |
| Backlink trend snapshots | None | `backlink_snapshots` | - | - | Port table shape. Planned |
| Anchors | None | From rows only | - | - | Port. Planned |
| Free domain rating | None | Ahrefs `domain-rating-free` (KV 24h) | - | - | Evaluate Ahrefs terms before use. Planned, optional |

### 3.5 Site audit and technical SEO (each check)

Existing IndexFast diagnostics (`src/lib/automation/diagnostics.ts`) check one URL at a time:
HTTP status, meta and X-Robots noindex, canonical, robots.txt block and redirects. There is no
site crawler. The site audit (Phase 5) adds a crawler; the table lists every check we plan and
where the rule comes from. Severity follows OpenSEO's catalog unless noted.

| Check | Existing IndexFast | OpenSEO | CrawlSEO | Additional sources | Final decision |
|---|---|---|---|---|---|
| Server error 5xx | Per-URL diagnostic | critical `server-error` | - | CodoSEO idea `http_5xx` | Port OpenSEO rule |
| Broken page 4xx | Per-URL diagnostic | warning `broken-page` | `BROKEN_LINK` critical | CodoSEO `http_4xx` | Port OpenSEO rule |
| Broken internal link | None | critical `broken-internal-link` | yes | CodoSEO `links_to_broken`; linkinator HEAD-then-GET idea | Port OpenSEO |
| Links to redirect | None | - | - | CodoSEO `links_to_redirect` | Reimplement |
| Redirect chain | Per-URL redirect check | warning `redirect-chain` | enum only | CodoSEO `redirect_chain` | Port OpenSEO |
| Redirect loop | None | warning `redirect-loop` | - | CodoSEO `redirect_loop` | Port OpenSEO |
| Blocked by robots.txt | Per-URL robots check | critical `blocked-page` | `robots.ts` (943-line test) | `robots-parser` (MIT) | Install robots-parser; port CrawlSEO policy wrapper |
| robots.txt blocks whole site | None | - | `MISSING_ROBOTS` | CodoSEO `robots_blocks_site` | Reimplement |
| Missing robots.txt | None | - | `MISSING_ROBOTS` | - | Port CrawlSEO |
| Noindex page | Per-URL diagnostic | info `noindex-page` | `noindex.ts` (meta + X-Robots) | - | Port CrawlSEO detector |
| Site-wide noindex | None | - | `NOINDEX_SITEWIDE` alert | - | Port CrawlSEO rule |
| Canonicalised page | Per-URL canonical | info `canonicalized-page` | - | - | Port OpenSEO |
| Canonical conflict | None | warning `canonical-conflict` | - | - | Port OpenSEO |
| Canonical missing | Per-URL | - | `MISSING_CANONICAL` info | - | Port CrawlSEO |
| Canonical to non-200 | None | - | - | CodoSEO idea `canonical_to_non200` | Reimplement |
| Title missing | None | critical `missing-title` | critical | - | Port OpenSEO |
| Title too long / too short | None | info | content score 15-65 chars | - | Port OpenSEO |
| Duplicate title | None | warning | yes, noindex excluded | - | Port OpenSEO (exclude noindex as CrawlSEO does) |
| Meta description missing / too long / too short | None | warning / info | warning | - | Port OpenSEO |
| Duplicate meta description | None | warning | yes | - | Port OpenSEO |
| H1 missing / multiple | None | warning | warning / info | - | Port OpenSEO |
| Heading order skip | None | info | - | - | Port OpenSEO |
| Thin content | None | warning | word count in score | readability + linkedom for main-content word count | Port OpenSEO; install readability later |
| Duplicate content | None | warning (contentHash) | - | - | Port OpenSEO |
| Images missing alt | None | warning | warning | - | Port OpenSEO |
| Orphan page | None | warning | first 50 candidates | CodoSEO `orphan` | Port OpenSEO SQL idea onto Postgres |
| No outgoing links | None | warning | - | CodoSEO `no_internal_outlinks` | Port OpenSEO |
| Nofollow internal links | None | - | - | CodoSEO idea | Reimplement |
| Deep page | None | info | - | CodoSEO `deep_page` | Port OpenSEO |
| Slow response | None | info | `SLOW_PAGE` > 3000 ms | - | Port OpenSEO |
| Large page | None | - | `LARGE_PAGE` > 3 MB | - | Port CrawlSEO |
| Mixed content | None | - | `MIXED_CONTENT` | - | Port CrawlSEO |
| Not HTTPS | None | - | - | CodoSEO idea `not_https` | Reimplement |
| JavaScript rendering suspected | None | warning (Browser Rendering compare) | - | `cloudflare/browser-run` | Port OpenSEO idea; Browser Rendering binding Planned |
| Missing schema / invalid JSON-LD | None | collected, not flagged | `MISSING_SCHEMA` info | `@adobe/structured-data-validator`, `schema-dts` | Install validator; reimplement check |
| Open Graph missing | None | collected, not flagged | - | CodoSEO `og_missing` | Reimplement |
| Hreflang missing self-reference | None | - | - | CodoSEO idea, seonaut rules | Reimplement |
| Sitemap missing / blocked | Discovery reports it | discovery | `MISSING_SITEMAP`, `SITEMAP_BLOCKED` | - | Keep IndexFast discovery; add audit finding |
| Sitemap URL returns non-200 | None | - | - | CodoSEO idea `sitemap_non200` | Reimplement (high indexing value) |
| Sitemap URL is noindex | None | - | - | CodoSEO idea `sitemap_noindex` | Reimplement (high indexing value) |
| Sitemap URL is canonicalised | None | - | - | CodoSEO idea `sitemap_canonicalised` | Reimplement (high indexing value) |
| Indexable page not in sitemap | None | `inSitemap` collected | first 50 | CodoSEO `not_in_sitemap` | Reimplement |
| Crawl limits hit (rate limited, time, credits, page limit) | None | warnings | - | - | Port OpenSEO |
| Core Web Vitals lab | None | DFS `on_page/lighthouse/live/json`, sample of 10 URLs x 2 strategies | PSI v5 lab fields | PSI v5 REST | Use PSI v5 (free with `GOOGLE_PSI_API_KEY`) first; DFS Lighthouse optional. Planned |
| Core Web Vitals field (CrUX, INP) | None | None | Not read | `treosh/crux-api` (MIT) | Install crux-api or read PSI `loadingExperience`. Planned |
| Health score | None | Lighthouse scores | flat -8/-3/-1 (floors at 0) | CodoSEO share-weighted idea | Reimplement share-weighted score with "points regained" |
| Crawl diff / regressions (became noindex, canonical changed, robots changed, sitemap shrank, error spike) | None | None | None | CodoSEO idea | Reimplement. Planned (Phase 5) |
| Remediation copy | None | issue catalog text | `remediation.ts` | Never CodoSEO text | Port CrawlSEO/OpenSEO text |
| Recheck one finding without full crawl, snooze, accept | Dismiss issue exists | - | - | CodoSEO idea | Reimplement |
| SSRF and crawl safety | `assertSafeExternalUrl`, manual redirects, `global_fetch_strictly_public` | URL policy, per-hop checks | DNS-pinned guard | - | Keep IndexFast guard; port OpenSEO `url-policy.ts` |
| Crawl orchestration | None | Workflow + SQLite DO scratchpad, ~200 pages per chunk, ~90 s soft deadline | 30-minute process | CodoSEO politeness limiter idea | Reimplement on Cloudflare Workflows with a Postgres frontier; R2 for raw payloads |

### 3.6 Indexing automation

| Feature | Existing IndexFast | OpenSEO | CrawlSEO | Additional sources | Final decision |
|---|---|---|---|---|---|
| Sitemap autopilot (discovery, BFS index, gzip, due scheduling) | Done (`sitemaps.ts`, `service.ts`) | Discovery inside audit | Sitemap checks | - | Keep |
| IndexNow (key, verify, batch 1000) | Done | Manual submit + key check | - | `indexnow-action` idea | Keep; skip OpenSEO module |
| Ownership proof hardening | Public key can be adopted by any account | - | - | - | Fix: adoption only when no other account has the domain verified. In progress (this branch) |
| Bing Webmaster API | Done (paid) | - | Bing traffic read | - | Keep; Bing traffic/keyword reads Planned |
| GSC URL inspection + sitemap submit | Done | Inspection | Inspection | - | Keep |
| Google Indexing API (JobPosting / livestream only) | Done (guarded) | - | - | - | Keep. Never general submissions |
| Yandex, Baidu | Done (paid) | - | - | - | Keep |
| Queue with throttle-aware retries | Done | - | Postgres job queue | - | Keep; reuse pattern for new jobs |
| Alerts email / webhook | Dashboard only | - | Email + HMAC webhooks | - | Port CrawlSEO webhook signing on Web Crypto. Planned |
| Indexing under organizations | Per user | Per project/org | - | - | Planned (Phase 6) |
| GitHub Action | None | - | - | CodoSEO CI idea (SARIF, baseline), `indexnow-action` | Reimplement against REST API. Planned (Phase 7) |
| WordPress plugin | None | - | - | Microsoft IndexNow WP plugin (GPL-2.0) | Separate GPL-compatible package talking to REST API. Planned |

### 3.7 AI search and GEO

| Feature | Existing IndexFast | OpenSEO | CrawlSEO | Additional sources | Final decision |
|---|---|---|---|---|---|
| AI crawler access check (robots per bot) | Free tool `/tools` AI crawler checker | - | - | CodoSEO `ai-bots.json` (CC0, 27 bots), nuxt-robots bot lists (MIT) | Copy CC0 data; reimplement logic. Planned |
| Synthetic fetch with bot UA (WAF/CDN block) | None | - | - | CodoSEO idea | Reimplement. Planned |
| No-JS content present | None | JS rendering suspected | - | CodoSEO idea | Reimplement. Planned |
| llms.txt presence / validation | IndexFast generates its own llms.txt; free generator tool | - | - | AnswerDotAI llms-txt spec (Apache-2.0) | Port parser idea to TS. Planned |
| Content-Signal, Markdown alternate | None | - | - | CodoSEO idea | Reimplement. Planned |
| Prompt tracking across engines (ChatGPT, Gemini, Claude, Perplexity, AI Overview, AI Mode) | None | Full (`aiVisibility*.ts`, `AiVisibilityWorkflow.ts`) | - | Elmo (MIT) Postgres design, Canonry (MIT), limelit open (Apache-2.0) | Port OpenSEO; Elmo as design reference. Planned (Phase 5/6) |
| Brand lookup, prompt explorer, share of voice (LLM mentions) | None | Full (`llm_mentions/*`) | - | - | Port. Planned |
| Prompt research / suggestions with LLM | None | OpenRouter | - | - | Port with `OPENROUTER_API_KEY`. Planned |
| GEO content scoring | None | - | - | GEO-optim heuristics (Apache-2.0), readability formulas | Reimplement. Planned |

### 3.8 Google integrations

| Feature | Existing IndexFast | OpenSEO | CrawlSEO | Additional sources | Final decision |
|---|---|---|---|---|---|
| Google OAuth | Done (`google-oauth.ts`, signed state, nonce cookie) | Better Auth account | Encrypted refresh | `jose` for service accounts | Keep |
| GSC Search Analytics ingestion | Out of scope today (AGENTS.md section 15) | Full (`searchAnalytics.ts`) | Full + `aggregate.ts` | AminForou/mcp-gsc tool naming | Port; scope change approved by this plan. Planned (Phase 6) |
| GSC opportunities (striking distance, low CTR, decay, cannibalization) | None | `SearchOpportunityService` (GSC x GA4) | `seo-opportunities.ts` formulas | - | Port CrawlSEO math. Planned |
| GA4 reports (11 report tools) | None | Full (`ga4Client.ts`, `Ga4Report*`) | - | official GA4 MCP tool shapes | Port. Planned (Phase 6) |
| PageSpeed / CrUX | None | DFS Lighthouse | PSI lab only | crux-api | See 3.5. Planned |

### 3.9 Agent ecosystem

| Feature | Existing IndexFast | OpenSEO | CrawlSEO | Additional sources | Final decision |
|---|---|---|---|---|---|
| MCP server | Done: JSON-RPC `/api/mcp`, 31 tools, API-key auth, all plans | 87 tools, OAuth + API keys, MCP Apps widgets | 13 read tools over REST, text formatters | cloudflare/agents (if sessions/OAuth needed) | Keep IndexFast transport; add SEO tools that call shared services. Keyword tools In progress (this branch) |
| REST API | Done: `/api/v1/*`, scoped keys | Absent (server functions only) | Read-only `/api/v1` | - | Keep; add SEO routes. Keyword routes In progress (this branch) |
| CLI | Partial (`cli/`, no verify/queue/engines/GSC) | Absent | - | iannuttall/seo `seo next` loop idea | Extend. Planned (Phase 7) |
| SKILL.md / agent skills | One SKILL.md | 12 skills | - | - | Adapt selected skills to IndexFast tool names. Planned |
| In-app chat agent | None | SAM (Durable Object, `@cloudflare/think`) | - | - | Skip for now; SEO Autopilot with human approval Planned instead |
| Agent-authored reports + share links | None | Full, sandboxed HTML | CSV export | - | Port with strict sandbox/CSP. Planned |
| Project memory / context | None | Full | - | - | Port. Planned |

### 3.10 Platform (not user features)

| Concern | Existing IndexFast | OpenSEO | Final decision |
|---|---|---|---|
| Auth | Stack Auth | Better Auth (5 modes) | Keep Stack Auth |
| Orgs / members | None | Better Auth organization plugin | Own Postgres `organizations`, `organization_members`. In progress (this branch) |
| Billing | Razorpay prepaid plans | Autumn (Stripe), top-ups, auto-reload | Keep Razorpay; own credit ledger. Ledger In progress (this branch); top-ups Planned |
| Usage metering | API call quota | `meter()` reserve, call, settle | Reimplement on Postgres `credit_ledger`. In progress (this branch) |
| BYOK | None | Self-host env key only | `provider_credentials` per org. In progress (this branch) |
| Database | Neon Postgres + Drizzle | D1 or Postgres, dual schema | Postgres only; port pg schema tree selectively |

---

## 4. Other repositories, ranked picks

From `gh api` metadata on 2026-11-21. "Workers" = can run inside a Cloudflare Worker.

| Rank | Repo | License | Workers | Use |
|---|---|---|---|---|
| 1 | samclarke/robots-parser | MIT | Yes | Install for audits and free tools |
| 2 | adobe/structured-data-validator | Apache-2.0 | Partial (check extractor deps) | Install, pin version; schema check |
| 3 | google/schema-dts | Apache-2.0 | Types only | Install (dev) |
| 4 | mozilla/readability + WebReflection/linkedom | Apache-2.0 / ISC | Yes, CPU heavy | Install; run in cron or Workflow only |
| 5 | words/flesch-kincaid, words/syllable | MIT | Yes | Install for readability scoring |
| 6 | cloudflare/browser-run | Apache-2.0 | Yes (binding) | Install when JS-render checks land |
| 7 | treosh/crux-api | MIT | Yes | Install or copy for field CWV |
| 8 | GoogleChrome/web-vitals | Apache-2.0 | Client | Only if we ship a RUM snippet |
| 9 | panva/jose | MIT | Yes | Install for JWT/service accounts on Web Crypto |
| 10 | Canonry/canonry | MIT | No | Port ideas (AEO tracking, Common Crawl backlinks) |
| 11 | elmohq/elmo | MIT | No | Design reference for AI visibility on Postgres |
| 12 | Canonry/agent-readiness | MIT | Partial | Evaluate; pin or vendor |
| 13 | iannuttall/seo | Apache-2.0 | No | Port ideas (MCP tool design, next-step loop) |
| 14 | cloudflare/agents | MIT | Yes | Consider if MCP needs sessions or OAuth |
| 15 | node-html-parser / htmlparser2 / cheerio | MIT | Yes | Install one if `HTMLRewriter` is not enough |
| 17 | dataforseo/mcp-server-typescript | Apache-2.0 | Partial | Reference for request shapes |
| 18 | commoncrawl cc-webgraph, cc-index-table | Apache-2.0 | No | Use the data in an offline job |
| 19 | AnswerDotAI/llms-txt | Apache-2.0 | No | Port parser idea |
| 24 | StJudeWasHere/seonaut | MIT | No | Port rule list ideas |
| 28 | JustinBeckwith/linkinator | MIT | No | Port link-check logic |
| 42 | bojieyang/indexnow-action | MIT | n/a | Idea for IndexFast GitHub Action |

Restricted and skipped: Hormold/indexplease (no license), microsoft/indexnow-wordpress-plugin
(GPL-2.0, only for a separate GPL plugin), Yoast and The SEO Framework (GPL-3.0, ideas only),
Seo-Panel (GPL-2.0), searxng and firecrawl (AGPL-3.0), firecrawl/llmstxt-generator (no license),
ahonn/mcp-server-gsc (no LICENSE file), LuanRT/google-this (scrapes Google),
googleapis node client (too heavy for Workers; use REST + jose). Stale or archived:
google/schemarama, GoogleChromeLabs/psi, cloudflare/playwright, serphacker/serposcope.

No repository replaces a data vendor. SERP, keyword volume and AI-answer data need DataForSEO
(or SerpApi or similar). Common Crawl is the only free backlink source and is domain-level and
roughly quarterly.

---

## 5. What we deliberately do not take from OpenSEO

| Item | Reason |
|---|---|
| TanStack Start routes and server functions | IndexFast is Next.js 16; logic is re-wired to server actions, route handlers and MCP |
| Better Auth and its tables | Stack Auth stays; users are not migrated |
| Autumn / Stripe billing | Razorpay stays the only provider |
| D1 schema tree and parity test | Postgres only |
| KV, D1, R2, Workflow, Durable Object IDs, `wrangler*.jsonc` | Their resources; we create our own |
| SAM chat agent | Durable Object on a pre-release SDK; replaced by planned SEO Autopilot |
| Every App, Stripe Projects, Dub, Loops, guest accounts, Cloudflare Access mode | Vendor or self-host specific |
| Client UI (shadcn on Base UI, TanStack Table) | Reference only; rebuilt in Cobalt (`DESIGN.md`) |
| IndexNow module | IndexFast's is more complete |
| Brand name "OpenSEO" | Not ours |
