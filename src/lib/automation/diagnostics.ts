import { safeFetchText, assertSafeExternalUrl } from "@/lib/url-utils";

export type DiagnosticResult = {
	url: string;
	finalUrl: string;
	httpStatus: number;
	status: "pass" | "warn" | "fail";
	noindex: boolean;
	noindexSource: "meta_robots" | "x_robots_tag" | null;
	canonical: string | null;
	isCanonicalMatch: boolean;
	title: string | null;
	blockers: string[];
	checkedAt: string;
};

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
			title: null,
			blockers: [message],
			checkedAt,
		};
	}

	try {
		const response = await safeFetchText(validUrl.toString(), {
			timeoutMs: 10000,
			userAgent: "IndexFast Diagnostics/1.0 (+https://indexfast.co)",
			maxBytes: 2 * 1024 * 1024, // 2MB
		});

		const httpStatus = response.status;
		const finalUrl = response.finalUrl;
		const text = response.text;

		if (httpStatus >= 400) {
			blockers.push(`HTTP ${httpStatus} error returned`);
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
		if (httpStatus >= 400 || noindex) {
			status = "fail";
		} else if (httpStatus >= 300 || !isCanonicalMatch) {
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
			title: null,
			blockers: [message],
			checkedAt,
		};
	}
}
