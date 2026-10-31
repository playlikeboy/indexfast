import { describe, expect, it } from "vitest";
import { getPlanFromDodoProductId, resolveDodoTierChange } from "@/lib/platform/billing";

describe("Dodo Billing Logic", () => {
	it("returns free plan when product id is missing or unmapped", () => {
		expect(getPlanFromDodoProductId(null)).toBe("free");
		expect(getPlanFromDodoProductId(undefined)).toBe("free");
		expect(getPlanFromDodoProductId("non-existent-product")).toBe("free");
	});

	it("maps configured product ids to billing tiers", () => {
		if (process.env.DODO_PRODUCT_ID_INDIE) {
			expect(getPlanFromDodoProductId(process.env.DODO_PRODUCT_ID_INDIE)).toBe("indie");
		}
		if (process.env.DODO_PRODUCT_ID_GROWTH) {
			expect(getPlanFromDodoProductId(process.env.DODO_PRODUCT_ID_GROWTH)).toBe("growth");
		}
	});
});

describe("resolveDodoTierChange", () => {
	it("never changes the tier on payment events", () => {
		expect(resolveDodoTierChange("payment.succeeded", "active", "growth")).toBeNull();
		expect(resolveDodoTierChange("payment.failed", "failed", "growth")).toBeNull();
	});

	it("grants a paid tier only for an active subscription", () => {
		expect(resolveDodoTierChange("subscription.active", "active", "growth")).toBe("growth");
		expect(resolveDodoTierChange("subscription.renewed", "active", "indie")).toBe("indie");
		expect(resolveDodoTierChange("subscription.on_hold", "on_hold", "growth")).toBeNull();
		expect(resolveDodoTierChange("subscription.updated", null, "growth")).toBeNull();
	});

	it("does not grant anything for an unmapped product", () => {
		expect(resolveDodoTierChange("subscription.active", "active", "free")).toBeNull();
	});

	it("downgrades on cancel or expiry by event type or status", () => {
		expect(resolveDodoTierChange("subscription.cancelled", "active", "growth")).toBe("free");
		expect(resolveDodoTierChange("subscription.expired", null, "growth")).toBe("free");
		expect(resolveDodoTierChange("subscription.updated", "cancelled", "growth")).toBe("free");
	});
});
