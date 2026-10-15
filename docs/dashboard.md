# Dashboard and admin UI

Audience: vibe coders. Principle: one obvious next step per screen, no jargon up front.

## Screens

| Route | Purpose |
|---|---|
| `/dashboard` | Empty: one domain input (onboarding). Otherwise: list of sites with status and counts. |
| `/dashboard/sites/[siteId]` | Setup card (until verified) -> stats -> issues -> URL list (tabs New/Pending/Submitted/Failed, search, pagination) -> sitemaps + activity -> collapsed settings. |
| `/dashboard/connect` | Create MCP/API key; editor snippets are filled with the new key; REST examples; key list. |
| `/dashboard/billing` | Current plan + expiry, Pro/Unlimited via Razorpay, expiry policy, payment history. |
| `/admin` | Admin only (see docs/admin.md). |

Old routes (`/dashboard/mcp`, `/api-keys`, `/alerts`, `/submissions`, `/sites/:id/settings`)
redirect via `next.config.ts`.

## Code layout

- `src/components/app/ui.tsx` - server-safe primitives (Card, Badge, Stat, buttons, formatters).
- `src/components/app/client.tsx` - `ActionForm`, `ActionButton`, `CopyButton`, `CodeBlock`, `Tabs`.
- `src/components/app/AppShell.tsx` - header, nav, plan banner (visible half of the expiry policy).
- `src/db/app-queries.ts` - read queries, all scoped by userId.
- `src/app/actions.ts` - mutations; every action returns `ActionResult` instead of throwing.

## Conventions

- Theme tokens: `--app-*` in `globals.css` (light + dark). Lime accent only for the primary action.
- Mutations: `ActionButton action={someAction.bind(null, id)}` or `ActionForm` with `useActionState`.
- Status is never color-only: badges carry text.
- Analytics beacon: `PageViewTracker` in the root layout posts to `/api/track` on route change.
