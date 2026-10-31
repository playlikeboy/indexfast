import { describe, expect, it } from "vitest";
import { buildBaiduPushUrl, parseBaiduResponse } from "../baidu";
import { matchYandexHost, parseYandexHosts, parseYandexQuota } from "../yandex";

describe("Yandex", () => {
	const hosts = parseYandexHosts({
		hosts: [
			{ host_id: "http:example.com:80", ascii_host_url: "http://example.com/", verified: true },
			{ host_id: "https:example.com:443", ascii_host_url: "https://example.com/", verified: true },
			{ host_id: "https:www.example.com:443", ascii_host_url: "https://www.example.com/", verified: false },
			{ bad: true },
		],
	});

	it("parses hosts and prefers the verified https host for the exact hostname", () => {
		expect(hosts).toHaveLength(3);
		expect(matchYandexHost(hosts, "example.com")?.hostId).toBe("https:example.com:443");
		expect(matchYandexHost(hosts, "www.example.com")).toMatchObject({ verified: false });
		expect(matchYandexHost(hosts, "other.com")).toBeNull();
	});

	it("reads the recrawl quota", () => {
		expect(parseYandexQuota({ daily_quota: 100, quota_remainder: 7 })).toEqual({ dailyQuota: 100, remainder: 7 });
		expect(parseYandexQuota(null)).toEqual({ dailyQuota: null, remainder: null });
	});
});

describe("Baidu", () => {
	it("builds the push URL with the https site", () => {
		expect(buildBaiduPushUrl("www.example.com", "abc123")).toBe("http://data.zz.baidu.com/urls?site=https%3A%2F%2Fwww.example.com&token=abc123");
	});

	it("parses success with remain, over quota, and bad token", () => {
		const ok = parseBaiduResponse(200, JSON.stringify({ remain: 98, success: 2, not_same_site: ["https://x.com/"], not_valid: [] }));
		expect(ok).toMatchObject({ ok: true, remain: 98, accepted: 2 });
		expect(ok.message).toContain("1 not on this site");
		const quota = parseBaiduResponse(400, JSON.stringify({ error: 400, message: "over quota" }));
		expect(quota).toMatchObject({ ok: false, status: 429, remain: 0 });
		expect(quota.retryAfterSeconds).toBeGreaterThan(0);
		expect(parseBaiduResponse(401, JSON.stringify({ error: 401, message: "token is not valid" }))).toMatchObject({ ok: false, status: 401 });
		expect(parseBaiduResponse(502, "Bad gateway")).toMatchObject({ ok: false, status: 502 });
	});
});
