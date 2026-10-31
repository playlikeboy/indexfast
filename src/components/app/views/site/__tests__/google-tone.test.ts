import { describe, expect, it } from "vitest";
import { googleTone } from "../google-tone";

describe("googleTone", () => {
	it("maps Google's coverage text to a tone", () => {
		expect(googleTone("Submitted and indexed")).toBe("success");
		expect(googleTone("Indexed, not submitted in sitemap")).toBe("success");
		expect(googleTone("Crawled - currently not indexed")).toBe("warning");
		expect(googleTone("Discovered - currently not indexed")).toBe("warning");
		expect(googleTone("Excluded by 'noindex' tag")).toBe("danger");
		expect(googleTone("Blocked by robots.txt")).toBe("danger");
		expect(googleTone("Not found (404)")).toBe("danger");
		expect(googleTone("Server error (5xx)")).toBe("danger");
		expect(googleTone("Page with redirect")).toBe("neutral");
	});
});
