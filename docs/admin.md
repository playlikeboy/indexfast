# Admin panel

Route: `/admin`. Access: Stack Auth user whose **verified** primary email is in
`ADMIN_EMAILS` (comma separated, currently `sh20raj@gmail.com`). Everyone else gets 404.
Check lives in `src/lib/auth.ts` (`isAdmin`, `requireAdmin`); server actions re-check it.

## Sections (`src/db/admin-queries.ts`)

- **Business**: MRR (list price of plans in active/grace), revenue in range and all time
  (per currency, from `payments`), users (total, new, active 7d via `users.last_seen_at`), plan mix.
- **Traffic**: page views per day, daily-unique visitors, top pages, referrers, countries,
  devices. Range 7/30/90 days.
- **Product**: sites (live/verified), URLs tracked and found this week, submissions (7d,
  success rate), queue depth, API calls (7d).
- **Health**: last 12 `cron_runs`, failing sitemaps.
- **Payments**: recent Razorpay payments.
- **Users**: newest 50 with plan, expiry, site and URL counts.
- **Grant a plan**: support tool (`adminGrantPlanAction`).

## Analytics privacy

`/api/track` stores path, referrer host, `cf-ipcountry`, device class and a daily-rotating
SHA-256 of ip + UA + server secret. No cookies, no raw IPs, bots and `/admin` are dropped.
