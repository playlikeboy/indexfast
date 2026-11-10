import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Baseline security headers on every route. Framing is refused everywhere so destructive
	// dashboard/admin buttons cannot be clickjacked (Razorpay Checkout frames its own origin into
	// ours, which these headers do not affect). A full CSP is deliberately not set yet: it must
	// allow Razorpay and Stack Auth scripts and needs testing in a browser before it ships.
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
				],
			},
		];
	},
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

