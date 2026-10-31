import { describe, expect, it } from "vitest";
import {
	buildGoogleIndexingNotification,
	checkGoogleIndexingEligibility,
	getGoogleIndexingMetadataUrl,
} from "../google-indexing";

describe("google indexing guardrails", () => {
	it("rejects generic pages", () => {
		const result = checkGoogleIndexingEligibility(`<script type="application/ld+json">{"@type":"Article"}</script>`);

		expect(result.eligible).toBe(false);
		expect(result.contentTypes).toEqual(["Article"]);
	});

	it("accepts JobPosting structured data", () => {
		const result = checkGoogleIndexingEligibility(`<script type="application/ld+json">{"@type":"JobPosting"}</script>`);

		expect(result.eligible).toBe(true);
		expect(result.contentTypes).toEqual(["JobPosting"]);
	});

	it("requires livestream BroadcastEvent to be embedded in VideoObject", () => {
		const result = checkGoogleIndexingEligibility(`<script type="application/ld+json">{"@type":"BroadcastEvent"}</script>`);

		expect(result.eligible).toBe(false);
		expect(result.reason).toContain("VideoObject");
	});

	it("accepts BroadcastEvent only when nested inside a VideoObject", () => {
		const nested = checkGoogleIndexingEligibility(
			`<script type="application/ld+json">{"@type":"VideoObject","name":"Live","publication":{"@type":"BroadcastEvent","isLiveBroadcast":true}}</script>`,
		);
		expect(nested.eligible).toBe(true);
		const siblings = checkGoogleIndexingEligibility(
			`<script type="application/ld+json">[{"@type":"VideoObject","name":"Clip"},{"@type":"BroadcastEvent","isLiveBroadcast":true}]</script>`,
		);
		expect(siblings.eligible).toBe(false);
	});

	it("builds documented notification and metadata URL shapes", () => {
		expect(buildGoogleIndexingNotification("https://example.com/jobs/1", "URL_UPDATED")).toEqual({
			url: "https://example.com/jobs/1",
			type: "URL_UPDATED",
		});
		expect(getGoogleIndexingMetadataUrl("https://example.com/jobs/1")).toBe(
			"https://indexing.googleapis.com/v3/urlNotifications/metadata?url=https%3A%2F%2Fexample.com%2Fjobs%2F1",
		);
	});
});
