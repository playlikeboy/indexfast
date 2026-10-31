import { describe, expect, it } from "vitest";
import { buildGoogleAuthUrl, GOOGLE_SCOPES, OAUTH_STATE_TTL_MS, parseGoogleTokenResponse, signOAuthState, verifyOAuthState } from "../google-oauth";

const secret = "test-secret";

describe("OAuth state", () => {
	it("round-trips user id and nonce", async () => {
		const state = await signOAuthState({ userId: "user_1", nonce: "abc" }, secret, 1_000);
		expect(await verifyOAuthState(state, secret, 2_000)).toEqual({ userId: "user_1", nonce: "abc" });
	});

	it("rejects expired, tampered, or wrongly signed states", async () => {
		const state = await signOAuthState({ userId: "user_1", nonce: "abc" }, secret, 1_000);
		expect(await verifyOAuthState(state, secret, 1_000 + OAUTH_STATE_TTL_MS + 1)).toBeNull();
		expect(await verifyOAuthState(state, "other-secret", 2_000)).toBeNull();
		const [payload, signature] = state.split(".");
		const forged = btoa(JSON.stringify({ u: "attacker", n: "abc", e: 9e15 })).replace(/=/g, "");
		expect(await verifyOAuthState(`${forged}.${signature}`, secret, 2_000)).toBeNull();
		expect(await verifyOAuthState(`${payload}.${signature}.x`, secret, 2_000)).toBeNull();
		expect(await verifyOAuthState("", secret, 2_000)).toBeNull();
	});

	it("refuses to sign without a secret", async () => {
		await expect(signOAuthState({ userId: "u", nonce: "n" }, "")).rejects.toThrow();
	});
});

describe("Google auth URL and token parsing", () => {
	it("asks for offline access, forced consent, and both scopes", () => {
		const url = new URL(buildGoogleAuthUrl({ clientId: "cid", clientSecret: "s" }, "https://indexfast.co/api/integrations/google/callback", "st"));
		expect(url.searchParams.get("access_type")).toBe("offline");
		expect(url.searchParams.get("prompt")).toBe("consent");
		expect(url.searchParams.get("scope")).toBe(`${GOOGLE_SCOPES.webmasters} ${GOOGLE_SCOPES.indexing}`);
		expect(url.searchParams.get("state")).toBe("st");
		expect(url.searchParams.get("client_secret")).toBeNull();
	});

	it("parses success and invalid_grant", () => {
		const ok = parseGoogleTokenResponse(200, JSON.stringify({ access_token: "a", expires_in: 3599, refresh_token: "r", scope: `${GOOGLE_SCOPES.webmasters} openid` }));
		expect(ok).toEqual({ ok: true, tokens: { accessToken: "a", expiresInSeconds: 3599, refreshToken: "r", scopes: [GOOGLE_SCOPES.webmasters, "openid"] } });
		const bad = parseGoogleTokenResponse(400, JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }));
		expect(bad).toMatchObject({ ok: false, error: "invalid_grant", message: "Token has been expired or revoked." });
		expect(parseGoogleTokenResponse(500, "<html>")).toMatchObject({ ok: false, error: "http_500" });
	});
});
