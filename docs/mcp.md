# MCP server

Endpoint: `POST https://indexfast.co/api/mcp` (Streamable HTTP, stateless JSON responses).
Auth: `Authorization: Bearer idxf_...` (create at `/dashboard/connect`). Available on every
plan; tool calls count toward the monthly quota.

Code: `src/app/api/mcp/route.ts` (HTTP), `src/lib/mcp/server.ts` (JSON-RPC), tools delegate to
`src/lib/platform/operations.ts`. Never put business logic in the MCP layer.

## Protocol behaviour

- `initialize` echoes the client's protocol version if supported
  (`2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`), else the latest, and returns
  `instructions` describing the setup flow.
- Notifications (no `id`, or `notifications/*`) -> HTTP 202, empty body.
- `GET` with `Accept: text/event-stream` -> 405 (no server-initiated stream). Plain GET returns info JSON.
- Tool failures are returned as `result.isError = true` with the message, so agents can react.
- Supports `ping`, `tools/*`, `resources/list`, `resources/templates/list`, `resources/read`, `prompts/*`.

## Tools

Every `site` argument accepts a domain or a site id.

| Tool | Purpose |
|---|---|
| `account_status` | Plan, limits, expiry, all sites |
| `add_site` | Add by domain, discover + sync, returns key file instructions |
| `get_site` | Status, setup, sitemaps, URL counts, issues |
| `verify_site` | Check key file, enable automation, submit backlog. Optional `existingKey` (key or key file URL) reuses a key the site already hosts |
| `add_sitemap` / `discover_sitemaps` / `sync_now` | Sitemap management |
| `submit_urls` / `submit_pending` | Manual submission |
| `list_urls` | Filter `all/new/pending/submitted/failed` |
| `list_submissions` / `check_url` / `list_issues` | Debugging |
| `recommend_seo_resources` / `list_directories` / `list_seo_tools` | Launch resources |

Aliases for v0 names: `list_sites`, `sync_sitemap`, `submit_url`, `bulk_submit_urls`,
`run_diagnostics`, `list_alerts`.

Prompts: `setup_indexing` (domain), `indexing_recovery_plan` (domain), `launch_distribution_plan`.

## Client config

```bash
claude mcp add --transport http indexfast https://indexfast.co/api/mcp --header "Authorization: Bearer $KEY"
```

Cursor `~/.cursor/mcp.json`:
```json
{ "mcpServers": { "indexfast": { "url": "https://indexfast.co/api/mcp", "headers": { "Authorization": "Bearer KEY" } } } }
```

VS Code `.vscode/mcp.json` uses `{ "servers": { "indexfast": { "type": "http", ... } } }`;
Windsurf uses `serverUrl` instead of `url`.
