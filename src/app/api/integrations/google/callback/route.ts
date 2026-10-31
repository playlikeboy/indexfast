/**
 * Google OAuth callback. Accepts the code only when the signed state verifies, is unexpired,
 * belongs to the signed-in user and its nonce matches the cookie from /start. The refresh
 * token is stored encrypted (google-service.ts); the browser always lands on
 * /dashboard/connect?google=connected or ?google=error&reason=<code>.
 */
import { NextResponse, type NextRequest } from "next/server";
import { ensureUserRow, getSessionUser } from "@/lib/auth";
import {
	exchangeGoogleCode,
	getGoogleClientCredentials,
	getGoogleRedirectUri,
	getOAuthStateSecret,
	GOOGLE_NONCE_COOKIE,
	GOOGLE_SCOPES,
	verifyOAuthState,
} from "@/lib/engines/google-oauth";
import { saveGoogleConnection } from "@/lib/engines/google-service";

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const origin = url.origin;
	const finish = (query: string) => {
		const response = NextResponse.redirect(new URL(`/dashboard/connect?${query}`, origin));
		response.cookies.set(GOOGLE_NONCE_COOKIE, "", { path: "/api/integrations/google", maxAge: 0 });
		return response;
	};
	const fail = (reason: string) => finish(`google=error&reason=${reason}`);

	if (url.searchParams.get("error")) {
		return fail(url.searchParams.get("error") === "access_denied" ? "denied" : "google_error");
	}
	const user = await getSessionUser();
	if (!user) return fail("signed_out");

	const claims = await verifyOAuthState(url.searchParams.get("state") ?? "", getOAuthStateSecret());
	const nonce = request.cookies.get(GOOGLE_NONCE_COOKIE)?.value;
	if (!claims || !nonce || claims.nonce !== nonce || claims.userId !== user.id) {
		return fail("invalid_state");
	}
	const code = url.searchParams.get("code");
	const credentials = getGoogleClientCredentials();
	if (!code || !credentials) return fail(credentials ? "missing_code" : "not_configured");

	const result = await exchangeGoogleCode(credentials, getGoogleRedirectUri(origin), code).catch(() => null);
	if (!result?.ok) return fail("exchange_failed");
	// Users can untick scopes on Google's consent screen; Search Console access is the minimum.
	if (!result.tokens.scopes.includes(GOOGLE_SCOPES.webmasters)) return fail("missing_scope");

	try {
		await ensureUserRow(user);
		await saveGoogleConnection(user.id, result.tokens);
	} catch {
		return fail("save_failed");
	}
	return finish("google=connected");
}
