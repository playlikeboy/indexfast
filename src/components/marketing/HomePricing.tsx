import Link from "next/link";

const plans = [
	{
		name: "Free",
		price: "$0",
		period: "",
		desc: "Get the basics in place.",
		features: ["1 web property", "Free SEO tools", "Basic diagnostics"],
		productEnv: null as string | null,
		cta: "Start free",
	},
	{
		name: "Growth",
		price: "$49",
		period: "/mo",
		desc: "Automate your workflow.",
		features: ["10 web properties", "MCP and higher API limits", "Hourly sitemap syncs"],
		productEnv: "DODO_PRODUCT_ID_GROWTH",
		cta: "Choose Growth",
	},
	{
		name: "Agency",
		price: "$99",
		period: "/mo",
		desc: "Manage client properties.",
		features: ["30 web properties", "Bulk checks and client workspaces", "Priority queue and webhooks"],
		productEnv: "DODO_PRODUCT_ID_AGENCY",
		cta: "Choose Agency",
	},
];

function checkoutHref(productEnv: string | null) {
	if (!productEnv) return "/dashboard";
	const productId = process.env[productEnv];
	return productId ? "/api/checkout?productId=" + encodeURIComponent(productId) + "&quantity=1" : "/dashboard";
}

export function HomePricing() {
	return (
		<section className="border-b border-border/40 py-16 sm:py-20" id="pricing" aria-labelledby="pricing-heading">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="label-mono">Pricing</p>
						<h2 id="pricing-heading" className="display mt-3 text-3xl sm:text-4xl">Start free. Scale as you grow.</h2>
						<p className="mt-3 text-sm text-muted">Straightforward plans for solo builders and teams.</p>
					</div>
					<Link href="/pricing" className="inline-flex items-center gap-2 self-start text-xs font-mono font-bold uppercase tracking-wide text-ink transition hover:text-muted sm:self-auto">
						Compare all plans <span aria-hidden="true">↗</span>
					</Link>
				</div>
				<div className="mt-8 grid gap-4 md:grid-cols-3">
					{plans.map((plan) => (
						<article key={plan.name} className={"flex flex-col rounded-lg border p-5 sm:p-6 " + (plan.name === "Growth" ? "border-accent bg-zinc-950 text-zinc-100 shadow-xl dark:bg-zinc-900" : "border-border/70 bg-card/40")}>
							<div className="flex items-center justify-between gap-3">
								<h3 className={"text-sm font-bold uppercase tracking-wide " + (plan.name === "Growth" ? "text-zinc-100" : "text-ink")}>{plan.name}</h3>
								{plan.name === "Growth" ? <span className="rounded-sm bg-accent/15 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-accent">Popular</span> : null}
							</div>
							<div className="mt-4 flex items-baseline gap-1">
								<span className={"stat text-4xl " + (plan.name === "Growth" ? "text-accent" : "text-ink")}>{plan.price}</span>
								{plan.period ? <span className={"text-xs " + (plan.name === "Growth" ? "text-zinc-400" : "text-muted")}>{plan.period}</span> : null}
							</div>
							<p className={"mt-2 text-sm " + (plan.name === "Growth" ? "text-zinc-400" : "text-muted")}>{plan.desc}</p>
							<ul className="mt-5 flex-1 space-y-3">
								{plan.features.map((feature) => (
									<li key={feature} className={"flex items-start gap-2 text-sm " + (plan.name === "Growth" ? "text-zinc-300" : "text-muted")}>
										<span className={"mt-0.5 " + (plan.name === "Growth" ? "text-accent" : "text-ink")} aria-hidden="true">✓</span>
										{feature}
									</li>
								))}
							</ul>
							<Link href={checkoutHref(plan.productEnv)} className={"mt-6 inline-flex min-h-10 items-center justify-center rounded-sm px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wide transition " + (plan.name === "Growth" ? "bg-accent text-accent-foreground hover:bg-accent-dark" : "border border-border text-ink hover:border-ink")}>
								{plan.cta}
							</Link>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
