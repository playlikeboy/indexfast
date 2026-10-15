"use client";

/**
 * One-field onboarding: a domain is all we need. Sitemap discovery and the first sync run
 * server-side, then the action redirects to the new site's page.
 */
import { useState } from "react";
import { addSiteAction } from "@/app/actions";
import { ActionForm } from "./client";
import { inputClass } from "./ui";

export function AddSiteForm({ large }: { large?: boolean }) {
	const [showSitemap, setShowSitemap] = useState(false);
	return (
		<ActionForm action={addSiteAction} submitLabel="Add website" pendingLabel="Finding your sitemap..." inline={!large}>
			<label className="sr-only" htmlFor="domain">
				Domain
			</label>
			<input
				id="domain"
				name="domain"
				required
				autoComplete="url"
				placeholder="yourwebsite.com"
				className={`${inputClass} ${large ? "py-3 text-base" : "min-w-0 flex-1 sm:max-w-sm"}`}
			/>
			{showSitemap ? (
				<input name="sitemapUrl" placeholder="https://yourwebsite.com/sitemap.xml (optional)" className={`${inputClass} ${large ? "" : "min-w-0 flex-1 sm:max-w-sm"}`} />
			) : (
				<button type="button" onClick={() => setShowSitemap(true)} className="w-fit text-left text-xs text-[var(--app-muted)] underline underline-offset-2">
					I know my sitemap URL
				</button>
			)}
		</ActionForm>
	);
}
