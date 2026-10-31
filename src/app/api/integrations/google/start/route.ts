/**
 * Starts the Google OAuth flow for Search Console + Indexing API. Requires a Stack Auth
 * session (agents cannot do this step; they send the human here). The signed state carries
 * the user id and a nonce; the same nonce goes into a short-lived httpOnly cookie so the
 * callback can prove the browser that finishes the flow is the one that started it.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
	buildGoogleAuthUrl,
	createNonce,
	getGoogleClientCredentials,
	getGoogleRedirectUri,
	getOAuthStateSecret,
	GOOGLE_NONCE_COOKIE,
	OAUTH_STATE_TTL_MS,
	signOAuthState,
} from "@/lib/engines/google-oauth";
import { stack } from "@/stack";

export async function GET(request: Request) {
	const origin = new URL(request.url).origin;
	const user = await getSessionUser();
	if (!user) {
		return NextResponse.redirect(new URL(stack.urls.signIn, origin));
	}
	const credentials = getGoogleClientCredentials();
	const secret = getOAuthStateSecret();
	if (!credentials || !secret) {
		return NextResponse.redirect(new URL("/dashboard/connect?google=error&reason=not_configured", origin));
	}

	const nonce = createNonce();
	const state = await signOAuthState({ userId: user.id, nonce }, secret);
	const response = NextResponse.redirect(buildGoogleAuthUrl(credentials, getGoogleRedirectUri(origin), state));
	response.cookies.set(GOOGLE_NONCE_COOKIE, nonce, {
		httpOnly: true,
		secure: origin.startsWith("https:"),
		sameSite: "lax", // Sent on Google's top-level redirect back to the callback
		path: "/api/integrations/google",
		maxAge: OAUTH_STATE_TTL_MS / 1000,
	});
	return response;
}
