import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskCredential, readStoredSecret } from "../credentials";

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
		expect(await readStoredSecret(encrypted)).toBe("bing-secret-key");
	});

	it("rejects tampered encrypted credentials", async () => {
		const encrypted = await encryptSecret("bing-secret-key");
		const parts = encrypted.split(":");
		parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
		await expect(decryptSecret(parts.join(":"))).rejects.toThrow("Unable to decrypt credential");
	});

	it("continues to read legacy plaintext credentials for existing records", async () => {
		expect(await readStoredSecret("legacy-bing-secret")).toBe("legacy-bing-secret");
	});

	it("requires a server-side secret before encrypting new credentials", async () => {
		delete process.env.CREDENTIAL_ENCRYPTION_KEY;
		delete process.env.STACK_SECRET_SERVER_KEY;
		await expect(encryptSecret("bing-secret-key")).rejects.toThrow("Credential encryption is not configured");
	});

	it("masks credentials for display", () => {
		expect(maskCredential("abcd1234wxyz")).toBe("abcd****wxyz");
		expect(maskCredential("short")).toBe("****");
	});
});
