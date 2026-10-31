/*
 * The opening screen every /resources page shares: a short head, one sentence and at most two
 * actions, all inside the first 1280x800 screen. No eyebrow or breadcrumb label above the head;
 * the way back to the hub sits with the actions so it reads as navigation, not as a tag.
 */
import type { ReactNode } from "react";
import { Container } from "@/components/ui";

export function ResourceHeader({ id, title, lede, actions }: { id?: string; title: ReactNode; lede: ReactNode; actions?: ReactNode }) {
	return (
		<header className="pt-16 pb-20">
			<Container>
				<div className="max-w-3xl">
					<h1 id={id} className="text-display-s">
						{title}
					</h1>
					<p className="mt-6 max-w-2xl text-lead text-ink-2">{lede}</p>
					{actions ? <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div> : null}
				</div>
			</Container>
		</header>
	);
}
