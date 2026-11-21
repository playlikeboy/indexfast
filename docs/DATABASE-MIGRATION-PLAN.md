# Database migration plan

Purpose: this document describes the current Postgres schema, the canonical data model for the
SEO platform, which migration adds each entity, and how migration 0011 is applied, verified and
rolled back. It is binding for every schema change on `feat/seo-platform` and later branches.
Schema source: `src/db/schema.ts`. Migrations: `drizzle/*.sql`, applied by `bun run db:migrate`
(`src/db/migrate.ts`, Neon WebSocket driver, all pending files in one transaction).

---

## 1. Rules

1. **Additive first.** New tables, new nullable columns, new indexes. No drops, renames or type
   changes in the same release that stops using the old shape.
2. **Old code keeps working.** Migrations run before the code that reads them deploys
   (`docs/deployment.md`), so every migration must be safe for the currently deployed code.
3. **Never drop in the same release.** A column or table is dropped at the earliest one release
   after nothing reads it, in its own migration, after a fresh Neon snapshot.
4. **Backfills.** Small backfills (one row per user or per site) may live inside the migration.
   Large backfills (anything over `urls`, `submission_jobs`, `submissions`, `checks`, or any table
   that can hold millions of rows) run as a separate batched script outside `db:migrate`, because
   `db:migrate` applies everything in one transaction and a long one can lock the queue while the
   hourly cron is claiming jobs. Pause the cron (or deploy between runs) for such scripts.
5. **NOT NULL in a second step.** A new tenant column is nullable, backfilled, then made NOT NULL
   in a later migration once all writers set it.
6. **Idempotent backfills.** Use `WHERE NOT EXISTS` / `ON CONFLICT DO NOTHING` so a re-run is a
   no-op.
7. **Snapshot before apply.** Create a Neon branch of production before every production
   migration (section 6).
8. **No raw SQL in app code.** Migrations are SQL; application code uses the Drizzle query builder.
9. **Docs move with code.** Update `AGENTS.md` section 6 and this file in the same change.

---

## 2. Current tables (through 0010)

| Table | Tenant column | Notes |
|---|---|---|
| `users` | `id` (Stack user id) | Holds `billingTier`, `planExpiresAt` (entitlement) |
| `payments` | `user_id` | Razorpay order ledger, unique `order_id` |
| `page_views`, `conversion_events`, `contact_messages` | optional `user_id` | Analytics and public forms |
| `cron_runs` | none | System |
| `api_keys`, `api_usage_events` | `user_id` | Hashed keys; monthly quota per user |
| `billing_customers`, `subscriptions` | `user_id` | Dodo history only |
| `billing_events` | `user_id` nullable | Webhook audit |
| `sites` | `user_id` | Unique `(user_id, domain)` |
| `site_sitemaps`, `site_integrations`, `sitemaps`, `urls`, `submission_jobs`, `submissions`, `alerts` | `site_id` | Reached through `sites.user_id` |
| `checks` | `url_id` | Two hops: url, site, user |
| `user_integrations` | `user_id` | Bing, Google, Yandex credentials |
| `engine_quota_usage` | none (`quota_key`) | Per GSC property or Google project, global by design |
| `google_integrations` | `site_id` | Unused; drop in a later migration |

---

## 3. Canonical data model

"Tenancy" lists the columns every query filters on. "Migration" is where the entity lands.
Numbers after 0011 are placeholders: the real number is whatever is next when the work merges.

| Entity | Table(s) | Tenancy | Migration | Status |
|---|---|---|---|---|
| Users | `users` | self | existing | Done |
| Organizations | `organizations` (id, name, owner_user_id, personal, credit_period, monthly_credits, purchased_credits) | id | 0011 | In progress (this branch) |
| Membership | `organization_members` (organization_id, user_id, role owner/admin/member) | organization_id | 0011 | In progress (this branch) |
| Invitations | `organization_invitations` (organization_id, email, role, token hash, expires_at) | organization_id | Phase 6 | Planned |
| Sites / projects | `sites` + `organization_id` nullable | organization_id (new), user_id (creator, indexing owner) | 0011 adds column and backfill; NOT NULL and `(organization_id, domain)` unique in Phase 6 | In progress (this branch) |
| Domains + verification | `sites.verified`, `site_integrations` (indexnow key); exclusive-verification rule in code | via site | existing; rule in this branch (no schema change) | In progress (this branch) |
| URLs | `urls` | via site | existing | Done |
| Sitemaps | `site_sitemaps`, `sitemaps` | via site | existing | Done |
| Keywords (saved, with metrics snapshot) | `saved_keywords` (organization_id, site_id, keyword, location_code, language_code, metrics, tags) | organization_id + site_id | 0011 | In progress (this branch) |
| Keyword lists | `keyword_lists`, `keyword_list_items` (or tags on `saved_keywords` until needed) | organization_id + site_id | Phase 3 | Planned |
| Rank tracking config | `rank_trackers` (organization_id, site_id, devices, depth, schedule, location, language) and `rank_tracker_keywords` | organization_id + site_id | Phase 3 | Planned |
| Rank history | `rank_check_runs` (organization_id, site_id, status, counts), `rank_snapshots` (run_id, keyword_id, device, checked_on, position, url, serp_features), unique `(keyword_id, device, checked_on)` | run carries tenant; snapshot via run | Phase 3 | Planned |
| Competitors | `site_competitors` (organization_id, site_id, domain, source manual/agent/serp) | organization_id + site_id | Phase 3 | Planned |
| Backlink snapshots | `backlink_snapshots` (organization_id, site_id, domain, rank, backlinks, referring_domains, new/lost, captured_at) | organization_id + site_id | Phase 4 | Planned |
| Crawls | `audits` (organization_id, site_id, status, workflow_instance_id, config, counters, r2 prefix), `audit_pages` (audit_id, url, status, meta, links, flags) | audit carries tenant; pages via audit | Phase 5 | Planned |
| Audit findings | `audit_issues` (audit_id, organization_id, page_id, issue_type, severity, details, state open/snoozed/accepted) | organization_id + audit_id | Phase 5 | Planned |
| Crawl frontier | `audit_frontier` (audit_id, url_hash, url, depth, state) | via audit | Phase 5 | Planned |
| Lighthouse / CWV | `audit_vitals` (audit_id, page_id, strategy, scores, lcp, cls, inp, ttfb, source lab/field) | via audit | Phase 5 | Planned |
| GSC connection | `user_integrations` provider `google` (token), `site_integrations` provider `gsc` (property) | user / site | existing | Done |
| GSC search analytics | `gsc_search_rows` (organization_id, site_id, date, query, page, device, country, clicks, impressions, ctr, position) | organization_id + site_id | Phase 6 | Planned |
| GA4 connection | `site_integrations` provider `ga4` (property id) | via site | Phase 6 | Planned |
| AI visibility | `ai_trackers` (organization_id, site_id, engines, schedule), `ai_prompts`, `ai_runs` (organization_id), `ai_observations`, `ai_sources`, `ai_matches` | tracker/run carry tenant; children via run | Phase 6 | Planned |
| API keys | `api_keys` + `organization_id` | user_id now; organization_id in Phase 6 | Phase 6 | Planned |
| MCP credentials | `api_keys` with `mcp:use` scope (no separate table; MCP uses API keys) | as API keys | existing | Done |
| Provider credentials (BYOK) | `provider_credentials` (organization_id, provider, encrypted_secret, label, last_validated_at, last_error) | organization_id | 0011 | In progress (this branch) |
| Provider cache | `provider_cache` (key sha256, provider, endpoint, payload, expires_at) | none, shared on purpose: public search data only, never tenant data | 0011 | In progress (this branch) |
| Usage ledger | `credit_ledger` (organization_id, user_id, site_id, kind, feature, provider, endpoint, credits signed, provider_cost_micro_usd, byok, ref, metadata) unique `(organization_id, ref)` | organization_id | 0011 | In progress (this branch) |
| API usage | `api_usage_events` + `organization_id` | user_id now | Phase 6 | Planned |
| Billing | `payments` (+ `kind` plan/credits, + `organization_id`) | user_id now | Phase 4 (kind), Phase 6 (org) | Planned |
| Notifications | `notification_channels` (organization_id, kind email/webhook, target, secret encrypted), `notification_deliveries` | organization_id | Phase 7 | Planned |
| Alerts | `alerts` | via site | existing | Done |
| Reports | `reports` (organization_id, site_id, html, share_token_hash, expires_at), `report_templates` | organization_id + site_id | Phase 7 | Planned |
| Jobs | `submission_jobs` (existing); `seo_jobs` (organization_id, site_id, kind, state, provider_task_id, next_poll_at, attempts) for task_post/task_get polling | organization_id + site_id | Phase 3 | Planned |

Notes:
- `credit_ledger.provider_cost_micro_usd` stores the provider cost as an integer in millionths of
  a USD, so sums are exact. Credits derive from it (`docs/PROVIDER-COST-MODEL.md`).
- Child tables without a tenant column are reached only through their checked parent
  (`docs/SEO-PLATFORM-ARCHITECTURE.md` section 4.2).

---

## 4. Migration 0011 (`drizzle/0011_organizations_credits.sql`)

Status: In progress (this branch). Not applied to production.

Contents:
1. Create `organizations`, `organization_members`, `credit_ledger`, `provider_cache`,
   `provider_credentials`, `saved_keywords` with foreign keys and indexes, including:
   - partial unique `organizations_personal_owner_unique_idx` on `owner_user_id WHERE personal = true`
     (exactly one personal org per user);
   - unique `organization_members_org_user_unique_idx (organization_id, user_id)`;
   - unique `credit_ledger_org_ref_unique_idx (organization_id, ref)` (idempotent grants and
     purchases);
   - unique `saved_keywords_site_kw_unique_idx (site_id, keyword, location_code, language_code)`.
2. `ALTER TABLE sites ADD COLUMN organization_id uuid` (nullable, FK `ON DELETE SET NULL`) plus
   index `sites_organization_idx`.
3. Backfill (idempotent, small: one row per user and one update per site):
   - one personal organization per existing user;
   - one `owner` membership per personal organization;
   - every site with null `organization_id` set to its creator's personal organization.

New users after deploy get their personal org lazily on login (next to `ensureUserRow`), so the
backfill only has to cover users that exist when 0011 runs.

---

## 5. Verification queries (run after apply, on the snapshot branch first)

```sql
-- Every user has exactly one personal organization.
SELECT count(*) AS users_without_personal_org
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.owner_user_id = u.id AND o.personal);

SELECT owner_user_id, count(*) FROM organizations WHERE personal GROUP BY 1 HAVING count(*) > 1;

-- Every personal org has its owner as an 'owner' member.
SELECT count(*) AS personal_orgs_without_owner_member
FROM organizations o
WHERE o.personal AND NOT EXISTS (
  SELECT 1 FROM organization_members m
  WHERE m.organization_id = o.id AND m.user_id = o.owner_user_id AND m.role = 'owner');

-- Every site is attached, and to its creator's org.
SELECT count(*) AS sites_without_org FROM sites WHERE organization_id IS NULL;

SELECT count(*) AS sites_in_wrong_org
FROM sites s JOIN organizations o ON o.id = s.organization_id
WHERE o.owner_user_id <> s.user_id;

-- Row counts for the record.
SELECT (SELECT count(*) FROM users) AS users,
       (SELECT count(*) FROM organizations) AS orgs,
       (SELECT count(*) FROM organization_members) AS members,
       (SELECT count(*) FROM sites) AS sites;
```

Expected: every count is 0 except the last row; `orgs` equals `users` right after apply.

---

## 6. Backup and apply procedure

Production changes need the owner's explicit approval. Steps:

1. Create a Neon branch from production (Neon console or `neonctl branches create
   --name pre-0011-<date>`). This is the snapshot and the rollback source.
2. Run `bun run db:migrate` with `DATABASE_URL` pointing at a second, disposable branch first.
   Run section 5 queries. Run the app against it (`bun run dev`).
3. With approval, run `bun run db:migrate` against production.
4. Run section 5 queries against production.
5. Deploy the code that reads the new tables only after step 4 passes.
6. Keep the snapshot branch for at least 14 days.

Note: `.github/workflows/deploy.yml` runs `bun run db:migrate` and deploys on every push to
`main`. Merging this branch to `main` is therefore a production migration and deploy, and needs
the same approval and snapshot first.

---

## 7. Rollback

0011 is additive, so the deployed code from before this branch ignores the new objects. Rollback
options, least destructive first:

1. **Code rollback only.** Roll back the Worker (`docs/DEPLOYMENT-ARCHITECTURE.md`). Leave the
   tables in place. No data loss.
2. **Schema rollback** (only if the tables themselves cause trouble). This drops credit history
   and saved keywords created since deploy, so export them first:

```sql
BEGIN;
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_organization_id_organizations_id_fk;
DROP INDEX IF EXISTS sites_organization_idx;
ALTER TABLE sites DROP COLUMN IF EXISTS organization_id;
DROP TABLE IF EXISTS saved_keywords;
DROP TABLE IF EXISTS provider_credentials;
DROP TABLE IF EXISTS provider_cache;
DROP TABLE IF EXISTS credit_ledger;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS organizations;
DELETE FROM drizzle.__drizzle_migrations
WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);  -- the 0011 journal row; confirm before running
COMMIT;
```

3. **Full restore.** Restore from the pre-0011 Neon branch (loses all writes since the snapshot,
   including payments; last resort only).

---

## 8. Later migrations (outline)

| Phase | Change | Backfill size | Approach |
|---|---|---|---|
| 3 | Rank tracking, competitors, `seo_jobs` tables | none | Additive |
| 4 | `payments.kind`, `backlink_snapshots` | small | Additive; default `kind = 'plan'` |
| 5 | Audit tables | none | Additive |
| 6 | `organization_id` on `api_keys`, `api_usage_events`, `payments`; `sites.organization_id` NOT NULL; `(organization_id, domain)` unique; entitlement columns on `organizations` | `api_usage_events` can be large | Columns in one migration, batched backfill script, constraints in a later migration |
| later | Drop `google_integrations`; drop `users.billingTier` / `planExpiresAt` only after a release reads entitlement from orgs | - | Separate release, fresh snapshot |
