# Dashboard and admin UI

Audience: vibe coders. Principle: one obvious next step per screen, no jargon up front.

## Screens

| Route | Purpose |
|---|---|
| `/dashboard` | Empty: one domain input (onboarding). Otherwise: totals row, then sites (ones needing attention first) with status and counts. |
| `/dashboard/sites/[siteId]` | Section nav via `?view=`: **Overview** (setup card until verified, search-engine health, stats, submit/retry bar, issues, quick submit, activity), **URLs** (`?tab=` all/pending/submitted/failed/new, search, pagination), **Queue** (jobs and cooldowns), **Sitemaps**, **Settings** (automation, IndexNow key re-check, Bing, delete). Legacy `?tab=queue` opens Queue. |
| `/dashboard/connect` | Create MCP/API key; editor snippets are filled with the new key; REST examples; key list. |
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
- `src/components/app/ui.tsx` - server-safe primitives (Card, Badge, Stat, Code, buttons with
  focus rings, `statusLabel`, formatters).
- `src/components/app/toast.tsx` - toasts for one-click `ActionButton` results (inline results
  used to reflow headers and table rows). Form results (`ActionForm`) stay inline.
- `src/components/app/client.tsx` - `ActionForm`, `ActionButton`, `CopyButton`, `CodeBlock`, `Tabs`.
- `src/components/app/AppShell.tsx` - header, nav, plan banner (visible half of the expiry policy).
- `src/db/app-queries.ts` - read queries, all scoped by userId.
- `src/app/actions.ts` - mutations; every action returns `ActionResult` instead of throwing.

## Conventions

- Theme tokens: `--app-*` in `globals.css` (light + dark). Lime accent only for the primary action.
- Topbar logo: `public/logo-mark.png`, a 128px crop of `public/logo.png` (the original is
  1254px / 695 KB, too heavy for a 28px icon). Regenerate with sharp if the logo changes.
- Landing hero shows `public/IndexFast-Editorial-v2.mp4` with `preload="metadata"` and a
  `#t=4` poster frame, so the 9 MB file only downloads when played.
- Mutations: `ActionButton action={someAction.bind(null, id)}` or `ActionForm` with `useActionState`.
- Status is never color-only: badges carry text.
- Engine health (IndexNow/Bing: sending, rate limited until, key failing) is shown on Overview so users always see why nothing went out.
- Analytics beacon: `PageViewTracker` in the root layout posts to `/api/track` on route change.
