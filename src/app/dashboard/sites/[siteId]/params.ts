/**
 * Search-param guards for the site page. Kept pure (no Next imports) so they are unit tested.
 * Rules: a repeated param takes its first value; page is a whole number in 1..MAX_PAGE (the cap
 * keeps OFFSET bounded); site ids must be canonical UUIDs because sites.id is a uuid column.
 */
export const MAX_PAGE = 10000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function firstParam(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

export function parsePageNumber(value: string | undefined): number {
	const page = Math.floor(Number(value)) || 1;
	return Math.min(MAX_PAGE, Math.max(1, page));
}

export function isUuid(value: string): boolean {
	return UUID_RE.test(value);
}
