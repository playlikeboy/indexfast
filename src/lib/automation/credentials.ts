const ENCRYPTED_PREFIX = "enc:v1:";

function getMasterSecret() {
	return process.env.CREDENTIAL_ENCRYPTION_KEY?.trim() || process.env.STACK_SECRET_SERVER_KEY?.trim() || "";
}

export function hasCredentialEncryptionKey() {
	return Boolean(getMasterSecret());
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

async function getEncryptionKey() {
	const secret = getMasterSecret();
	if (!secret) {
		throw new Error("Credential encryption is not configured. Set CREDENTIAL_ENCRYPTION_KEY or STACK_SECRET_SERVER_KEY.");
	}
	const keyMaterial = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode("indexfast:credentials:v1:" + secret),
	);
	return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string) {
	const cleanValue = value.trim();
	if (!cleanValue) throw new Error("Credential value is required.");
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const key = await getEncryptionKey();
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		new TextEncoder().encode(cleanValue),
	);
	return ENCRYPTED_PREFIX + toBase64Url(iv) + ":" + toBase64Url(new Uint8Array(ciphertext));
}

export async function decryptSecret(value: string) {
	// Backward compatibility: earlier releases stored credential values as plaintext.
	// All newly saved values use the authenticated enc:v1 format.
	if (!value.startsWith("enc:")) return value;
	const parts = value.split(":");
	if (parts.length !== 4 || parts[0] !== "enc" || parts[1] !== "v1") {
		throw new Error("Unsupported credential encryption format.");
	}
	const iv = fromBase64Url(parts[2]);
	const ciphertext = fromBase64Url(parts[3]);
	if (iv.byteLength !== 12 || ciphertext.byteLength < 16) {
		throw new Error("Invalid encrypted credential.");
	}
	try {
		const key = await getEncryptionKey();
		const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
		return new TextDecoder().decode(plaintext);
	} catch {
		throw new Error("Unable to decrypt credential. Check CREDENTIAL_ENCRYPTION_KEY / STACK_SECRET_SERVER_KEY.");
	}
}

export async function readStoredSecret(value: string) {
	return decryptSecret(value);
}

export function maskCredential(value: string) {
	if (value.length <= 8) return "****";
	return value.slice(0, 4) + "****" + value.slice(-4);
}
