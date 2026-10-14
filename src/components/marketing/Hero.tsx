import Link from "next/link";

export function Hero() {
	return (
		<section className="relative overflow-hidden bg-grid py-20 sm:py-28 lg:py-32 border-b border-border/40">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
				<p className="label-mono mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
					<span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
					IndexFast MCP v2.0 is Live
				</p>
				<h1 className="display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight">
					Autonomous SEO Infrastructure <span className="block mt-2 text-muted">for the AI Agent Era.</span>
				</h1>
				<p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg leading-relaxed text-muted">
					Equip your web properties, CMS pipelines, and AI developers with real-time sitemap BFS parsing, instant IndexNow/Bing push queues, and edge-native diagnostics. 100% Edge-native. Built for Cursor, Claude, and programmatic scale.
				</p>
				<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<Link
						href="/dashboard"
						className="inline-flex items-center justify-center rounded-sm bg-ink px-6 py-3 font-mono text-xs font-black uppercase text-surface transition-all hover:bg-ink/90 hover:shadow-lg"
					>
						Deploy console
					</Link>
					<Link
						href="/dashboard/mcp"
						className="inline-flex items-center justify-center rounded-sm border border-ink px-6 py-3 font-mono text-xs font-black uppercase text-ink transition-all hover:bg-ink hover:text-surface hover:shadow-lg"
					>
						Connect MCP Server
					</Link>
				</div>
				
				<div className="mt-16 mx-auto max-w-3xl">
					<DashboardMockup />
				</div>
			</div>
		</section>
	);
}

function DashboardMockup() {
	return (
		<div className="border border-border bg-card shadow-2xl text-left overflow-hidden">
			{/* Window chrome header */}
			<div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
				<div className="flex items-center gap-1.5">
					<span className="h-2.5 w-2.5 rounded-full bg-red-400" />
					<span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
					<span className="h-2.5 w-2.5 rounded-full bg-green-400" />
				</div>
				<span className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">IndexFast Agent console</span>
				<div className="w-10" />
			</div>
			
			<div className="p-5 sm:p-6 space-y-6">
				{/* Stats Grid */}
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div className="p-4 border border-border/60 bg-surface">
						<p className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted">Sites Tracked</p>
						<p className="mt-1 text-2xl font-black font-mono">48</p>
					</div>
					<div className="p-4 border border-border/60 bg-surface">
						<p className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted">MCP Tools</p>
						<p className="mt-1 text-2xl font-black font-mono">12</p>
					</div>
					<div className="p-4 border border-border/60 bg-surface">
						<p className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted">URLs Processed</p>
						<p className="mt-1 text-2xl font-black font-mono text-accent-foreground bg-accent px-1.5 py-0.5 w-fit">98,421</p>
					</div>
					<div className="p-4 border border-border/60 bg-surface">
						<p className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted">Ingestion Latency</p>
						<p className="mt-1 text-2xl font-black font-mono text-green-600 dark:text-green-400">&lt; 5s</p>
					</div>
				</div>

				{/* CLI Ingestion log simulation */}
				<div className="rounded-md border border-border/60 bg-surface p-4 font-mono text-xs space-y-2 text-muted">
					<div className="flex items-center justify-between border-b border-border/20 pb-2 mb-2">
						<span className="text-[10px] font-bold text-ink uppercase">Real-Time Event Stream</span>
						<span className="text-[9px] uppercase font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
							<span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
							Active
						</span>
					</div>
					<div className="flex items-start gap-2">
						<span className="text-accent font-bold">&gt;</span>
						<span className="text-ink">npx indexfast login --api-key if_live_...</span>
					</div>
					<div className="text-[11px] pl-4 text-muted-foreground">
						[system] Authenticated as user_8ac4f. Billing tier: Growth.
					</div>
					<div className="flex items-start gap-2 mt-2">
						<span className="text-accent font-bold">&gt;</span>
						<span className="text-ink">mcp.submit_url https://30tools.com/seo-analyzer</span>
					</div>
					<div className="text-[11px] pl-4 text-green-600 dark:text-green-400">
						[engine] Submission queued: IndexNow [Success] / Bing Webmaster API [Success]
					</div>
				</div>
			</div>
		</div>
	);
}

