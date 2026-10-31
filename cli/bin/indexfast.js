#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_PATH = path.join(os.homedir(), ".indexfast.json");
const DEFAULT_HOST = "https://indexfast.co";

// Colors helper
const colors = {
	reset: "\x1b[0m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	cyan: "\x1b[36m",
	gray: "\x1b[90m",
	bold: "\x1b[1m",
};

function printError(msg) {
	console.error(`${colors.red}${colors.bold}Error:${colors.reset} ${msg}`);
}

function printSuccess(msg) {
	console.log(`${colors.green}${colors.bold}Success:${colors.reset} ${msg}`);
}

// Parse args
const args = process.argv.slice(2);
const options = {};
const commandArgs = [];

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg.startsWith("--")) {
		const key = arg.slice(2);
		// check if it needs value
		if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
			options[key] = args[i + 1];
			i++;
		} else {
			options[key] = true;
		}
	} else if (arg.startsWith("-")) {
		const key = arg.slice(1);
		if (key === "h") {
			options["help"] = true;
		} else if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
			options[key] = args[i + 1];
			i++;
		} else {
			options[key] = true;
		}
	} else {
		commandArgs.push(arg);
	}
}

const command = commandArgs[0];
const subArgs = commandArgs.slice(1);

// Help screen
function showHelp() {
	console.log(`
${colors.cyan}${colors.bold}IndexFast CLI${colors.reset} - Automated Indexing & SEO Operations

${colors.bold}Usage:${colors.reset}
  npx indexfast <command> [arguments] [options]

${colors.bold}Commands:${colors.reset}
  ${colors.green}login${colors.reset}                           Log in and verify your IndexFast API Key
  ${colors.green}sites${colors.reset}                           List all connected sites
  ${colors.green}sites:create${colors.reset}                    Connect a new site
  ${colors.green}sitemaps <siteId>${colors.reset}             List sitemap sources for a site
  ${colors.green}sitemaps:add <siteId> <url>${colors.reset}   Add a sitemap source to a site
  ${colors.green}sitemaps:discover <siteId>${colors.reset}    Discover common sitemap/feed paths
  ${colors.green}sitemaps:sync <siteId>${colors.reset}        Trigger sync on sitemaps
  ${colors.green}urls <siteId>${colors.reset}                 List ingested URLs and indexing status
  ${colors.green}submit <siteId> <url...>${colors.reset}      Submit URLs to IndexNow/Bing
  ${colors.green}diagnostics <siteId>${colors.reset}         Run indexability checks for a URL
  ${colors.green}resources:directories${colors.reset}        List prioritized submit directories
  ${colors.green}resources:tools${colors.reset}              List prioritized third-party SEO tools
  ${colors.green}resources:recommend${colors.reset}          Get recommended directories/tools for a goal

${colors.bold}Options:${colors.reset}
  --api-key <key>             IndexFast API Key (for login)
  --host <url>                IndexFast server host (default: https://indexfast.co)
  --domain <domain>           Domain of the site (for sites:create)
  --name <label>              Friendly name for the site (for sites:create)
  --sitemap <url>             Optional sitemap URL (for sites:create)
  --primary                   Set added sitemap as primary sitemap
  --source <sourceId>         Sitemap source ID to sync
  --url <url>                 URL to analyze (for diagnostics)
  --url-id <id>               URL ID to analyze (for diagnostics)
  --limit <number>            Number of items to retrieve (default: 100)
  --priority <P0|P1|P2|P3>    Priority level filter
  --goal <goal>               Your launch or indexing goal
  --json                      Output raw JSON data
  -h, --help                  Show help details

${colors.bold}Examples:${colors.reset}
  npx indexfast login --api-key idxf_live_abcdef123456
  npx indexfast sites
  npx indexfast urls <site-uuid>
  npx indexfast submit <site-uuid> https://example.com/blog-post
  `);
}

if (options.help || !command) {
	showHelp();
	process.exit(0);
}

// Load config
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
	try {
		config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
	} catch (err) {
		// ignore
	}
}

const host = options.host || config.host || DEFAULT_HOST;
const apiKey = options["api-key"] || config.apiKey;

// Setup HTTP fetch wrapper
async function apiFetch(path, method = "GET", body = null) {
	const headers = {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	};

	const url = `${host}${path}`;
	const fetchOpts = {
		method,
		headers,
	};

	if (body) {
		fetchOpts.body = JSON.stringify(body);
	}

	try {
		const res = await fetch(url, fetchOpts);
		const text = await res.text();
		let json;
		try {
			json = JSON.parse(text);
		} catch {
			throw new Error(`Invalid server response: ${text.slice(0, 200)}`);
		}

		if (!res.ok) {
			throw new Error(json.error?.message || json.message || `HTTP ${res.status}: ${text}`);
		}

		return json;
	} catch (err) {
		throw new Error(`API Request failed: ${err.message}`);
	}
}

// Execution block
async function run() {
	if (command === "login") {
		const keyToUse = options["api-key"];
		if (!keyToUse) {
			printError("Missing required option --api-key <key>");
			process.exit(1);
		}

		// Verify key
		console.log(`${colors.cyan}Verifying API key...${colors.reset}`);
		try {
			const headers = {
				Authorization: `Bearer ${keyToUse}`,
				"Content-Type": "application/json",
			};
			const res = await fetch(`${host}/api/v1/sites`, { headers });
			if (!res.ok) {
				throw new Error(`Verification failed with status: ${res.status}`);
			}

			// Save config
			const newConfig = { apiKey: keyToUse, host };
			// The file holds a live API key: owner-only. `mode` applies only on create, so chmod an existing file too.
			fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), { encoding: "utf8", mode: 0o600 });
			fs.chmodSync(CONFIG_PATH, 0o600);
			printSuccess("Successfully logged in and saved credentials.");
		} catch (err) {
			printError(`Invalid API Key or host URL. ${err.message}`);
			process.exit(1);
		}
		return;
	}

	// Check authentication
	if (!apiKey) {
		printError("You are not logged in. Run: npx indexfast login --api-key YOUR_API_KEY");
		process.exit(1);
	}

	try {
		switch (command) {
			case "sites":
			case "sites:list": {
				const data = await apiFetch("/api/v1/sites");
				if (options.json) {
					console.log(JSON.stringify(data, null, 2));
					break;
				}

				console.log(`\n${colors.bold}Connected Sites:${colors.reset}`);
				if (!data.sites || data.sites.length === 0) {
					console.log("No sites connected yet. Run sites:create to add one.");
					break;
				}

				data.sites.forEach((site) => {
					const status = site.verified
						? `${colors.green}Verified${colors.reset}`
						: `${colors.yellow}Pending Verification${colors.reset}`;
					const auto = site.automationEnabled ? `${colors.cyan}Auto Enabled${colors.reset}` : "Auto Disabled";
					console.log(`- ${colors.bold}${site.name}${colors.reset} (ID: ${site.id})`);
					console.log(`  Domain: ${site.domain} | Host: ${site.indexingHost}`);
					console.log(`  Status: ${status} | Automation: ${auto}`);
					console.log(`  Sitemap: ${site.sitemapUrl || "None"}\n`);
				});
				break;
			}

			case "sites:create": {
				const domain = options.domain || subArgs[0];
				const name = options.name || domain;
				const sitemapUrl = options.sitemap;

				if (!domain) {
					printError("Missing site domain. Run with --domain <domain> or as first argument.");
					process.exit(1);
				}

				console.log(`${colors.cyan}Connecting site ${domain}...${colors.reset}`);
				const res = await apiFetch("/api/v1/sites", "POST", { domain, name, sitemapUrl });
				if (options.json) {
					console.log(JSON.stringify(res, null, 2));
					break;
				}

				printSuccess(`Connected site successfully!`);
				console.log(`Site ID: ${res.site.id}`);
				console.log(`Verification Token: ${res.site.verificationToken}`);
				break;
			}

			case "sitemaps":
			case "sitemaps:list": {
				const siteId = subArgs[0];
				if (!siteId) {
					printError("Usage: npx indexfast sitemaps <siteId>");
					process.exit(1);
				}

				const data = await apiFetch(`/api/v1/sites/${siteId}/sitemaps`);
				if (options.json) {
					console.log(JSON.stringify(data, null, 2));
					break;
				}

				console.log(`\n${colors.bold}Sitemaps List:${colors.reset}`);
				if (!data.sitemaps || data.sitemaps.length === 0) {
					console.log("No sitemaps found.");
					break;
				}

				data.sitemaps.forEach((source) => {
					const pri = source.isPrimary ? `${colors.green}[Primary]${colors.reset} ` : "";
					console.log(`- ${pri}${source.url}`);
					console.log(`  ID: ${source.id} | Status: ${source.status}`);
					console.log(`  Last Sync: ${source.lastSyncAt || "Never"}`);
					if (source.lastErrorMessage) {
						console.log(`  ${colors.red}Error:${colors.reset} ${source.lastErrorMessage}`);
					}
					console.log("");
				});
				break;
			}

			case "sitemaps:add": {
				const siteId = subArgs[0];
				const sitemapUrl = subArgs[1] || options.url;
				const isPrimary = !!options.primary;

				if (!siteId || !sitemapUrl) {
					printError("Usage: npx indexfast sitemaps:add <siteId> <sitemapUrl> [--primary]");
					process.exit(1);
				}

				console.log(`${colors.cyan}Adding sitemap source...${colors.reset}`);
				const res = await apiFetch(`/api/v1/sites/${siteId}/sitemaps`, "POST", {
					sitemapUrl,
					isPrimary,
				});

				if (options.json) {
					console.log(JSON.stringify(res, null, 2));
					break;
				}

				printSuccess("Sitemap source added successfully!");
				console.log(`Sitemap ID: ${res.sitemap.id}`);
				break;
			}

			case "sitemaps:discover": {
				const siteId = subArgs[0];
				if (!siteId) {
					printError("Usage: npx indexfast sitemaps:discover <siteId>");
					process.exit(1);
				}

				console.log(`${colors.cyan}Probing common paths for sitemaps...${colors.reset}`);
				const res = await apiFetch(`/api/v1/sites/${siteId}/sitemaps`, "POST", {
					action: "discover",
				});

				if (options.json) {
					console.log(JSON.stringify(res, null, 2));
					break;
				}

				printSuccess(`Sitemap discovery finished!`);
				console.log("Discovered URLs:");
				res.discovered.forEach((url) => console.log(`- ${url}`));
				break;
			}

			case "sitemaps:sync": {
				const siteId = subArgs[0];
				const sourceId = options.source;
				if (!siteId) {
					printError("Usage: npx indexfast sitemaps:sync <siteId> [--source <sourceId>]");
					process.exit(1);
				}

				console.log(`${colors.cyan}Triggering sitemap sync...${colors.reset}`);
				const res = await apiFetch(`/api/v1/sites/${siteId}/sitemaps`, "POST", {
					action: "sync",
					sourceId,
				});

				if (options.json) {
					console.log(JSON.stringify(res, null, 2));
					break;
				}

				printSuccess("Sync complete!");
				if (res.sync && res.sync.results) {
					res.sync.results.forEach((result) => {
						console.log(`Sitemap source ID: ${result.sourceId}`);
						console.log(`  Parsed: ${result.urlCount} URLs`);
						console.log(`  New Ingested: ${result.insertedCount}`);
						console.log(`  Changed: ${result.changedCount}`);
						console.log(`  Queued for submission: ${result.queuedCount}`);
					});
				}
				break;
			}

			case "urls":
			case "urls:list": {
				const siteId = subArgs[0];
				const limit = Number(options.limit || 100);

				if (!siteId) {
					printError("Usage: npx indexfast urls <siteId> [--limit <limit>]");
					process.exit(1);
				}

				const data = await apiFetch(`/api/v1/sites/${siteId}/urls?limit=${limit}`);
				if (options.json) {
					console.log(JSON.stringify(data, null, 2));
					break;
				}

				console.log(`\n${colors.bold}Ingested URLs (showing up to ${limit}):${colors.reset}`);
				if (!data.urls || data.urls.length === 0) {
					console.log("No URLs found for this site.");
					break;
				}

				data.urls.forEach((url) => {
					let statusColor = colors.gray;
					if (url.indexingStatus === "indexed") statusColor = colors.green;
					else if (url.indexingStatus === "blockers") statusColor = colors.red;
					else if (url.indexingStatus === "not_indexed") statusColor = colors.yellow;

					console.log(`- ${url.loc}`);
					console.log(`  Status: ${statusColor}${url.indexingStatus}${colors.reset} | HTTP: ${url.httpStatus || "N/A"}`);
					console.log(`  Last Checked: ${url.lastCheckedAt || "Never"} | Submitted: ${url.lastSubmittedAt || "Never"}`);
				});
				break;
			}

			case "submit":
			case "urls:submit": {
				const siteId = subArgs[0];
				const urlsToSubmit = subArgs.slice(1);

				if (!siteId || urlsToSubmit.length === 0) {
					printError("Usage: npx indexfast submit <siteId> <url1> [url2] ...");
					process.exit(1);
				}

				console.log(`${colors.cyan}Submitting URLs...${colors.reset}`);
				let res;
				if (urlsToSubmit.length === 1) {
					res = await apiFetch(`/api/v1/sites/${siteId}/submissions`, "POST", {
						url: urlsToSubmit[0],
					});
				} else {
					res = await apiFetch(`/api/v1/sites/${siteId}/submissions`, "POST", {
						urls: urlsToSubmit,
					});
				}

				if (options.json) {
					console.log(JSON.stringify(res, null, 2));
					break;
				}

				printSuccess("URLs submitted to discovery pipelines successfully!");
				console.log(res);
				break;
			}

			case "diagnostics":
			case "run-diagnostics": {
				const siteId = subArgs[0];
				const url = options.url || subArgs[1];
				const urlId = options["url-id"];

				if (!siteId || (!url && !urlId)) {
					printError("Usage: npx indexfast diagnostics <siteId> --url <url> OR --url-id <id>");
					process.exit(1);
				}

				console.log(`${colors.cyan}Running live SEO & indexability checks...${colors.reset}`);
				const res = await apiFetch(`/api/v1/sites/${siteId}/diagnostics`, "POST", {
					url,
					urlId,
				});

				if (options.json) {
					console.log(JSON.stringify(res, null, 2));
					break;
				}

				const d = res.diagnostics;
				console.log(`\n${colors.bold}Diagnostic Report for:${colors.reset} ${d.loc}`);
				const statusText = d.status === "pass" ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
				console.log(`Overall Status: ${statusText}`);
				console.log(`HTTP Status: ${d.httpStatus === 200 ? colors.green : colors.red}${d.httpStatus}${colors.reset}`);
				console.log(`Noindex tags: ${d.noindex ? `${colors.red}Detected${colors.reset}` : `${colors.green}None${colors.reset}`}`);
				console.log(`Canonical href: ${d.canonical || "None"}`);
				break;
			}

			case "resources:directories": {
				const priority = options.priority;
				const query = priority ? `?priority=${priority}` : "";
				const res = await apiFetch(`/api/v1/resources/directories${query}`);

				if (options.json) {
					console.log(JSON.stringify(res, null, 2));
					break;
				}

				console.log(`\n${colors.bold}SEO Directories to Submit to:${colors.reset}`);
				res.directories.forEach((dir) => {
					console.log(`- ${colors.bold}${dir.name}${colors.reset} [${dir.priority}]`);
					console.log(`  URL: ${dir.url}`);
					console.log(`  Description: ${dir.description}`);
					console.log(`  DR: ${dir.domainRating} | Category: ${dir.category}\n`);
				});
				break;
			}

			case "resources:tools": {
				const priority = options.priority;
				const query = priority ? `?priority=${priority}` : "";
				const res = await apiFetch(`/api/v1/resources/tools${query}`);

				if (options.json) {
					console.log(JSON.stringify(res, null, 2));
					break;
				}

				console.log(`\n${colors.bold}Recommended SEO Tools:${colors.reset}`);
				res.tools.forEach((tool) => {
					console.log(`- ${colors.bold}${tool.name}${colors.reset} [${tool.priority}]`);
					console.log(`  URL: ${tool.url}`);
					console.log(`  Purpose: ${tool.purpose}`);
					console.log(`  Cost: ${tool.cost} | Category: ${tool.category}\n`);
				});
				break;
			}

			case "resources:recommend": {
				const goal = options.goal || subArgs.join(" ");
				if (!goal) {
					printError('Usage: npx indexfast resources:recommend --goal "<goal details>"');
					process.exit(1);
				}

				console.log(`${colors.cyan}Analyzing goal and recommending resources...${colors.reset}`);
				const dirsData = await apiFetch("/api/v1/resources/directories");
				const toolsData = await apiFetch("/api/v1/resources/tools");

				const g = goal.toLowerCase();
				let recommendedDirs = [];
				let recommendedTools = [];

				if (g.includes("ai") || g.includes("agent") || g.includes("mcp")) {
					recommendedDirs = dirsData.directories.filter((d) => d.category === "ai" || d.category === "agent").slice(0, 15);
					recommendedTools = toolsData.tools.filter((t) => t.category === "ai-seo" || t.category === "structured-data").slice(0, 8);
				} else if (g.includes("startup") || g.includes("launch") || g.includes("yc")) {
					recommendedDirs = dirsData.directories.filter((d) => d.category === "launch" || d.category === "startup").slice(0, 20);
					recommendedTools = toolsData.tools.filter((t) => t.priority === "P0").slice(0, 8);
				} else {
					recommendedDirs = dirsData.directories.slice(0, 20);
					recommendedTools = toolsData.tools.slice(0, 12);
				}

				if (options.json) {
					console.log(JSON.stringify({ directories: recommendedDirs, tools: recommendedTools }, null, 2));
					break;
				}

				console.log(`\n${colors.bold}Recommended SEO Resources for your goal: "${goal}":${colors.reset}`);

				console.log(`\n${colors.cyan}${colors.bold}Directories to submit to:${colors.reset}`);
				recommendedDirs.forEach((dir) => {
					console.log(`- ${colors.bold}${dir.name}${colors.reset} [Category: ${dir.category}, DR: ${dir.domainRating}] -> ${dir.url}`);
				});

				console.log(`\n${colors.cyan}${colors.bold}Tools to use:${colors.reset}`);
				recommendedTools.forEach((tool) => {
					console.log(`- ${colors.bold}${tool.name}${colors.reset} [${tool.cost}] -> ${tool.url}`);
				});
				break;
			}

			default:
				printError(`Unknown command: ${command}`);
				showHelp();
				process.exit(1);
		}
	} catch (err) {
		printError(err.message);
		process.exit(1);
	}
}

run();