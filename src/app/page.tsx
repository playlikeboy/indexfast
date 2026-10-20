import { Navbar } from "@/components/marketing/Navbar";
import { Hero } from "@/components/marketing/Hero";
import { Solution } from "@/components/marketing/Solution";
import { Features } from "@/components/marketing/Features";
import { FreeTools } from "@/components/marketing/FreeTools";
import { HomePricing } from "@/components/marketing/HomePricing";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA, Footer } from "@/components/marketing/Footer";

export default function Home() {
	return (
		<>
			<Navbar />
			<main>
				<Hero />
				<Solution />
				<Features />
				<FreeTools />
				<HomePricing />
				<FAQ />
				<FinalCTA />
			</main>
			<Footer />
		</>
	);
}
