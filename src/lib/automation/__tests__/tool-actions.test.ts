import { describe, expect, it } from "vitest";
import {
	generateIndexNowKeyTool,
	generateLlmsTxtTool,
	checkRobotsTxtTool,
	checkAiCrawlerTool,
} from "@/app/tools/tool-actions";

describe("Tool Actions", () => {
	it("generates a valid 32-character hex IndexNow key and location", async () => {
		const res = await generateIndexNowKeyTool("example.com");
		expect(res.success).toBe(true);
		expect(res.key.length).toBe(32);
		expect(res.host).toBe("example.com");
		expect(res.keyLocation).toBe(`https://example.com/${res.key}.txt`);
		expect(/^[a-f0-9]{32}$/.test(res.key)).toBe(true);
	});

	it("rejects invalid or private domains for IndexNow key", async () => {
		await expect(generateIndexNowKeyTool("127.0.0.1")).rejects.toThrow();
		await expect(generateIndexNowKeyTool("")).rejects.toThrow();
	});

	it("generates valid standard llms.txt and llms-full.txt content", async () => {
		const res = await generateLlmsTxtTool({
			domain: "mybrand.com",
			title: "My Brand",
			description: "Fast indexing platform",
			keyPages: "Docs | https://mybrand.com/docs\n/pricing",
		});
		expect(res.success).toBe(true);
		expect(res.llmsTxt).toContain("# My Brand");
		expect(res.llmsTxt).toContain("> Fast indexing platform");
		expect(res.llmsTxt).toContain("[Docs](https://mybrand.com/docs)");
		expect(res.llmsTxt).toContain("https://mybrand.com/pricing");
		expect(res.llmsFullTxt).toContain("# My Brand (Full Reference)");
	});

	it("handles non-existent robots.txt with graceful fallback", async () => {
		const res = await checkRobotsTxtTool("non-existent-subdomain-12345.example.com");
		expect(res.host).toBe("non-existent-subdomain-12345.example.com");
	});

	it("analyzes major AI crawlers with allowed status", async () => {
		const res = await checkAiCrawlerTool("example.com");
		expect(res.success).toBe(true);
		expect(res.bots.length).toBe(8);
		expect(res.bots.some((b) => b.name === "GPTBot")).toBe(true);
		expect(res.bots.some((b) => b.name === "ClaudeBot")).toBe(true);
	});
});
