/**
 * Support tool: put a user on a plan for N days without checkout (refund goodwill, a manual
 * payment fix). Plan names and prices come from PLANS, never typed here. A grant is not
 * revenue: MRR ignores it and the Business stats count grants separately.
 * Field names (email, plan, days) are the adminGrantPlanAction contract.
 */
import { adminGrantPlanAction } from "@/app/actions";
import { ActionForm } from "@/components/app/client";
import { Field, Input, Panel, Select } from "@/components/ui";
import { PAID_PLANS, PLANS, PLAN_PERIOD_DAYS } from "@/lib/platform/plans";
import { formatUsd } from "./format";

export function GrantPlanPanel() {
	return (
		<Panel title="Grant a plan" description="Overrides the plan and its expiry. Counted as a grant, not revenue.">
			<ActionForm action={adminGrantPlanAction} submitLabel="Apply grant" pendingLabel="Applying" variant="secondary">
				<Field label="User email" required>
					{(control) => <Input {...control} name="email" type="email" autoComplete="off" spellCheck={false} placeholder="user@example.com" />}
				</Field>
				<div className="grid grid-cols-2 gap-3">
					<Field label="Plan">
						{(control) => (
							<Select {...control} name="plan" defaultValue="pro">
								{PAID_PLANS.map((plan) => (
									<option key={plan} value={plan}>
										{`${PLANS[plan].name} (${formatUsd(PLANS[plan].priceUsd)}/mo)`}
									</option>
								))}
								<option value="free">{`${PLANS.free.name} (reset)`}</option>
							</Select>
						)}
					</Field>
					<Field label="Days" hint="Ignored for Free">
						{(control) => <Input {...control} name="days" type="number" inputMode="numeric" min={1} max={3650} defaultValue={PLAN_PERIOD_DAYS} />}
					</Field>
				</div>
			</ActionForm>
		</Panel>
	);
}
