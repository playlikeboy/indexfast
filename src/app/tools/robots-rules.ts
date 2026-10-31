/*
 * robots.txt group parsing for the free AI crawler checker. Follows RFC 9309: user-agent lines
 * open a group, consecutive user-agent lines share one, and a crawler obeys only the most specific
 * matching group (its own token beats `*`, and groups naming the same token merge). Within a group
 * the longest matching path wins and Allow wins a tie. A substring or slice scan of the file gets
 * this wrong (it reads the next group's rules), which is why this exists.
 */

export type RobotsRule = { type: "allow" | "disallow"; path: string };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[] };
export type GroupMatch = "bot_group" | "wildcard_group" | "no_matching_group";

export function parseRobotsGroups(text: string): RobotsGroup[] {
	const groups: RobotsGroup[] = [];
	let current: RobotsGroup | null = null;
	let lastWasAgent = false;

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.replace(/#.*$/, "").trim();
		const colon = line.indexOf(":");
		if (colon === -1) continue;
		const field = line.slice(0, colon).trim().toLowerCase();
		const value = line.slice(colon + 1).trim();

		if (field === "user-agent") {
			// A user-agent line after rules starts a new group; consecutive ones share the group.
			if (!current || !lastWasAgent) {
				current = { agents: [], rules: [] };
				groups.push(current);
			}
			current.agents.push(value.toLowerCase());
			lastWasAgent = true;
		} else if ((field === "allow" || field === "disallow") && current) {
			// An empty Disallow means "nothing is disallowed", so it adds no rule.
			if (value) current.rules.push({ type: field, path: value });
			lastWasAgent = false;
		} else {
			// Sitemap and unknown fields do not end a run of user-agent lines in practice, but
			// rules before any user-agent line belong to no group and are ignored.
			if (field !== "sitemap") lastWasAgent = false;
		}
	}
	return groups;
}

/** The rules a crawler with this product token obeys, and which kind of group supplied them. */
export function rulesForAgent(groups: RobotsGroup[], token: string): { rules: RobotsRule[]; match: GroupMatch } {
	const name = token.toLowerCase();
	const own = groups.filter((g) => g.agents.includes(name));
	if (own.length > 0) return { rules: own.flatMap((g) => g.rules), match: "bot_group" };
	const wildcard = groups.filter((g) => g.agents.includes("*"));
	if (wildcard.length > 0) return { rules: wildcard.flatMap((g) => g.rules), match: "wildcard_group" };
	return { rules: [], match: "no_matching_group" };
}

function patternToRegExp(pattern: string): RegExp {
	const anchored = pattern.endsWith("$");
	const body = (anchored ? pattern.slice(0, -1) : pattern)
		.split("*")
		.map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
		.join(".*");
	return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Whether `path` may be crawled under `rules`: longest match wins, Allow wins a tie. */
export function isPathAllowed(rules: RobotsRule[], path: string): boolean {
	let best: RobotsRule | null = null;
	for (const rule of rules) {
		if (!patternToRegExp(rule.path).test(path)) continue;
		const longer = !best || rule.path.length > best.path.length;
		const tieGoesToAllow = best && rule.path.length === best.path.length && rule.type === "allow";
		if (longer || tieGoesToAllow) best = rule;
	}
	return !best || best.type === "allow";
}
