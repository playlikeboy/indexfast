# Provider cost model

Purpose: this document explains how IndexFast pays for third-party SEO data (DataForSEO first)
and how that cost becomes credits that customers see and spend. It covers price assumptions,
the credit formula, plan grants, caching, estimates before spend, hard caps, bring-your-own-key
(BYOK), failure handling, usage visibility and the rules for free public tools. Ledger schema is
in `docs/DATABASE-MIGRATION-PLAN.md`; code lives in `src/lib/credits` and
`src/lib/providers/dataforseo` (In progress, this branch).

---

## 1. DataForSEO price assumptions

**These are estimates based on DataForSEO's published list-price structure. Verify every figure
on DataForSEO's pricing page before launch and before changing plan grants.** Prices change, and
some endpoints differ by queue (standard vs live), depth, or engine. The code never relies on
these numbers for the final charge: it settles on the `cost` field DataForSEO returns with each
response.

DataForSEO bills per task, and many endpoints add a per-item charge for returned rows.

| Feature | Endpoint (v3) | Estimated price structure |
|---|---|---|
| Keyword research | `dataforseo_labs/google/related_keywords/live`, `keyword_suggestions/live`, `keyword_ideas/live` | about $0.01 per task + $0.0001 per returned item |
| Keyword metrics | `dataforseo_labs/google/keyword_overview/live` | about $0.01 per task + $0.0001 per item |
| Search volume (Ads) | `keywords_data/google_ads/search_volume/live` | per task, priced by DataForSEO for up to 1,000 keywords; verify |
| Local (sub-country) volume | Ads, via OpenSEO `local-volume.ts` | OpenSEO uses `LOCAL_VOLUME_COST_USD = 0.09` as its estimate; verify |
| Domain overview | `dataforseo_labs/google/domain_rank_overview/live` | about $0.01 per task + per item |
| Ranked keywords, top pages | `ranked_keywords/live`, `relevant_pages/live` | about $0.01 per task + $0.0001 per item |
| SERP competitors, domain gap | `serp_competitors/live`, `domain_intersection/live` | about $0.01 per task + per item |
| Rank tracking (standard queue) | `serp/google/organic/task_post` then `task_get/advanced/{id}` | about $0.002 per task for a standard-queue SERP at default depth; deeper SERPs and priority queues cost more |
| Live SERP | `serp/google/organic/live/advanced` | higher than the standard queue (several times the standard price) |
| Backlinks | `backlinks/summary/live`, `backlinks/live`, `referring_domains/live`, `history/live` | about $0.02 per task + per item for row endpoints |
| AI visibility (model APIs) | `ai_optimization/{engine}/llm_responses/live` | varies by engine and model, roughly token-based; verify per model |
| AI visibility (scraped answers) | `ai_optimization/{chat_gpt,gemini}/llm_scraper/task_post`, `serp/google/ai_mode/task_post` | varies; verify |
| LLM mentions | `ai_optimization/llm_mentions/*/live` | varies; verify |
| Lighthouse | `on_page/lighthouse/live/json` | per task; verify. PSI v5 with our own key is free within Google's quota and is preferred |

OpenSEO charges task-based endpoints at `task_post` and treats `task_get` collection as
unmetered. We use the same rule.

---

## 2. Credit formula

```
credits = ceil(providerCostUsd * 1.3 * 1000)
```

- 1,000 credits equal 1 USD of marked-up cost. The markup is 1.3 (30%) over DataForSEO's price.
- Rounded up per call, so a call never costs 0 credits unless it is a cache hit or BYOK.
- The ledger stores the provider cost exactly as `provider_cost_micro_usd` (integer millionths of
  a USD) next to `credits`.

Worked examples (estimates from section 1):

| Call | Est. provider cost | Credits |
|---|---|---|
| Related keywords, 100 items | $0.01 + 100 x $0.0001 = $0.020 | ceil(0.020 x 1.3 x 1000) = 26 |
| Related keywords, 1,000 items | $0.01 + 1,000 x $0.0001 = $0.110 | 143 |
| Rank check, 1 keyword, 1 device, standard queue | $0.002 | 3 |
| Backlinks summary | $0.02 | 26 |

---

## 3. Plan grants and implied margin

Plan grants are a monthly bucket on `organizations` (`monthly_credits`), reset to the plan grant
each calendar month (UTC, tracked by `credit_period` `YYYY-MM`). Unused monthly credits do not
roll over. Purchased credits (`purchased_credits`) never expire and are spent after the monthly
bucket. The grant comes from the org owner's plan (`src/lib/platform/plans.ts`) in this phase.

| Plan | Price | Monthly credits | Max provider cost covered (credits / 1000 / 1.3) | Share of plan price |
|---|---|---|---|---|
| Free | $0 | 250 | about $0.19 | n/a (cost to us) |
| Pro | $19 / 30 days | 5,000 | about $3.85 | about 20% |
| Unlimited | $99 / 30 days | 25,000 | about $19.23 | about 19% |

"Unlimited" means unlimited sites and indexing. Paid research data is credit-metered on every
plan. These are upper bounds: a customer who spends the whole grant costs us that much, and cache
hits reduce it. Margin on top-up packs is the 30% markup minus payment fees (Razorpay fees and
currency conversion are not included here and must be checked before pricing packs).

Illustrative capacity (estimates, not promises): a full Pro grant covers about 190 keyword
research calls of 100 items, or about 1,600 single-device standard-queue rank checks.

---

## 4. Caching

- Table `provider_cache`, key = sha256 of provider + endpoint + normalized params.
- TTLs: keyword research 24h, domain intelligence 12h. Others are set per feature when added.
- A fresh hit costs 0 credits and writes a ledger row with `credits = 0` and the feature name, so
  usage stays visible.
- The cache is shared across tenants on purpose: it holds public search data only. Tenant data
  (GSC, GA4, private crawls, BYOK responses tied to a customer account) is never cached there.
- Expired rows are pruned by the hourly cron.

Savings cannot be measured until real traffic exists; we will report hit rate from the ledger
(cost-0 rows with a cache flag in `metadata`) rather than assume one.

---

## 5. Estimates before spend

1. Every paid action computes an estimate from the request shape (limit, depth, devices, number
   of keywords or prompts) using `src/lib/credits/pricing.ts`.
2. The dashboard shows the estimate next to the button. MCP and REST expose estimate tools or
   return the estimate in a refusal.
3. Large jobs (rank tracker runs, audits with Lighthouse, AI visibility runs) require an explicit
   confirmation of the estimate. Scheduled jobs carry an approval ceiling set by the user, as in
   OpenSEO's rank tracker.

---

## 6. Caps

- **Balance never goes negative.** A call reserves its estimate first in one transaction; if the
  monthly plus purchased balance is below the estimate, the call is refused before any provider
  request. This is the hard spend cap.
- If the actual cost exceeds the estimate, the customer is charged only the estimate they were
  shown (`settleReservation` caps the charge); IndexFast absorbs the difference, and the provider
  cost recorded in `provider_cost_micro_usd` shows it so estimates can be tuned.
- A reservation left open by a request that died mid-call is refunded by the hourly cron after
  30 minutes (`releaseStaleReservations`).
- Per-request concurrency to DataForSEO is bounded (OpenSEO uses 4 pending calls per request
  scope; we start with the same).
- Platform kill switch: removing the `DATAFORSEO_*` secrets stops all platform-paid calls.

---

## 7. Bring your own key (BYOK)

- An org may store its own DataForSEO login in `provider_credentials`, encrypted with AES-GCM via
  `src/lib/automation/credentials.ts`.
- When present, calls use the org's login. DataForSEO bills the org directly; IndexFast charges
  0 provider credits.
- Ledger rows are still written (`byok = true`, `credits = 0`, the reported provider cost) so the
  org sees its usage.
- Stored credentials are validated on save, masked in the UI (`label`), and never returned to
  clients, MCP or REST.
- BYOK responses are not written to the shared cache.

---

## 8. Failure handling

| Outcome | Ledger |
|---|---|
| Success | `reserve` (estimate) then `settle` at the reported cost |
| Provider error that DataForSEO still charged (reported `cost > 0`) | `settle` at the reported cost |
| Uncharged failure (network error, timeout before the request, 5xx with `cost = 0`, validation error) | `release` the full reservation |
| Task posted, collection fails | Already settled at `task_post`; `task_get` is retried without new charges |
| Worker crash between reserve and settle | Reservations older than a timeout are released by the cron unless a provider task id shows the call was charged |

Paid Workflow steps do not retry automatically after a charge, so one user action is never billed
twice.

---

## 9. Usage visibility

- `/dashboard/billing` shows the monthly and purchased balance, the reset date and the ledger
  (date, feature, endpoint, credits, BYOK flag, who triggered it). In progress (this branch).
- MCP and REST paid results include credits charged and remaining balance.
- `/admin` will show platform provider spend per day from the ledger (Planned).
- Grants and purchases are idempotent through the unique `(organization_id, ref)` index (for
  example `ref = 'grant:2026-11'` or the Razorpay order id).

---

## 10. Free public tools

- Free tools under `/tools/*` never call paid providers. They use our own fetches (robots,
  sitemaps, headers, on-page checks) and free Google endpoints within their quotas.
- No free tool is backed by the platform DataForSEO login, so there is no anonymous spend path.
- Public free-tool actions still need rate limiting for outbound fetch abuse (Planned; see
  `docs/DEPLOYMENT-ARCHITECTURE.md` bindings).

---

## 11. Credit top-ups

Credit packs bought with Razorpay one-time Orders: Planned. They will reuse the existing order
flow, with `activatePaidOrder()` branching on the order kind and inserting one `purchase` ledger
row keyed on the order id, so a replayed webhook never grants credits twice. Refunds remove only
unspent purchased credits.
