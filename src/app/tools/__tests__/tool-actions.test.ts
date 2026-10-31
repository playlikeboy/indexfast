import { describe, expect, it } from "vitest";
import { checkBulkIndexTool, generateIndexNowKeyTool, generateLlmsTxtTool, submitIndexNowTool } from "../tool-actions";

// Only paths that settle before any network call: validation and pure generation.
describe("free tool actions", () => {
	it("returns an error result instead of throwing", async () => {
		await expect(generateIndexNowKeyTool("127.0.0.1")).resolves.toMatchObject({ success: false });
		await expect(generateIndexNowKeyTool("")).resolves.toMatchObject({ success: false });
	});

	it("generates a 32-character hex key with its file location", async () => {
		const res = await generateIndexNowKeyTool("example.com");
		if (!res.success) throw new Error(res.error);
		expect(res.key).toMatch(/^[a-f0-9]{32}$/);
		expect(res.keyLocation).toBe(`https://example.com/${res.key}.txt`);
		expect(res.fileName).toBe(`${res.key}.txt`);
	});

	it("generates llms.txt from title and description", async () => {
		const res = await generateLlmsTxtTool({ domain: "mybrand.com", title: "My Brand", description: "Fast indexing" });
		if (!res.success) throw new Error(res.error);
		expect(res.llmsTxt).toContain("# My Brand");
		expect(res.llmsTxt).toContain("> Fast indexing");
		// llms-full.txt is not generated, so the output must not link to it.
		expect(res.llmsTxt).not.toContain("llms-full.txt");
	});

	it("rejects malformed IndexNow keys and off-host key files before sending", async () => {
		const base = { host: "example.com", urlList: "https://example.com/" };
		const badKey = await submitIndexNowTool({ ...base, key: "abc" });
		expect(badKey).toMatchObject({ success: false });
		const badChars = await submitIndexNowTool({ ...base, key: "abcd1234/../x" });
		expect(badChars).toMatchObject({ success: false });
		const offHost = await submitIndexNowTool({ ...base, key: "abcd1234", keyLocation: "https://other.com/abcd1234.txt" });
		expect(offHost).toMatchObject({ success: false, error: "The key file must be on example.com" });
		const offHostUrl = await submitIndexNowTool({ ...base, key: "abcd1234", urlList: "https://other.com/a" });
		expect(offHostUrl).toMatchObject({ success: false });
	});

	it("dedupes bulk input before applying the 20 URL limit", async () => {
		const many = Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`).join("\n");
		await expect(checkBulkIndexTool(many)).resolves.toMatchObject({ success: false });
		await expect(checkBulkIndexTool("  \n ")).resolves.toMatchObject({ success: false });
		const dupes = Array.from({ length: 30 }, () => "http://127.0.0.1/").join("\n");
		const res = await checkBulkIndexTool(dupes);
		if (!res.success) throw new Error(res.error);
		expect(res.total).toBe(1);
		expect(res.failed).toBe(1);
		expect(res.skipped).toBe(0);
	});
});
