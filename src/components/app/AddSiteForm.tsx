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
		<ActionForm
			action={addSiteAction}
			submitLabel="Add website"
			pendingLabel="Finding your sitemap..."
			inline
			footer={
				showSitemap ? null : (
					<button type="button" onClick={() => setShowSitemap(true)} className="basis-full text-left text-xs text-[var(--app-muted)] underline-offset-2 hover:text-[var(--app-text)] hover:underline">
						I know my sitemap URL
					</button>
				)
			}
		>
			<label className="sr-only" htmlFor="domain">
				Domain
			</label>
			<input
				id="domain"
				name="domain"
				required
				autoComplete="url"
				placeholder="yourwebsite.com"
				className={`${inputClass} min-w-0 flex-1 ${large ? "py-2.5 text-base" : "sm:max-w-sm"}`}
			/>
			{showSitemap ? (
				<input name="sitemapUrl" placeholder="https://yourwebsite.com/sitemap.xml (optional)" className={`${inputClass} min-w-0 basis-full ${large ? "order-last" : "sm:max-w-sm sm:basis-auto"}`} aria-label="Sitemap URL" />
			) : null}
		</ActionForm>
	);
}
