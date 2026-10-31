import type { Metadata } from "next";
import { Familjen_Grotesk, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stack } from "@/stack";
import { PageViewTracker } from "@/components/app/PageViewTracker";
import { stackCobaltTheme } from "@/components/ui/stack-theme";

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
		highPrice: "99",
		priceCurrency: "USD",
		offerCount: "3",
	},
};


export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning className={[familjen.variable, plex.variable, jetbrains.variable].join(" ")}>
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<script
					dangerouslySetInnerHTML={{
						__html: "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();",
					}}
				/>
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
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
