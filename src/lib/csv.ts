/**
 * Minimal RFC 4180 CSV writer for client-side exports (bulk index checker results).
 * Quotes every field that needs it and neutralises spreadsheet formula injection, because
 * exported cells hold URLs and messages fetched from arbitrary third-party pages.
 */
export function csvField(value: string | number | boolean | null | undefined): string {
	let text = value === null || value === undefined ? "" : String(value);
	// A leading = + - @ makes Excel/Sheets evaluate the cell as a formula.
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
	return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
