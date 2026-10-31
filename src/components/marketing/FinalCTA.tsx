/*
 * The closing action, shared by the landing page and /pricing: one statement, the sign-up key and
 * the MCP route for agents. It is the only primary key on its screen.
 */
import Link from "next/link";
import { Container, buttonClass } from "@/components/ui";

export function FinalCTA() {
	return (
		<section id="cta" aria-labelledby="cta-heading" className="border-t border-border bg-well py-(--section-gap-s)">
			<Container className="grid items-end gap-y-10 lg:grid-cols-12 lg:gap-x-(--gap-columns)">
				<div className="min-w-0 lg:col-span-8">
					<h2 id="cta-heading" className="max-w-[16ch] text-display-s">
						Your next page deserves to be found.
					</h2>
					<p className="mt-6 text-lead text-ink-2">Add your site in two minutes. Free for one site, no credit card.</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:justify-end">
					<Link href="/signup" className={buttonClass({ variant: "primary", size: "lg" })}>
						Add your site free
					</Link>
					<Link href="/dashboard/connect" className={buttonClass({ size: "lg" })}>
						Connect MCP
					</Link>
				</div>
			</Container>
		</section>
	);
}
