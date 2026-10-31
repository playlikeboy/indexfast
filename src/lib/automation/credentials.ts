/**
 * AES-GCM encryption for third-party credentials at rest (IndexNow keys, Bing API keys).
 * The key derives from CREDENTIAL_ENCRYPTION_KEY, falling back to STACK_SECRET_SERVER_KEY.
 * Decryption tries both secrets, so setting CREDENTIAL_ENCRYPTION_KEY after rows were written
 * with the Stack key does not lock those rows; readSecret reports them as stale so callers
 * re-encrypt them with the primary key.
 */
const ENCRYPTED_PREFIX = "enc:v1:";

function getSecretCandidates() {
	const primary = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim() || "";
	const stack = process.env.STACK_SECRET_SERVER_KEY?.trim() || "";
	return Array.from(new Set([primary, stack].filter(Boolean)));
}

export function hasCredentialEncryptionKey() {
	return getSecretCandidates().length > 0;
}

export function isEncryptedSecret(value: string) {
	return value.startsWith(ENCRYPTED_PREFIX);
}

function toBase64Url(value: Uint8Array) {
	let binary = "";
	for (let offset = 0; offset < value.length; offset += 0x8000) {
		binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
	}
	return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value: string) {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(secret: string) {
	const keyMaterial = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode("indexfast:credentials:v1:" + secret),
	);
	return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string) {
	const cleanValue = value.trim();
	if (!cleanValue) throw new Error("Credential value is required.");
	const [primary] = getSecretCandidates();
	if (!primary) {
		throw new Error("Credential encryption is not configured. Set CREDENTIAL_ENCRYPTION_KEY or STACK_SECRET_SERVER_KEY.");
	}
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		await deriveKey(primary),
		new TextEncoder().encode(cleanValue),
	);
	return ENCRYPTED_PREFIX + toBase64Url(iv) + ":" + toBase64Url(new Uint8Array(ciphertext));
}

/**
 * Decrypt a stored credential. `stale` is true when the row should be rewritten: it is legacy
 * plaintext, or it only decrypted with the fallback (non-primary) secret.
 */
export async function readSecret(value: string): Promise<{ plaintext: string; stale: boolean }> {
	// Backward compatibility: earlier releases stored credential values as plaintext.
	if (!value.startsWith("enc:")) return { plaintext: value, stale: true };
	const parts = value.split(":");
	if (parts.length !== 4 || parts[0] !== "enc" || parts[1] !== "v1") {
		throw new Error("Unsupported credential encryption format.");
	}
	const iv = fromBase64Url(parts[2]);
	const ciphertext = fromBase64Url(parts[3]);
	if (iv.byteLength !== 12 || ciphertext.byteLength < 16) {
		throw new Error("Invalid encrypted credential.");
	}
	const candidates = getSecretCandidates();
	if (candidates.length === 0) {
		throw new Error("Credential encryption is not configured. Set CREDENTIAL_ENCRYPTION_KEY or STACK_SECRET_SERVER_KEY.");
	}
	for (const [index, secret] of candidates.entries()) {
		try {
			const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await deriveKey(secret), ciphertext);
			return { plaintext: new TextDecoder().decode(plaintext), stale: index > 0 };
		} catch {
			// Wrong secret (or tampered data): try the next candidate.
		}
	}
	throw new Error("Unable to decrypt credential. Check CREDENTIAL_ENCRYPTION_KEY / STACK_SECRET_SERVER_KEY.");
}

export async function decryptSecret(value: string) {
	return (await readSecret(value)).plaintext;
}

export function maskCredential(value: string) {
	if (value.length <= 8) return "****";
	return value.slice(0, 4) + "****" + value.slice(-4);
}
