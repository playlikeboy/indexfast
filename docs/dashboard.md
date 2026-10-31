# Dashboard and admin UI

Audience: vibe coders. Principle: one obvious next step per screen, no jargon up front.

## Screens

| Route | Purpose |
|---|---|
| `/dashboard` | Empty: one domain input (onboarding). Otherwise: totals row, then sites (ones needing attention first) with status and counts. |
| `/dashboard/sites/[siteId]` | Section nav via `?view=`: **Overview** (setup card until verified, search-engine health, stats, submit/retry bar, issues, quick submit, activity), **URLs** (`?tab=` all/pending/submitted/failed/new, search, pagination), **Queue** (jobs and cooldowns; `skipped` jobs were never sent and carry the reason), **Sitemaps**, **Settings** (automation, IndexNow key re-check, Bing, optional engines: Search Console, Google Indexing API, Yandex, Baidu; delete). Legacy `?tab=queue` opens Queue. |
| `/dashboard/connect` | Create MCP/API key; editor snippets are filled with the new key; REST examples; key list; Google account connection (OAuth via `/api/integrations/google/start`) and disconnect. |
| `/dashboard/billing` | Current plan + expiry, Pro/Unlimited via Razorpay, expiry policy, payment history. |
| `/admin` | Admin only (see docs/admin.md). |

Old routes (`/dashboard/mcp`, `/api-keys`, `/alerts`, `/submissions`, `/sites/:id/settings`)
redirect via `next.config.ts`.

## Code layout

- Each page under `src/app/dashboard` and `src/app/admin` is a thin loader; the markup lives
  in `src/components/app/views/*View.tsx` and renders purely from loaded data. That split
  lets views be screenshotted locally with fixture data (no auth, no DB) for design review:
  add a temporary dev-only route that renders a view inside `AppShell`, shoot it with
  headless Chromium, and delete the route before committing.
- `src/components/ui` - the Cobalt primitives (Panel, Button, Status/Badge, Table, Tabs, CodeBlock, Stat,
  EmptyState, Container). New code imports these from `@/components/ui`.
- `src/components/app/ui.tsx` - thin adapter over `@/components/ui` that keeps the old names (Card, Badge,
  Stat, PageHeader) plus `statusLabel` and formatters.
- `src/components/app/toast.tsx` - toasts for one-click `ActionButton` results (inline results
  used to reflow headers and table rows). Form results (`ActionForm`) stay inline.
- `src/components/app/client.tsx` - `ActionForm`, `ActionButton`, `CopyButton`, `CodeBlock`, `Tabs`.
- `src/components/app/AppShell.tsx` - header, nav, plan banner (visible half of the expiry policy). Its
  root carries `data-scope="app"` (fixed 1.2 type scale, app gutter) and content sits in `Container width="app"`.
- `src/components/app/views/site/Engines.tsx` - per-site optional engines; `EngineHealth.tsx` - Overview health.
- `src/db/app-queries.ts` - read queries, all scoped by userId.
- `src/app/actions.ts` - mutations; every action returns `ActionResult` instead of throwing.

## Conventions

- Theme: Cobalt tokens from `globals.css` via utilities (`bg-panel`, `text-ink`, `text-muted`, `border-rule`);
  rules in `DESIGN.md`. The old `--app-*` tokens are deleted. Cobalt accent only for the primary action.
- Topbar logo: `public/logo-mark.png`, a 128px crop of `public/logo.png` (the original is
  1254px / 695 KB, too heavy for a 28px icon). Regenerate with sharp if the logo changes.
- Landing hero shows `public/IndexFast-Editorial-v2.mp4` with `preload="metadata"` and a
  `#t=4` poster frame, so the 9 MB file only downloads when played.
- Mutations: `ActionButton action={someAction.bind(null, id)}` or `ActionForm` with `useActionState`.
- Status is never color-only: badges carry text.
- Engine health (IndexNow, Bing, Yandex, Baidu, Google: sending, rate limited until, key failing) is shown on Overview so users always see why nothing went out.
- Analytics beacon: `PageViewTracker` in the root layout posts to `/api/track` on route change.
