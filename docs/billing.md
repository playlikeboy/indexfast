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

MCP `tools/call` and `resources/read` count toward the monthly quota, one unit per entry even
inside a JSON-RPC batch; `initialize`, listings and notifications do not. Batches are capped at
20 entries (`MCP_MAX_BATCH` in `http.ts`).

Quota is reserve-then-check (`reserveApiUsage` in `api-keys.ts`): usage rows are inserted
before the handler runs, and the request is refused with 429 (rows removed) when this month's
count including them is over quota. Concurrent requests therefore cannot all slip past the
last unit. The final HTTP status is written back by `finalizeApiUsage`.

## Why prepaid Orders instead of Razorpay Subscriptions

Each payment buys a fixed 30-day period. That keeps expiry fully under our control, works
for international cards without e-mandates, and makes renew/upgrade one checkout.
There is no auto-charge; users get reminders instead.

## Payment flow

1. `createCheckoutAction(plan)` -> `createCheckoutOrder()` creates a Razorpay Order
   (`notes.app = "indexfast"`, `notes.userId`, `notes.plan`) and a `payments` row (`created`).
2. The browser opens Razorpay Checkout (`components/app/RazorpayCheckout.tsx`).
3. On success two independent paths call `activatePaidOrder()`:
   - client -> `confirmPaymentAction()` verifies `HMAC_SHA256(order_id|payment_id, key_secret)`,
     then fetches the payment and activates only if it is `captured` for that order (an
     authorized-but-uncaptured payment is left to the `payment.captured` webhook);
   - Razorpay -> `POST /api/webhooks/razorpay` verifies `HMAC_SHA256(raw body, webhook secret)`.
4. `activatePaidOrder()` runs one neon-http batch (a single transaction): a conditional
   UPDATE flips the payment to `paid` (so the period is granted exactly once), one UPDATE on
   `users` computes the new `planExpiresAt` in SQL from the row's current value, and the
   result is stamped onto `payments.periodStart` / `periodEnd`.
5. If an order is already `paid` (the other path won, or an older partial failure),
   `activatePaidOrder()` self-heals: when the user row does not reflect that payment and holds
   nothing better (`needsSelfHeal`), it is set to the payment's plan and `periodEnd`.

Webhook events handled: `payment.captured`, `order.paid` (activate), `payment.failed`
(mark failed), `refund.processed` / `refund.created` (full refund, see below). Every event is
stored in `billing_events` (`event_id = razorpay:<x-razorpay-event-id>`) which makes replays a
no-op. If processing throws, the ledger row is deleted and the route returns 500, so
Razorpay's retry is processed instead of being skipped as a duplicate.

### Refunds

A refund is "full" when the payment entity's cumulative `amount_refunded` (fallback: the
single refund's `amount`) reaches the charged amount; partial refunds change nothing. A full
refund flips the payment to `refunded` and subtracts exactly that payment's period
(`periodEnd - periodStart`) from `users.planExpiresAt`, only when `users.billingTier` still
equals the refunded plan (an admin grant or a different plan is left alone). Both writes are
one transaction keyed to this call, so `refund.created` + `refund.processed` subtract once.

The Razorpay account may be shared with other apps. Events whose `order_id` is not in
`payments` are recorded and ignored (200 OK so Razorpay stops retrying).

## Periods

Computed in the `users` UPDATE inside `activatePaidOrder()`:

- Renewing the **same** plan while it is still active (`planExpiresAt > now`) extends from
  `planExpiresAt`.
- Anything else (different plan, in grace, expired, free) starts from now.
- Each period is `PLAN_PERIOD_DAYS` (30) and is stored on the payment as `periodStart` / `periodEnd`.

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
RAZORPAY_CURRENCY=USD       # optional, default USD; any other currency REQUIRES both RAZORPAY_PRICE_*
RAZORPAY_PRICE_PRO=         # optional, minor units, overrides 1900 (e.g. INR paise)
RAZORPAY_PRICE_UNLIMITED=   # optional, minor units, overrides 9900
```

Webhook URL: `https://indexfast.co/api/webhooks/razorpay`. Enable at least
`payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.

If the Razorpay account cannot accept USD (international payments disabled), set
`RAZORPAY_CURRENCY=INR` and both `RAZORPAY_PRICE_*` values in paise. `getPlanCharge()` throws
for a non-USD currency without an override, so checkout fails loudly instead of charging the
USD cent figure as paise (about 1/100 of the price).

## DodoPayments (hidden)

Only `/api/webhooks/dodo`, `lib/platform/billing.ts` and `getDodoWebhookKey()` in
`lib/platform/dodo.ts` remain, so legacy subscribers keep syncing. The Dodo checkout and
customer portal routes were removed. Do not build new features on them.

Webhook rules (`recordDodoBillingEvent`, `resolveDodoTierChange`):

- The `billing_events` insert is the idempotency key; a duplicate event id is not reprocessed.
- The plan comes only from the product id (`getPlanFromDodoProductId`); `metadata.plan` is ignored.
- `payment.*` events never change the tier.
- A paid tier is granted only for a `subscription.*` event with status `active`, and sets
  `planExpiresAt = NULL` (legacy tiers never expire on our side). It is skipped while the user
  holds a live Razorpay period or admin grant (`planExpiresAt > now`), so a Dodo renewal never
  erases prepaid time.
- `subscription.cancelled` / `expired` (or that status) drops to Free only a user still on a
  legacy tier with null expiry; a Razorpay period or admin grant survives.

## Support

Admins can grant or remove a plan for N days from `/admin` ("Grant a plan").
