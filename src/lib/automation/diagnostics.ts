/**
 * Indexability diagnostics for a single URL: HTTP status, redirects, noindex (meta and
 * X-Robots-Tag), canonical mismatch and robots.txt blocking. Used by the dashboard, REST/MCP
 * and the free tools, so every check here must be a real signal the marketing copy can cite.
 */
import { safeFetchText, assertSafeExternalUrl } from "@/lib/url-utils";
import { isPathAllowed, parseRobotsGroups, rulesForAgent } from "@/app/tools/robots-rules";

export type DiagnosticResult = {
	url: string;
	finalUrl: string;
	httpStatus: number;
	status: "pass" | "warn" | "fail";
	noindex: boolean;
	noindexSource: "meta_robots" | "x_robots_tag" | null;
	canonical: string | null;
	isCanonicalMatch: boolean;
	redirected: boolean;
	robotsBlocked: boolean;
	title: string | null;
	blockers: string[];
	checkedAt: string;
};

/**
 * Whether robots.txt on the URL's origin disallows Googlebot (falling back to the `*` group).
 * Fails open: an unreachable or missing robots.txt means crawlers may fetch everything, so it
 * must never be reported as a blocker.
 */
export async function isBlockedByRobots(url: URL): Promise<boolean> {
	try {
		const robots = await safeFetchText(new URL("/robots.txt", url).toString(), {
			timeoutMs: 5000,
			userAgent: "IndexFast Diagnostics/1.0 (+https://indexfast.co)",
			maxBytes: 512 * 1024,
		});
		if (robots.status !== 200) return false;
		const { rules } = rulesForAgent(parseRobotsGroups(robots.text), "googlebot");
		return !isPathAllowed(rules, url.pathname + url.search);
	} catch {
		return false;
	}
}

export async function evaluateUrlDiagnostics(inputUrl: string): Promise<DiagnosticResult> {
	const checkedAt = new Date().toISOString();
	const blockers: string[] = [];

	let validUrl: URL;
	try {
		validUrl = assertSafeExternalUrl(inputUrl);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Invalid URL";
		return {
			url: inputUrl,
			finalUrl: inputUrl,
			httpStatus: 0,
			status: "fail",
			noindex: false,
			noindexSource: null,
			canonical: null,
			isCanonicalMatch: false,
			redirected: false,
			robotsBlocked: false,
			title: null,
			blockers: [message],
			checkedAt,
		};
	}

	try {
		const [response, robotsBlocked] = await Promise.all([
			safeFetchText(validUrl.toString(), {
				timeoutMs: 10000,
				userAgent: "IndexFast Diagnostics/1.0 (+https://indexfast.co)",
				maxBytes: 2 * 1024 * 1024, // 2MB
			}),
			isBlockedByRobots(validUrl),
		]);

		const httpStatus = response.status;
		const finalUrl = response.finalUrl;
		const text = response.text;

		if (httpStatus >= 400) {
			blockers.push(`HTTP ${httpStatus} error returned`);
		}

		// Engines index the redirect target, not the submitted URL, so a redirect is worth flagging.
		const redirected = new URL(finalUrl).href !== validUrl.href;
		if (redirected) {
			blockers.push(`Redirects to ${finalUrl}`);
		}
		if (robotsBlocked) {
			blockers.push("robots.txt disallows crawling this URL");
		}

		// Check X-Robots-Tag header
		const xRobotsTag = response.headers.get("x-robots-tag") || "";
		const xRobotsNoindex = /\b(noindex|none)\b/i.test(xRobotsTag);

		// Check Meta robots in HTML
		const metaRobotsMatch = /<meta[^>]+(?:name|property)=["'](?:robots|googlebot|bingbot)["'][^>]+content=["']([^"']+)["']/i.exec(text)
			|| /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:robots|googlebot|bingbot)["']/i.exec(text);
		const metaContent = metaRobotsMatch ? metaRobotsMatch[1] : "";
		const metaNoindex = /\b(noindex|none)\b/i.test(metaContent);

		const noindex = xRobotsNoindex || metaNoindex;
		const noindexSource = xRobotsNoindex ? "x_robots_tag" : metaNoindex ? "meta_robots" : null;

		if (xRobotsNoindex) {
			blockers.push("HTTP response header 'X-Robots-Tag' contains noindex");
		}
		if (metaNoindex) {
			blockers.push("HTML contains <meta name=\"robots\" content=\"noindex\">");
		}

		// Check Canonical link
		const canonicalMatch = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(text)
			|| /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i.exec(text);
		const canonical = canonicalMatch ? canonicalMatch[1].trim() : null;

		let isCanonicalMatch = true;
		if (canonical) {
			try {
				const resolvedCanonical = new URL(canonical, finalUrl).toString();
				const cleanResolved = resolvedCanonical.replace(/\/$/, "");
				const cleanFinal = finalUrl.replace(/\/$/, "");
				isCanonicalMatch = cleanResolved === cleanFinal;
				if (!isCanonicalMatch) {
					blockers.push(`Canonical URL points to a different page: ${canonical}`);
				}
			} catch {
				isCanonicalMatch = false;
				blockers.push(`Malformed canonical URL found: ${canonical}`);
			}
		}

		// Extract page title
		const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(text);
		const title = titleMatch ? titleMatch[1].trim() : null;

		// Overall status
		let status: "pass" | "warn" | "fail" = "pass";
		if (httpStatus >= 400 || noindex || robotsBlocked) {
			status = "fail";
		} else if (httpStatus >= 300 || redirected || !isCanonicalMatch) {
			status = "warn";
		}

		return {
			url: validUrl.toString(),
			finalUrl,
			httpStatus,
			status,
			noindex,
			noindexSource,
			canonical,
			isCanonicalMatch,
			redirected,
			robotsBlocked,
			title,
			blockers,
			checkedAt,
		};
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Network error during diagnostics";
		return {
			url: validUrl.toString(),
			finalUrl: validUrl.toString(),
			httpStatus: 0,
			status: "fail",
			noindex: false,
			noindexSource: null,
			canonical: null,
			isCanonicalMatch: false,
			redirected: false,
			robotsBlocked: false,
			title: null,
			blockers: [message],
			checkedAt,
		};
	}
}
