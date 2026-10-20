---
name: indexfast
description: Use IndexFast for agentic SEO operations: indexing health checks, sitemap discovery, IndexNow/Bing submissions, diagnostics, alerts, directory resources, and CLI/MCP/API workflows.
---

# IndexFast

Use this skill when a user wants to improve search visibility, audit indexing problems, submit changed URLs safely, connect SEO workflows to an AI IDE, or operate IndexFast through API, MCP, or CLI.

## Setup

- API base: `https://indexfast.co/api/v1`
- MCP endpoint: `https://indexfast.co/api/mcp`
- Auth: `Authorization: Bearer <INDEXFAST_API_KEY>`
- CLI install: `curl -fsSL https://indexfast.co/install.sh | sh`

## Safe SEO Rules

- Never promise guaranteed Google indexing.
- Use Google Indexing API only for eligible `JobPosting` or livestream `BroadcastEvent` pages.
- Use IndexNow/Bing as discovery signals, not ranking guarantees.
- Diagnose crawlability before submitting URLs.
- Do not spam third-party directories; prioritize relevant, high-quality channels.

## Common Workflows

### pSEO Launch Audit

1. List connected sites.
2. Discover and sync sitemaps.
3. Run diagnostics on representative URLs.
4. Submit new or changed URLs through verified engines.
5. Recommend P0/P1 launch directories and AI visibility resources.

### Indexing Recovery

1. List alerts and recent failed submissions.
2. Inspect URLs marked `blockers`, `not_indexed`, or failed.
3. Check HTTP status, noindex, canonical, robots rules, and sitemap presence.
4. Submit only URLs that are technically indexable.

### Agentic SEO Setup

1. Create an IndexFast key at `https://indexfast.co/dashboard/connect` (works on every plan, including Free).
2. Copy and add the generated MCP server config block to the user's AI IDE config (Cursor, Claude Desktop).
3. Use IndexFast resources and MCP tools to automate site indexing checks.

## CLI Commands (Zero-install)

```bash
npx indexfast login --api-key "$INDEXFAST_API_KEY"
npx indexfast site add example.com --name "Example"
npx indexfast sitemap discover --site SITE_ID
npx indexfast sitemap sync --site SITE_ID
npx indexfast submit --site SITE_ID https://example.com/page
npx indexfast diagnose --site SITE_ID https://example.com/page
npx indexfast resources directories --priority P0
npx indexfast mcp install
```

### CI/CD Integration

You can use the CLI in GitHub Actions or Vercel deployments:
1. Export `INDEXFAST_API_KEY` as a secret.
2. Run `npx indexfast sitemap sync --site <ID>` post-build to guarantee up-to-date sitemaps.

## MCP Tools

Every `site` argument accepts the domain (e.g. `example.com`) or the site id.

- `account_status` - plan, limits, expiry, and all sites. Call first.
- `add_site` - add by domain; discovers sitemaps, imports URLs, returns the key file to create.
- `get_site` - status, setup steps, sitemaps, URL counts, open issues.
- `verify_site` - confirms the key file is live, turns on auto-submit, submits pending URLs. If the site already hosts an IndexNow key, pass `existingKey` (the key or its file URL) and skip creating a new file.
- `add_sitemap`, `discover_sitemaps`, `sync_now`
- `submit_urls` - submit up to 1000 URLs now (after publishing or updating pages).
- `submit_pending` - submit every URL that was never submitted.
- `list_urls` - filter `all | new | pending | submitted | failed`.
- `list_submissions`, `check_url`, `list_issues`
- `recommend_seo_resources`, `list_directories`, `list_seo_tools`

Older names (`list_sites`, `sync_sitemap`, `submit_url`, `bulk_submit_urls`, `run_diagnostics`, `list_alerts`) still work as aliases.

## Setup flow for a project in the current repo

1. `add_site { "domain": "<production domain>" }`
2. Create the returned key file in the project's public/static folder: exact file name, content is only the key.
3. Ask the user to deploy, then `verify_site { "site": "<domain>" }`.
4. After publishing pages later: `submit_urls`.
