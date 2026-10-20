import { describe, expect, it } from "vitest";
import { getPlanFromDodoProductId } from "@/lib/platform/billing";

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
