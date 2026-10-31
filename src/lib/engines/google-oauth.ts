/**
 * Google OAuth 2.0 (web server flow) for Search Console and the Indexing API. Pure HTTP
 * helpers plus the signed `state` parameter; tokens are stored by google-service.ts.
 *
 * Security rules enforced here:
 * - `state` is an HMAC-signed {userId, nonce, expiry}. The callback only accepts a state that
 *   verifies, has not expired, whose nonce matches the httpOnly cookie set by /start, and
 *   whose userId is the signed-in user. That blocks CSRF and "log the victim into my Google".
 * - access_type=offline + prompt=consent so Google always returns a refresh token.
 */
import { GOOGLE_AUTH_URL, GOOGLE_REVOKE_URL, GOOGLE_TOKEN_URL } from "@/lib/automation/constants";

export const GOOGLE_SCOPES = {
	webmasters: "https://www.googleapis.com/auth/webmasters",
	indexing: "https://www.googleapis.com/auth/indexing",
} as const;

export const GOOGLE_CALLBACK_PATH = "/api/integrations/google/callback";
export const GOOGLE_NONCE_COOKIE = "indexfast_google_oauth";
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const TIMEOUT_MS = 15_000;

export type GoogleClientCredentials = { clientId: string; clientSecret: string };

export function getGoogleClientCredentials(): GoogleClientCredentials | null {
	const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
	return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Must be byte-identical in /start and /callback, or Google rejects the code exchange. */
export function getGoogleRedirectUri(requestOrigin: string) {
	const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
	if (explicit) return explicit;
	const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || requestOrigin;
	return `${base.replace(/\/+$/, "")}${GOOGLE_CALLBACK_PATH}`;
}

/** HMAC key for the state; the same secrets that protect stored credentials. */
export function getOAuthStateSecret() {
	return process.env.CREDENTIAL_ENCRYPTION_KEY?.trim() || process.env.STACK_SECRET_SERVER_KEY?.trim() || "";
}

export function buildGoogleAuthUrl(credentials: GoogleClientCredentials, redirectUri: string, state: string) {
	const params = new URLSearchParams({
		client_id: credentials.clientId,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: [GOOGLE_SCOPES.webmasters, GOOGLE_SCOPES.indexing].join(" "),
		access_type: "offline",
		prompt: "consent",
		include_granted_scopes: "true",
		state,
	});
	return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function toBase64Url(bytes: Uint8Array) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value: string) {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret: string, data: string) {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`indexfast:oauth-state:v1:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))));
}

function constantTimeEqual(a: string, b: string) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
	return diff === 0;
}

export function createNonce() {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(18)));
}

export async function signOAuthState(input: { userId: string; nonce: string }, secret: string, now = Date.now()) {
	if (!secret) throw new Error("OAuth state signing is not configured. Set CREDENTIAL_ENCRYPTION_KEY or STACK_SECRET_SERVER_KEY.");
	const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ u: input.userId, n: input.nonce, e: now + OAUTH_STATE_TTL_MS })));
	return `${payload}.${await hmac(secret, payload)}`;
}

/** Returns the signed claims, or null for a forged, tampered or expired state. */
export async function verifyOAuthState(state: string, secret: string, now = Date.now()): Promise<{ userId: string; nonce: string } | null> {
	const [payload, signature, extra] = state.split(".");
	if (!secret || !payload || !signature || extra !== undefined) return null;
	if (!constantTimeEqual(signature, await hmac(secret, payload))) return null;
	try {
		const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { u?: unknown; n?: unknown; e?: unknown };
		if (typeof claims.u !== "string" || typeof claims.n !== "string" || typeof claims.e !== "number" || claims.e < now) return null;
		return { userId: claims.u, nonce: claims.n };
	} catch {
		return null;
	}
}

export type GoogleTokens = { accessToken: string; expiresInSeconds: number; refreshToken: string | null; scopes: string[] };

export type GoogleTokenResult = { ok: true; tokens: GoogleTokens } | { ok: false; status: number; error: string; message: string };

export function parseGoogleTokenResponse(status: number, body: string): GoogleTokenResult {
	let json: Record<string, unknown> = {};
	try {
		json = JSON.parse(body) as Record<string, unknown>;
	} catch {
		// Non-JSON error page; handled below.
	}
	if (status >= 200 && status < 300 && typeof json.access_token === "string") {
		return {
			ok: true,
			tokens: {
				accessToken: json.access_token,
				expiresInSeconds: typeof json.expires_in === "number" ? json.expires_in : 3600,
				refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
				scopes: typeof json.scope === "string" ? json.scope.split(/\s+/).filter(Boolean) : [],
			},
		};
	}
	const error = typeof json.error === "string" ? json.error : `http_${status}`;
	const description = typeof json.error_description === "string" ? json.error_description : "";
	return { ok: false, status, error, message: description || `Google token endpoint returned HTTP ${status}.` };
}

async function postForm(url: string, form: Record<string, string>) {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(form).toString(),
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	return { status: response.status, body: await response.text().catch(() => "") };
}

export async function exchangeGoogleCode(credentials: GoogleClientCredentials, redirectUri: string, code: string) {
	const { status, body } = await postForm(GOOGLE_TOKEN_URL, {
		code,
		client_id: credentials.clientId,
		client_secret: credentials.clientSecret,
		redirect_uri: redirectUri,
		grant_type: "authorization_code",
	});
	return parseGoogleTokenResponse(status, body);
}

export async function refreshGoogleAccessToken(credentials: GoogleClientCredentials, refreshToken: string) {
	const { status, body } = await postForm(GOOGLE_TOKEN_URL, {
		refresh_token: refreshToken,
		client_id: credentials.clientId,
		client_secret: credentials.clientSecret,
		grant_type: "refresh_token",
	});
	return parseGoogleTokenResponse(status, body);
}

/** Best effort: a token Google already invalidated answers 400, which is fine on disconnect. */
export async function revokeGoogleToken(token: string) {
	const { status } = await postForm(GOOGLE_REVOKE_URL, { token });
	return { ok: status === 200 || status === 400, status };
}
