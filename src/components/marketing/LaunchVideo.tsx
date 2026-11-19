/*
 * The 35 second launch cut (4:5, captions burned in so it reads muted), placed right after the hero
 * as the quickest summary of the product. It sits in a plain cut frame capped at a phone-like width
 * so a portrait video never towers over the section. preload="metadata" keeps the file off the
 * critical path; the poster gives mobile browsers a frame to paint. Source and script live in
 * marketing/launch-video/. VideoObject markup describes only what the visible video shows.
 */
import { Container } from "@/components/ui";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://indexfast.co";

const videoJsonLd = {
	"@context": "https://schema.org",
	"@type": "VideoObject",
	name: "IndexFast in 35 seconds",
	description:
		"Add a domain, host one key file, and IndexFast sends new and changed URLs to IndexNow, Bing, Yandex and Baidu, with Search Console inspection and an MCP server for AI agents.",
	thumbnailUrl: `${SITE}/IndexFast-Launch-poster.jpg`,
	contentUrl: `${SITE}/IndexFast-Launch.mp4`,
	uploadDate: "2026-11-15",
	duration: "PT35S",
};

export function LaunchVideo() {
	return (
		<section aria-labelledby="launch-heading" className="border-b border-border py-(--section-gap)">
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }} />
			<Container className="grid items-center gap-y-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-16">
				<div className="min-w-0">
					<h2 id="launch-heading" className="max-w-[16ch] text-section">
						IndexFast in 35 seconds.
					</h2>
					<p className="mt-6 max-w-[44ch] text-lead text-ink-2">
						One domain, one key file, then every new page goes to the engines that accept it. Your AI editor can run the rest.
					</p>
				</div>
				<div className="ui-cut mx-auto w-full max-w-[420px] min-w-0 overflow-hidden bg-code-bg lg:mr-0">
					<video
						className="block aspect-[4/5] w-full"
						src="/IndexFast-Launch.mp4"
						poster="/IndexFast-Launch-poster.jpg"
						controls
						playsInline
						preload="metadata"
						aria-label="IndexFast launch video, 35 seconds, captions included"
					>
						<a href="/IndexFast-Launch.mp4">Watch the IndexFast launch video</a>
					</video>
				</div>
			</Container>
		</section>
	);
}
