"use client";

/**
 * Yandex Webmaster token form for the Connect page. The token belongs to the user, but Yandex
 * matches it to one host at a time, so the form picks which site to match; the server action
 * re-checks that the site belongs to the signed-in user and is on a plan that includes Yandex.
 *
 * autoSubmit: the action treats a missing field as "on", so an unchecked box would silently
 * mean yes. A hidden "false" after the checkbox is what FormData.get() sees when it is unticked.
 */
import { saveYandexTokenAction } from "@/app/actions";
import { ActionForm } from "@/components/app/client";
import { Field, Input, Select } from "@/components/ui";

export function YandexTokenForm({ sites }: { sites: Array<{ siteId: string; host: string }> }) {
	return (
		<ActionForm
			action={(prev, formData) => saveYandexTokenAction(String(formData.get("siteId") ?? ""), prev, formData)}
			submitLabel="Save token"
			pendingLabel="Checking with Yandex..."
			variant="secondary"
		>
			<div className="grid gap-x-4 sm:grid-cols-2">
				<Field label="Site" hint="Must be added and verified in Yandex Webmaster.">
					{(control) => (
						<Select {...control} name="siteId" defaultValue={sites[0]?.siteId}>
							{sites.map((site) => (
								<option key={site.siteId} value={site.siteId}>
									{site.host}
								</option>
							))}
						</Select>
					)}
				</Field>
				<Field label="Yandex OAuth token" hint="Stored encrypted. Never shown again.">
					{(control) => <Input {...control} name="token" type="password" autoComplete="off" spellCheck={false} placeholder="y0_..." required />}
				</Field>
			</div>
			<label className="flex items-center gap-2 text-sm">
				<input type="checkbox" name="autoSubmit" defaultChecked className="size-4 accent-(--color-accent)" />
				Send new and changed URLs to Yandex automatically
			</label>
			<input type="hidden" name="autoSubmit" value="false" />
		</ActionForm>
	);
}
