import { describe, expect, it } from "vitest";
import {
	getAllSearchEngines,
	getSearchEngineById,
	getSupportedSearchEngines,
} from "../search-engines";

describe("search engines research catalog", () => {
	it("returns comprehensive catalog with all major engines", () => {
		const engines = getAllSearchEngines();
		expect(engines.length).toBeGreaterThanOrEqual(6);

		const ids = engines.map((e) => e.id);
		expect(ids).toContain("bing");
		expect(ids).toContain("google");
		expect(ids).toContain("yandex");
		expect(ids).toContain("baidu");
		expect(ids).toContain("naver");
		expect(ids).toContain("seznam");
	});

	it("specifies Bing with both IndexNow and Webmaster API methods", () => {
		const bing = getSearchEngineById("bing");
		expect(bing).toBeDefined();
		expect(bing?.supportedInIndexFast).toBe(true);

		const methodNames = bing?.methods.map((m) => m.name);
		expect(methodNames).toContain("IndexNow Protocol");
		expect(methodNames).toContain("Bing Webmaster API (SubmitUrlBatch)");

		const webmasterApi = bing?.methods.find((m) => m.name.includes("Webmaster API"));
		expect(webmasterApi?.httpMethod).toBe("POST");
		expect(webmasterApi?.endpoint).toContain("SubmitUrlBatch");
		expect(webmasterApi?.batchSize).toBe(500);
	});

	it("strictly documents Google Indexing API content restrictions", () => {
		const google = getSearchEngineById("google");
		expect(google).toBeDefined();
		expect(google?.supportLevel).toBe("restricted");

		const indexingApi = google?.methods.find((m) => m.name.includes("Google Indexing API"));
		expect(indexingApi?.contentRestrictions).toContain("JobPosting");
		expect(indexingApi?.contentRestrictions).toContain("BroadcastEvent");
	});

	it("documents Baidu Active Push API specification", () => {
		const baidu = getSearchEngineById("baidu");
		expect(baidu).toBeDefined();
		expect(baidu?.methods[0]?.name).toContain("Active Push");
		expect(baidu?.methods[0]?.endpoint).toContain("data.zz.baidu.com/urls");
		expect(baidu?.methods[0]?.authMethod).toBe("token");
	});

	it("marks the engine connections being added without promising Google indexing", () => {
		const status = (engine: string, method: string) =>
			getSearchEngineById(engine)?.methods.find((m) => m.name.includes(method))?.inIndexFast?.status;
		expect(status("google", "Search Console")).toBe("adding");
		expect(status("google", "Indexing API")).toBe("adding");
		expect(status("yandex", "Recrawl")).toBe("adding");
		expect(status("baidu", "Active Push")).toBe("adding");
		expect(status("bing", "IndexNow")).toBe("live");

		const notes = getAllSearchEngines().flatMap((e) => e.methods.map((m) => m.inIndexFast?.note ?? ""));
		expect(notes.some((n) => /guarantee(s|d)? (google )?index/i.test(n) && !/nothing guarantees|does not|never/i.test(n))).toBe(false);
	});

	it("returns only supported search engines when filtered", () => {
		const supported = getSupportedSearchEngines();
		expect(supported.every((e) => e.supportedInIndexFast)).toBe(true);
		expect(supported.some((e) => e.id === "bing")).toBe(true);
	});
});
