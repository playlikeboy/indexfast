/**
 * Google Indexing API guardrail. Google's policy allows this API only for pages with
 * JobPosting structured data, or a livestream BroadcastEvent embedded in a VideoObject.
 * Every IndexFast path to the Indexing API must pass checkGoogleIndexingEligibility first;
 * general pages go through sitemaps, Search Console and IndexNow instead.
 */
import { GOOGLE_INDEXING_PUBLISH_ENDPOINT } from "@/lib/automation/constants";

export type GoogleIndexingNotificationType = "URL_UPDATED" | "URL_DELETED";

export type GoogleIndexingEligibility = {
	eligible: boolean;
	contentTypes: string[];
	reason: string;
};

const eligibleTypes = new Set(["JobPosting", "BroadcastEvent"]);

function collectTypes(value: unknown, types = new Set<string>()) {
	if (!value || typeof value !== "object") {
		return types;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectTypes(item, types);
		}
		return types;
	}

	const record = value as Record<string, unknown>;
	const rawType = record["@type"];
	const typeValues = Array.isArray(rawType) ? rawType : [rawType];
	for (const item of typeValues) {
		if (typeof item === "string") {
			types.add(item);
		}
	}

	for (const item of Object.values(record)) {
		collectTypes(item, types);
	}

	return types;
}

function typesOf(record: Record<string, unknown>) {
	const rawType = record["@type"];
	return (Array.isArray(rawType) ? rawType : [rawType]).filter((item): item is string => typeof item === "string");
}

function hasBroadcastInsideVideo(value: unknown, insideVideo: boolean): boolean {
	if (!value || typeof value !== "object") return false;
	if (Array.isArray(value)) return value.some((item) => hasBroadcastInsideVideo(item, insideVideo));
	const record = value as Record<string, unknown>;
	const types = typesOf(record);
	if (insideVideo && types.includes("BroadcastEvent")) return true;
	const nextInside = insideVideo || types.includes("VideoObject");
	return Object.values(record).some((item) => hasBroadcastInsideVideo(item, nextInside));
}

function extractJsonLdBlocks(html: string) {
	const blocks: unknown[] = [];
	for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
		const raw = match[1].trim();
		if (!raw) {
			continue;
		}

		try {
			blocks.push(JSON.parse(raw));
		} catch {
			// Ignore invalid JSON-LD and keep checking other blocks.
		}
	}
	return blocks;
}

export function checkGoogleIndexingEligibility(html: string): GoogleIndexingEligibility {
	const collectedTypes = new Set<string>();
	for (const block of extractJsonLdBlocks(html)) {
		collectTypes(block, collectedTypes);
	}
	const contentTypes = Array.from(collectedTypes).sort();

	const hasEligibleType = contentTypes.some((type) => eligibleTypes.has(type));
	if (!hasEligibleType) {
		return {
			eligible: false,
			contentTypes,
			reason: "Google Indexing API is limited to JobPosting pages or livestream BroadcastEvent pages.",
		};
	}

	const blocks = extractJsonLdBlocks(html);
	const hasJobPosting = contentTypes.includes("JobPosting");
	// Both types merely appearing on the page is not enough: the BroadcastEvent has to sit
	// inside the VideoObject (e.g. VideoObject.publication), which is what Google requires.
	if (!hasJobPosting && !blocks.some((block) => hasBroadcastInsideVideo(block, false))) {
		return {
			eligible: false,
			contentTypes,
			reason: "Livestream BroadcastEvent eligibility requires BroadcastEvent embedded in VideoObject structured data.",
		};
	}

	return {
		eligible: true,
		contentTypes,
		reason: "Eligible structured data detected for Google Indexing API notifications.",
	};
}

export function buildGoogleIndexingNotification(url: string, type: GoogleIndexingNotificationType) {
	return { url, type };
}

export function getGoogleIndexingMetadataUrl(url: string) {
	return `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(url)}`;
}

export async function submitGoogleIndexingNotification(accessToken: string, url: string, type: GoogleIndexingNotificationType) {
	const response = await fetch(GOOGLE_INDEXING_PUBLISH_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
		},
		body: JSON.stringify(buildGoogleIndexingNotification(url, type)),
		signal: AbortSignal.timeout(20_000),
	});

	const body = await response.text().catch(() => "");
	return {
		ok: response.ok,
		status: response.status,
		message: body || `Google Indexing API returned HTTP ${response.status}.`,
	};
}
