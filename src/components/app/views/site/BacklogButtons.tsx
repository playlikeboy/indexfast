/**
 * The two backlog actions (send never-sent URLs, re-queue failed ones), shared by Overview and
 * URLs so the labels and pending text match. Only one of them is ever the primary key: submit
 * when there is something unsent, otherwise retry, so a screen never shows two cobalt keys.
 * Renders nothing unless the site may submit (verified and not paused).
 */
import { retryFailedAction, submitPendingAction } from "@/app/actions";
import { ActionButton } from "@/components/app/client";

export function BacklogButtons({ siteId, canSubmit, pending, failed }: { siteId: string; canSubmit: boolean; pending: number; failed: number }) {
	if (!canSubmit || (pending <= 0 && failed <= 0)) return null;
	return (
		<>
			{pending > 0 ? (
				<ActionButton action={submitPendingAction.bind(null, siteId)} variant="primary" pendingLabel="Submitting...">
					Submit {pending.toLocaleString()} not sent
				</ActionButton>
			) : null}
			{failed > 0 ? (
				<ActionButton action={retryFailedAction.bind(null, siteId)} variant={pending > 0 ? "secondary" : "primary"} pendingLabel="Re-queuing...">
					Retry {failed.toLocaleString()} failed
				</ActionButton>
			) : null}
		</>
	);
}
