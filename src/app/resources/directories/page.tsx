/*
 * /resources/directories: the prioritized launch-directory catalog as one ruled table. The
 * priority filter lives in the URL (?priority=P0..P3) so a filtered view is linkable; the filter
 * links carry aria-current instead of client state. Figures are counted from the catalog itself.
 * Submissions stay manual on purpose: the page links out, it never submits on anyone's behalf.
 */
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { Badge, Container, Stat, Table, Td, Th, cn } from "@/components/ui";
import { getDirectoriesByPriority, getDirectoryStats, type DirectoryPriority } from "@/lib/resources/directories";
import { ResourceHeader } from "../_components/ResourceHeader";

export const metadata = {
	title: "100+ Startup, SaaS, AI, and SEO Submission Directories",
	description:
		"A prioritized list of startup directories, SaaS review sites, AI tool catalogs, developer channels, and SEO resources for launch distribution.",
};

function isPriority(value: string | undefined): value is DirectoryPriority {
	return value === "P0" || value === "P1" || value === "P2" || value === "P3";
}

export default async function DirectoriesPage({ searchParams }: { searchParams: Promise<{ priority?: string }> }) {
	const { priority } = await searchParams;
	const activePriority = isPriority(priority) ? priority : undefined;
	const directories = getDirectoriesByPriority(activePriority);
	const stats = getDirectoryStats();
	const priorities: Array<DirectoryPriority | "all"> = ["all", "P0", "P1", "P2", "P3"];

	return (
		<>
			<Navbar />
			<main>
				<ResourceHeader
					title="100+ launch directories, ranked"
					lede="Ranked by authority, relevance, traffic and access. Track them manually; never spam-submit."
				/>
				<section aria-labelledby="directory-list" className="pb-(--section-gap)">
					<Container>
						<div className="grid grid-cols-2 gap-6 md:grid-cols-4">
							<Stat label="Total" value={stats.total} />
							<Stat label="P0" value={stats.p0} />
							<Stat label="P1" value={stats.p1} />
							<Stat label="Free" value={stats.free} />
						</div>
						<div className="mt-24 flex flex-wrap items-end justify-between gap-6">
							<h2 id="directory-list" className="text-section">
								{activePriority ? `${activePriority} directories` : "Every directory"}
							</h2>
							<nav aria-label="Filter by priority" className="flex flex-wrap gap-1 border-b border-border">
								{priorities.map((item) => {
									const current = (item === "all" && !activePriority) || item === activePriority;
									return (
										<Link
											key={item}
											href={item === "all" ? "/resources/directories" : `/resources/directories?priority=${item}`}
											aria-current={current ? "page" : undefined}
											className={cn(
												"-mb-px inline-flex min-h-11 items-center border-b-2 px-3 font-display text-sm font-medium transition-colors duration-(--dur-short)",
												current ? "border-signal text-ink" : "border-transparent text-muted hover:text-ink",
											)}
										>
											{item === "all" ? "All" : item}
										</Link>
									);
								})}
							</nav>
						</div>
						<Table caption="Submission directories" className="relative mt-6">
							<thead>
								<tr>
									<Th className="sticky left-0 z-(--z-raised) bg-background">Directory</Th>
									<Th>Priority</Th>
									<Th>Category</Th>
									<Th>Cost</Th>
									<Th>Review</Th>
									<Th>Effort</Th>
								</tr>
							</thead>
							<tbody>
								{directories.map((directory) => (
									<tr key={`${directory.name}-${directory.url}`}>
										<Td className="sticky left-0 z-(--z-raised) bg-background min-w-56 md:min-w-72">
											{/* The name is the link so a phone can open a row without scrolling sideways to a last column. */}
											<a
												href={directory.url}
												className="font-display font-medium text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal"
											>
												{directory.name}
											</a>
											<span className="mt-1 block text-ink-2">{directory.bestFor}</span>
											<span className="mt-1 block text-muted">{directory.submissionNotes}</span>
										</Td>
										<Td>
											<Badge>{directory.priority}</Badge>
										</Td>
										<Td className="text-ink-2">{directory.category}</Td>
										<Td className="text-ink-2">{directory.cost}</Td>
										<Td className="text-ink-2">{directory.reviewRequired ? "yes" : "no"}</Td>
										<Td className="text-ink-2">{directory.expectedEffort}</Td>
									</tr>
								))}
							</tbody>
						</Table>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
