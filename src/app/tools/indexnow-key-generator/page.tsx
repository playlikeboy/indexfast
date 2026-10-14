import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "IndexNow Key Generator", url: `${SITE_URL}/tools/indexnow-key-generator` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "IndexNow Key Generator",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/indexnow-key-generator`,
	description:
		"Generate a secure random IndexNow API key for Bing, Yandex, and other supported search engines.",
	offers: {
		"@type": "AggregateOffer",
		lowPrice: "0",
		highPrice: "0",
		priceCurrency: "USD",
	},
};

const faqJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: [
		{
			"@type": "Question",
			name: "What is IndexNow?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "IndexNow is a protocol supported by Bing and other search engines that lets you notify them when URLs on your site are created, updated, or deleted, helping supported engines discover changes faster.",
			},
		},
		{
			"@type": "Question",
			name: "Where do I put the IndexNow key?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Host the key as a plain text file at the root of your domain: https://yourdomain.com/{your-key}.txt. Search engines verify the key by fetching that URL.",
			},
		},
	],
};

export const metadata = {
	title: "Free IndexNow Key Generator | Generate Secure IndexNow API Keys",
	description:
		"Generate a secure random IndexNow API key for Bing, Yandex, and other supported search engines. Free key generator for indexing automation.",
	keywords: [
		"indexnow key generator",
		"generate indexnow key",
		"indexnow api key",
		"bing indexnow key",
		"indexnow key generator tool",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/indexnow-key-generator`,
	},
};

export default function IndexNowKeyGeneratorPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd) }}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
				/>
				<section className="py-20 sm:py-28" aria-labelledby="tool-heading">
					<div className="mx-auto max-w-3xl px-4 sm:px-6">
						<p className="label-mono">Free SEO Tool</p>
						<h1 id="tool-heading" className="display mt-3 text-4xl sm:text-5xl">
							IndexNow Key{" "}
							<span className="text-highlight">Generator</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Generate a secure random IndexNow API key for Bing, Yandex, and other supported
							search engines. Free and instant.
						</p>

						<ToolRunner toolType="indexnow-key-generator" buttonLabel="Generate IndexNow Key" placeholder="example.com" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">What is IndexNow?</h2>
							<p>
								IndexNow is an open protocol that lets you notify supported search engines when URLs
								on your site are created, updated, or deleted. This helps search engines discover
								changed content faster than waiting for regular crawl cycles.
							</p>
							<h2 className="text-base font-bold text-ink">How to set up IndexNow</h2>
							<ol className="list-decimal space-y-2 pl-5">
								<li>Generate an IndexNow key using this tool.</li>
									<li>Host the key as a plain text file at https://yourdomain.com/{"{key}"}.txt.</li>
								<li>Verify the key is publicly accessible.</li>
								<li>Submit URLs using the key via the IndexNow API.</li>
							</ol>
							<h2 className="text-base font-bold text-ink">Supported search engines</h2>
							<p>
								Bing is the primary supporter of IndexNow. Yandex and other engines have also
								adopted the protocol. Keeping a valid key ensures you can submit changes whenever
								you publish or update pages.
							</p>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
