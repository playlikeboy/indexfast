import type { Metadata } from "next";
import { Familjen_Grotesk, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stack } from "@/stack";
import { PageViewTracker } from "@/components/app/PageViewTracker";
import { stackCobaltTheme } from "@/components/ui/stack-theme";
import { SITE_URL, OG_IMAGE, LOGO_URL, softwareApplicationJsonLd } from "@/lib/seo";

// Cobalt faces (DESIGN.md): the variables are read by the font tokens in globals.css, so they sit on <html>.
const familjen = Familjen_Grotesk({
	variable: "--font-familjen",
	subsets: ["latin"],
	weight: ["500", "600"],
	display: "swap",
});

const plex = IBM_Plex_Sans({
	variable: "--font-plex",
	subsets: ["latin"],
	weight: ["400", "500"],
	display: "swap",
});

const jetbrains = JetBrains_Mono({
	variable: "--font-jetbrains",
	subsets: ["latin"],
	weight: ["400", "500"],
	display: "swap",
});

// Site-wide defaults only. Canonical and og:url are deliberately absent here: Next merges metadata
// shallowly, so a root canonical would mark every page without its own as a duplicate of "/".
// Each public page sets them through withPageSeo (src/lib/seo.ts).
const siteDescription = "IndexFast finds pages search engines have not picked up, diagnoses indexing blockers, and submits new and changed URLs through IndexNow, Bing, Yandex, Baidu and Search Console. Built for builders and AI agents (MCP, REST API, CLI).";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "IndexFast: Automatic Indexing for IndexNow, Bing and Search Console",
		template: "%s | IndexFast",
	},
	description: siteDescription,
	keywords: [
		"indexing health",
		"sitemap monitoring",
		"IndexNow automation",
		"SEO diagnostics",
		"unindexed pages",
		"programmatic SEO",
		"bulk index checker",
		"search engine visibility",
	],
	authors: [{ name: "IndexFast" }],
	creator: "IndexFast",
	publisher: "IndexFast",
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-image-preview": "large",
			"max-snippet": -1,
			"max-video-preview": -1,
		},
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: "IndexFast",
		title: "IndexFast: Automatic Indexing for IndexNow, Bing and Search Console",
		description: siteDescription,
		images: [OG_IMAGE],
	},
	twitter: {
		card: "summary_large_image",
		title: "IndexFast: Automatic Indexing for IndexNow, Bing and Search Console",
		description: siteDescription,
		images: [OG_IMAGE.url],
	},
	icons: { icon: "/logo.png", apple: "/logo.png" },
};

const organizationJsonLd = {
	"@context": "https://schema.org",
	"@type": "Organization",
	name: "IndexFast",
	url: SITE_URL,
	// /favicon.svg does not exist (404); the logo must be a real, crawlable image.
	logo: LOGO_URL,
	description: siteDescription,
	sameAs: [],
};

const websiteJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebSite",
	name: "IndexFast",
	url: SITE_URL,
	publisher: { "@type": "Organization", name: "IndexFast", url: SITE_URL },
};

// Offers are generated from plans.ts so prices in structured data never drift from /pricing.
const softwareJsonLd = softwareApplicationJsonLd(siteDescription);


export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning className={[familjen.variable, plex.variable, jetbrains.variable].join(" ")}>
			<head>
				<script
					dangerouslySetInnerHTML={{
						__html: "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();",
					}}
				/>
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
			</head>
			<body className="bg-background text-foreground font-sans antialiased">
				<StackProvider app={stack}>
					<StackTheme theme={stackCobaltTheme}>{children}</StackTheme>
					<PageViewTracker />
				</StackProvider>
			</body>
		</html>
	);
}
