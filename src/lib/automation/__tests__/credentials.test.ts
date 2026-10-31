import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskCredential, readSecret } from "../credentials";

const previousCredentialSecret = process.env.CREDENTIAL_ENCRYPTION_KEY;
const previousStackSecret = process.env.STACK_SECRET_SERVER_KEY;

beforeEach(() => {
	process.env.CREDENTIAL_ENCRYPTION_KEY = "test-encryption-key-with-at-least-32-chars";
	delete process.env.STACK_SECRET_SERVER_KEY;
});

afterEach(() => {
	if (previousCredentialSecret === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
	else process.env.CREDENTIAL_ENCRYPTION_KEY = previousCredentialSecret;
	if (previousStackSecret === undefined) delete process.env.STACK_SECRET_SERVER_KEY;
	else process.env.STACK_SECRET_SERVER_KEY = previousStackSecret;
});

describe("credential encryption", () => {
	it("encrypts credentials and round-trips them using AES-GCM", async () => {
		const encrypted = await encryptSecret("bing-secret-key");
		expect(encrypted).not.toBe("bing-secret-key");
		expect(encrypted).toMatch(/^enc:v1:/);
		expect(await decryptSecret(encrypted)).toBe("bing-secret-key");
		expect(await readSecret(encrypted)).toEqual({ plaintext: "bing-secret-key", stale: false });
	});

	it("rejects tampered encrypted credentials", async () => {
		const encrypted = await encryptSecret("bing-secret-key");
		const parts = encrypted.split(":");
		parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
		await expect(decryptSecret(parts.join(":"))).rejects.toThrow("Unable to decrypt credential");
	});

	it("continues to read legacy plaintext credentials for existing records", async () => {
		expect(await readSecret("legacy-bing-secret")).toEqual({ plaintext: "legacy-bing-secret", stale: true });
	});

	it("requires a server-side secret before encrypting new credentials", async () => {
		delete process.env.CREDENTIAL_ENCRYPTION_KEY;
		delete process.env.STACK_SECRET_SERVER_KEY;
		await expect(encryptSecret("bing-secret-key")).rejects.toThrow("Credential encryption is not configured");
	});

	it("still reads rows written with the Stack key after CREDENTIAL_ENCRYPTION_KEY is added", async () => {
		delete process.env.CREDENTIAL_ENCRYPTION_KEY;
		process.env.STACK_SECRET_SERVER_KEY = "stack-secret-used-before-the-dedicated-key";
		const written = await encryptSecret("indexnow-key");

		process.env.CREDENTIAL_ENCRYPTION_KEY = "new-dedicated-credential-key-32-chars-long";
		expect(await readSecret(written)).toEqual({ plaintext: "indexnow-key", stale: true });

		// Re-encrypting (the upgrade path) moves it to the primary key.
		const upgraded = await encryptSecret("indexnow-key");
		expect(await readSecret(upgraded)).toEqual({ plaintext: "indexnow-key", stale: false });
		delete process.env.STACK_SECRET_SERVER_KEY;
		expect(await decryptSecret(upgraded)).toBe("indexnow-key");
		await expect(decryptSecret(written)).rejects.toThrow("Unable to decrypt credential");
	});

	it("masks credentials for display", () => {
		expect(maskCredential("abcd1234wxyz")).toBe("abcd****wxyz");
		expect(maskCredential("short")).toBe("****");
	});
});
