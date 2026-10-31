/*
 * Landing page: the agent-native pitch, from the submission pipeline in the hero to the close.
 * Section order is the argument (how it works and what it does, how agents drive it, where URLs
 * go, then free tools, answers and price); every id here is a nav or footer anchor.
 */
import { Navbar } from "@/components/marketing/Navbar";
import { Hero } from "@/components/marketing/Hero";
import { Solution } from "@/components/marketing/Solution";
import { SearchEnginesShowcase } from "@/components/marketing/SearchEnginesShowcase";
import { FreeTools } from "@/components/marketing/FreeTools";
import { HomePricing } from "@/components/marketing/HomePricing";
import { FAQ, faqs } from "@/components/marketing/FAQ";
import { AgentSection } from "@/components/marketing/landing/AgentSection";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { Footer } from "@/components/marketing/Footer";

// FAQPage markup must match the visible FAQ, so both come from the same array.
const faqJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: faqs.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
};

export default function Home() {
	return (
		<>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
			<Navbar />
			<main>
				<Hero />
				<Solution />
				<AgentSection />
				<SearchEnginesShowcase />
				<FreeTools />
				<FAQ />
				<HomePricing />
				<FinalCTA />
			</main>
			<Footer />
		</>
	);
}
