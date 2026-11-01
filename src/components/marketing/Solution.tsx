/*
 * How it works: the three real setup steps beside the product walkthrough video, then the three
 * things the product does once it runs. Capabilities live here (not in their own section) so each
 * fact appears once on the page: queue and engine detail belong to SearchEnginesShowcase.
 * The video is the only footage of the running product we have, so it is shown large in a plain
 * cut frame (never a drawn browser window). preload="metadata" keeps the 9 MB file off the
 * critical path; the poster is a still from 4s because mobile browsers paint nothing from
 * metadata alone, and the #t=4 fragment starts playback on that same frame.
 */
import { Container } from "@/components/ui";

const steps = [
	{ title: "Add your domain", desc: "We find your sitemap and import every URL. Nothing to configure." },
	{ title: "Drop in one file", desc: "Put a small key file in public/, or ask your AI editor to do it over MCP." },
	{ title: "Forget about it", desc: "New and updated pages are submitted automatically, with retries." },
];

const features = [
	{ title: "Bing Webmaster API + IndexNow", desc: "Broadcast through IndexNow to Bing, Yandex, Naver and Seznam. On Pro and Unlimited, add your Bing Webmaster API key for direct submissions." },
	{ title: "Agent-native MCP & SKILL.md", desc: "Connect Claude Code, Cursor, Windsurf or VS Code and ask your AI to submit new pages as it ships them." },
	{ title: "Catch what blocks indexing", desc: "Check any URL for noindex tags, canonical mismatches, redirects, robots.txt blocks and HTTP errors." },
];

export function Solution() {
	return (
		<section id="workflow" aria-labelledby="workflow-heading" className="py-(--section-gap)">
			<Container>
				<div className="grid items-center gap-y-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-16">
					<div className="min-w-0">
						<h2 id="workflow-heading" className="max-w-[14ch] text-section">
							Live in two minutes. Then it runs itself.
						</h2>
						<ol className="mt-10 border-t border-border">
							{steps.map((step, index) => (
								<li key={step.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-b border-border py-6">
									<span className="num font-display text-title font-semibold text-muted">{index + 1}</span>
									<div className="min-w-0">
										<h3 className="text-title">{step.title}</h3>
										<p className="mt-2 max-w-[44ch] text-ink-2">{step.desc}</p>
									</div>
								</li>
							))}
						</ol>
					</div>
					<div className="ui-cut min-w-0 overflow-hidden bg-code-bg">
						<video
							className="block aspect-video w-full"
							src="/IndexFast-Editorial-v2.mp4#t=4"
							poster="/IndexFast-Editorial-v2-poster.jpg"
							controls
							playsInline
							preload="metadata"
							aria-label="IndexFast product walkthrough video"
						>
							<a href="/IndexFast-Editorial-v2.mp4">Watch the IndexFast walkthrough</a>
						</video>
					</div>
				</div>
				{/* id="features" is the nav and footer anchor for what the product does. */}
				<ul id="features" aria-label="What IndexFast does" className="mt-24 border-t border-border">
					{features.map((feature) => (
						<li key={feature.title} className="grid gap-y-2 border-b border-border py-7 lg:grid-cols-12 lg:gap-x-(--gap-columns)">
							<h3 className="text-title lg:col-span-5">{feature.title}</h3>
							<p className="max-w-[60ch] text-ink-2 lg:col-span-7 lg:text-lead">{feature.desc}</p>
						</li>
					))}
				</ul>
			</Container>
		</section>
	);
}
