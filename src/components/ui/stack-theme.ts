/*
 * Cobalt colours for Stack Auth's hosted screens (sign-in, sign-up, account settings).
 * Stack parses theme colours with a library that reads neither oklch() nor var(), so these are
 * the sRGB conversions of the tokens in src/app/globals.css. Change a token there first, then
 * re-derive the hex here; this file is a mirror, never the source.
 */
export const stackCobaltTheme = {
	radius: "6px",
	light: {
		background: "#f8fbfe", // --color-paper
		foreground: "#111825", // --color-ink
		card: "#fcfdff", // --color-panel
		cardForeground: "#111825",
		popover: "#fcfdff",
		popoverForeground: "#111825",
		primary: "#0462d3", // --color-accent
		primaryForeground: "#f8fbfe", // --color-accent-ink
		secondary: "#e3e8ef", // --color-paper-3
		secondaryForeground: "#363e49", // --color-ink-2
		muted: "#eff3f8", // --color-paper-2
		mutedForeground: "#5d646e", // --color-muted
		accent: "#e3e8ef",
		accentForeground: "#111825",
		destructive: "#be2323", // --color-error
		destructiveForeground: "#f8fbfe",
		border: "#dadee4", // --color-rule
		input: "#5d646e", // field edges need 3:1, so the muted ink, not the rule
		ring: "#0462d3", // --color-focus
	},
	dark: {
		background: "#0a0d12",
		foreground: "#e7ecf0",
		card: "#11151b",
		cardForeground: "#e7ecf0",
		popover: "#11151b",
		popoverForeground: "#e7ecf0",
		primary: "#4f91f2",
		primaryForeground: "#060d1a",
		secondary: "#181d25",
		secondaryForeground: "#bec5cd",
		muted: "#11151b",
		mutedForeground: "#9199a4",
		accent: "#181d25",
		accentForeground: "#e7ecf0",
		destructive: "#f27166",
		destructiveForeground: "#0a0d12",
		border: "#262c33",
		input: "#9199a4",
		ring: "#5598f9",
	},
};
