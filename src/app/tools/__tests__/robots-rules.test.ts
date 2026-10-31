import { describe, expect, it } from "vitest";
import { isPathAllowed, parseRobotsGroups, rulesForAgent } from "../robots-rules";

function rootAllowed(robots: string, bot: string) {
	const { rules, match } = rulesForAgent(parseRobotsGroups(robots), bot);
	return { allowed: isPathAllowed(rules, "/"), match };
}

describe("robots.txt groups", () => {
	it("does not read the next group's rules (the old slice bug)", () => {
		const robots = "User-agent: GPTBot\nAllow: /\n\nUser-agent: *\nDisallow: /";
		expect(rootAllowed(robots, "GPTBot")).toEqual({ allowed: true, match: "bot_group" });
		expect(rootAllowed(robots, "ClaudeBot")).toEqual({ allowed: false, match: "wildcard_group" });
	});

	it("prefers the bot's own group over a blocking wildcard", () => {
		const robots = "User-agent: *\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /private";
		expect(rootAllowed(robots, "ClaudeBot").allowed).toBe(true);
	});

	it("shares rules across consecutive user-agent lines and matches case-insensitively", () => {
		const robots = "User-agent: CCBot\nuser-agent: gptbot\nDisallow: / # block both\n";
		expect(rootAllowed(robots, "GPTBot")).toEqual({ allowed: false, match: "bot_group" });
		expect(rootAllowed(robots, "CCBot").allowed).toBe(false);
	});

	it("treats an empty Disallow and no matching group as allowed", () => {
		expect(rootAllowed("User-agent: *\nDisallow:", "GPTBot").allowed).toBe(true);
		expect(rootAllowed("User-agent: Googlebot\nDisallow: /", "GPTBot")).toEqual({ allowed: true, match: "no_matching_group" });
	});

	it("applies longest match, Allow on ties, and wildcards", () => {
		const rules = parseRobotsGroups("User-agent: *\nDisallow: /\nAllow: /$\nDisallow: /*.pdf$")[0].rules;
		expect(isPathAllowed(rules, "/")).toBe(true);
		expect(isPathAllowed(rules, "/blog")).toBe(false);
		const tie = parseRobotsGroups("User-agent: *\nDisallow: /a\nAllow: /a")[0].rules;
		expect(isPathAllowed(tie, "/a")).toBe(true);
	});
});
