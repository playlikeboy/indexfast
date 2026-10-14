
export function hasCredentialEncryptionKey() {
	return true;
}

export async function encryptSecret(value: string) {
	return value.trim();
}

export async function decryptSecret(value: string) {
	return value;
}

export async function readStoredSecret(value: string) {
	return value;
}

export function storePlainSecret(value: string) {
	return value.trim();
}

export function maskCredential(value: string) {
	if (value.length <= 8) {
		return "****";
	}

	return `${value.slice(0, 4)}****${value.slice(-4)}`;
}
