"use client";

/**
 * One-field onboarding: a domain is all we need. Sitemap discovery and the first sync run
 * server-side, then the action redirects to the new site's page. The sitemap URL is optional
 * depth, revealed on request so the default path stays one input.
 */
import { useState } from "react";
import { addSiteAction } from "@/app/actions";
import { Input } from "@/components/ui";
import { ActionForm } from "./client";

export function AddSiteForm({ large }: { large?: boolean }) {
	const [showSitemap, setShowSitemap] = useState(false);
	const size = large ? "lg" : "md";
	return (
		<ActionForm
			action={addSiteAction}
			submitLabel="Add website"
			pendingLabel="Finding your sitemap..."
			size={size}
			inline
			footer={
				showSitemap ? null : (
					<button type="button" onClick={() => setShowSitemap(true)} className="basis-full self-start text-left text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
						I know my sitemap URL
					</button>
				)
			}
		>
			<label className="sr-only" htmlFor="add-site-domain">
				Domain
			</label>
			<Input id="add-site-domain" name="domain" required autoComplete="url" inputMode="url" spellCheck={false} placeholder="example.com" size={size} className={large ? "min-w-0 flex-1" : "min-w-0 flex-1 sm:max-w-sm"} />
			{showSitemap ? (
				<>
					<label className="sr-only" htmlFor="add-site-sitemap">
						Sitemap URL (optional)
					</label>
					<Input id="add-site-sitemap" name="sitemapUrl" inputMode="url" spellCheck={false} placeholder="https://example.com/sitemap.xml (optional)" size={size} className="order-last min-w-0 basis-full" />
				</>
			) : null}
		</ActionForm>
	);
}
