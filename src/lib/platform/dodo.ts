/**
 * LEGACY: DodoPayments config. Only the webhook key is still needed: checkout and the
 * customer portal were removed, the webhook stays so existing subscribers keep syncing.
 */
export function getDodoWebhookKey() {
	return process.env.DODO_PAYMENTS_WEBHOOK_KEY || "";
}
