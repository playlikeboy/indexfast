import { Navbar } from "@/components/marketing/Navbar";
import { Hero } from "@/components/marketing/Hero";
import { Solution } from "@/components/marketing/Solution";
import { Features } from "@/components/marketing/Features";
import { SearchEnginesShowcase } from "@/components/marketing/SearchEnginesShowcase";
import { FreeTools } from "@/components/marketing/FreeTools";
import { HomePricing } from "@/components/marketing/HomePricing";
import { FAQ, faqs } from "@/components/marketing/FAQ";
import { FinalCTA, Footer } from "@/components/marketing/Footer";

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
				<Features />
				<SearchEnginesShowcase />
				<FreeTools />
				<HomePricing />
				<FAQ />
				<FinalCTA />
			</main>
			<Footer />
		</>
	);
}
