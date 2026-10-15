import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// The dashboard was rebuilt into four screens; keep old deep links (docs, CLI, emails) working.
	async redirects() {
		return [
			{ source: "/dashboard/mcp", destination: "/dashboard/connect", permanent: true },
			{ source: "/dashboard/api-keys", destination: "/dashboard/connect", permanent: true },
			{ source: "/dashboard/alerts", destination: "/dashboard", permanent: true },
			{ source: "/dashboard/submissions", destination: "/dashboard", permanent: true },
			{ source: "/dashboard/sites/:siteId/settings", destination: "/dashboard/sites/:siteId", permanent: true },
		];
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
	initOpenNextCloudflareForDev();
}

