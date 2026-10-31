/*
 * Class-name joiner for the UI primitives. Kept local so src/components/ui has no dependency
 * on the dashboard kit it is replacing.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
	return classes.filter(Boolean).join(" ");
}
