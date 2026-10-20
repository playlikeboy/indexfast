# Billing, plans and expiry

Source of truth: `src/lib/platform/plans.ts`. Razorpay logic: `src/lib/platform/razorpay.ts`
(pure client + signatures) and `src/lib/platform/razorpay-billing.ts` (DB state machine).

## Plans

| Plan | Price | Sites | URLs per site | Sitemap check | API + MCP calls | Bing API |
|---|---|---|---|---|---|---|
| Free | $0 | 1 | 500 | every 24h | 300 / month | no |
| Pro | $19 / 30 days | 10 | 10,000 | hourly | 20,000 / month | yes |
| Unlimited | $99 / 30 days | unlimited | 50,000 per sync (fair use) | hourly | unlimited | yes |

Legacy tiers `indie`, `growth`, `agency`, `scale` (Dodo era) are **hidden, not removed**.
They map to Pro (`indie`, `growth`) or Unlimited (`agency`, `scale`) limits so existing
subscribers keep working. Never delete them from `PLANS`.

MCP tool calls count toward the monthly quota; `initialize`, `tools/list` and notifications do not.

## Why prepaid Orders instead of Razorpay Subscriptions

Each payment buys a fixed 30-day period. That keeps expiry fully under our control, works
for international cards without e-mandates, and makes renew/upgrade one checkout.
There is no auto-charge; users get reminders instead.

## Payment flow

1. `createCheckoutAction(plan)` -> `createCheckoutOrder()` creates a Razorpay Order
   (`notes.app = "indexfast"`, `notes.userId`, `notes.plan`) and a `payments` row (`created`).
2. The browser opens Razorpay Checkout (`components/app/RazorpayCheckout.tsx`).
3. On success two independent paths call `activatePaidOrder()`:
   - client -> `confirmPaymentAction()` verifies `HMAC_SHA256(order_id|payment_id, key_secret)`;
   - Razorpay -> `POST /api/webhooks/razorpay` verifies `HMAC_SHA256(raw body, webhook secret)`.
4. `activatePaidOrder()` flips the payment to `paid` with a conditional UPDATE, so the
   period is granted exactly once, then sets `users.billingTier` and `users.planExpiresAt`.

Webhook events handled: `payment.captured`, `order.paid` (activate), `payment.failed`
(mark failed), `refund.processed` / `refund.created` (full refund -> `refunded`, entitlement
recomputed from remaining paid periods). Every event is stored in `billing_events`
(`event_id = razorpay:<x-razorpay-event-id>`) which also makes replays a no-op.

The Razorpay account may be shared with other apps. Events whose `order_id` is not in
`payments` are recorded and ignored (200 OK so Razorpay stops retrying).

## Periods

- Renewing the **same** plan stacks onto the remaining time (`computeNextPeriod`).
- Switching plan starts immediately (upgrade takes effect on payment).
- After full expiry the next purchase starts from now.

## Expiry policy (what happens when a plan ends)

Implemented in `resolveEntitlement()` (read time) and `downgradeExpiredPlans()` (hourly cron).

1. **Active** until `planExpiresAt`. Dashboard banner from 5 days before the end.
2. **Grace** for `PLAN_GRACE_DAYS` (3) days: full paid limits, red renew banner.
3. **Expired**: limits become Free immediately at read time; the cron later sets
   `billingTier = 'free'` (keeping `planExpiresAt` so the UI can say when it ended).
   - Nothing is deleted.
   - Sites beyond the Free limit are **paused** (oldest site stays active): the cron skips
     them, manual submit/sync is refused with an upgrade message.
   - URL cap and sync interval fall to Free values; extra API keys stay but count toward the limit.
4. Paying again restores everything instantly.
5. A paid tier with `planExpiresAt = NULL` is a legacy Dodo subscription and never expires here.

## Configuration

```
RAZORPAY_KEY_ID=            # server + returned to the browser per order
RAZORPAY_KEY_SECRET=        # server only
RAZORPAY_WEBHOOK_SECRET=    # webhook signing secret set in the Razorpay dashboard
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_CURRENCY=USD       # optional, default USD
RAZORPAY_PRICE_PRO=         # optional, minor units, overrides 1900 (e.g. INR paise)
RAZORPAY_PRICE_UNLIMITED=   # optional, minor units, overrides 9900
```

Webhook URL: `https://indexfast.co/api/webhooks/razorpay`. Enable at least
`payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.

If the Razorpay account cannot accept USD (international payments disabled), set
`RAZORPAY_CURRENCY=INR` and both `RAZORPAY_PRICE_*` values in paise.

## DodoPayments (hidden)

`/api/checkout`, `/api/customer-portal`, `/api/webhooks/dodo` and `lib/platform/billing.ts`
remain so legacy subscribers keep syncing. They are not linked anywhere in the UI.
Do not build new features on them.

## Support

Admins can grant or remove a plan for N days from `/admin` ("Grant a plan").
