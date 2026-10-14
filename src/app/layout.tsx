import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stack } from "@/stack";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const SITE_URL = "https://indexfast.co";
const siteDescription = "Monitor sitemaps, find indexing blockers, and submit URL updates through IndexNow and Bing. SEO operations for teams and AI workflows.";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "IndexFast — SEO Indexing Automation & Diagnostics",
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
		url: SITE_URL,
		siteName: "IndexFast",
		title: "IndexFast — SEO Indexing Automation & Diagnostics",
		description: siteDescription,
		images: [{ url: SITE_URL + "/og-image.png", width: 1200, height: 630, alt: "IndexFast SEO indexing tools" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "IndexFast — SEO Indexing Automation",
		description: siteDescription,
		images: [SITE_URL + "/og-image.png"],
	},
	alternates: { canonical: SITE_URL },
	icons: { icon: "/logo.png" },
};

const organizationJsonLd = {
	"@context": "https://schema.org",
	"@type": "Organization",
	name: "IndexFast",
	url: SITE_URL,
	logo: SITE_URL + "/favicon.svg",
	sameAs: [],
};

const softwareJsonLd = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: "IndexFast",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: SITE_URL,
	description: siteDescription,
	offers: {
		"@type": "AggregateOffer",
		lowPrice: "0",
		highPrice: "249",
		priceCurrency: "USD",
		offerCount: "5",
	},
};

const faqJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: [
		{
			"@type": "Question",
			name: "Can IndexFast guarantee Google indexing?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "No. Google decides what it indexes. IndexFast helps search engines discover URLs and helps you find technical blockers, but indexing is never guaranteed.",
			},
		},
		{
			"@type": "Question",
			name: "Which search engines can I notify?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "IndexFast supports IndexNow workflows and direct Bing submissions. A successful submission is a discovery signal, not a promise that a page will be indexed.",
			},
		},
		{
			"@type": "Question",
			name: "Can I connect AI agents and developer tools?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes. Connect workflows through the API or remote MCP server, and use the CLI for terminal-based tasks.",
			},
		},
		{
			"@type": "Question",
			name: "Do I need to verify my website?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes, ownership verification is required for site-level automation and protected integrations.",
			},
		},
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<script
					dangerouslySetInnerHTML={{
						__html: "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();",
					}}
				/>
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
			</head>
			<body className={[geistSans.variable, geistMono.variable, "antialiased"].join(" ")}>
				<StackProvider app={stack}>
					<StackTheme>{children}</StackTheme>
				</StackProvider>
			</body>
		</html>
	);
}
