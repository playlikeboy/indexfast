/**
 * Direct Bing Webmaster API integration for developers.
 * - GET: Check Bing API key verification status, daily quota, and auto-submit state.
 * - POST: Validate and save a developer's Bing API key, enabling auto-submission into Bing Search Console.
 * - PATCH: Toggle auto-submission on/off for this specific site.
 * - DELETE: Disconnect Bing API key.
 */
import {
	getBingStatusForApi,
	removeBingApiKeyForApi,
	saveBingApiKeyForApi,
	setBingAutomationForApi,
} from "@/lib/platform/operations";
import { readJsonBody, withApiAuth } from "@/lib/platform/http";

type RouteContext = {
	params: Promise<{ siteId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:read"], async (auth) => {
		return getBingStatusForApi(auth.userId, siteId);
	});
}

export async function POST(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => {
		const body = await readJsonBody<{ apiKey?: string; autoSubmit?: boolean }>(request);
		if (!body.apiKey || typeof body.apiKey !== "string") {
			throw new Error("apiKey is required.");
		}
		return saveBingApiKeyForApi(auth.userId, siteId, body.apiKey, body.autoSubmit !== false);
	});
}

export async function PATCH(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => {
		const body = await readJsonBody<{ autoSubmit?: boolean }>(request);
		if (typeof body.autoSubmit !== "boolean") {
			throw new Error("autoSubmit boolean is required.");
		}
		return setBingAutomationForApi(auth.userId, siteId, body.autoSubmit);
	});
}

export async function DELETE(request: Request, context: RouteContext) {
	const { siteId } = await context.params;
	return withApiAuth(request, ["sites:write"], async (auth) => {
		return removeBingApiKeyForApi(auth.userId, siteId);
	});
}
