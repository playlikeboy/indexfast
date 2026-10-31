/**
 * Cloudflare Worker entrypoint: OpenNext serves HTTP, `scheduled` runs the hourly automation
 * (sitemap sync + submission queue). Secrets are mirrored into process.env first because the
 * app reads configuration from there and Workers start with it empty.
 */
import handler from "./.open-next/worker.js";

const runtimeEnvKeys = ["DATABASE_URL"] as const;

function bindRuntimeEnv(env: CloudflareEnv) {
	const values = env as unknown as Record<string, unknown>;
	const missing: string[] = [];

	for (const [key, value] of Object.entries(values)) {
		if (typeof value === "string") {
			process.env[key] = value;
		}
	}

	for (const key of runtimeEnvKeys) {
		const value = (values[key] as string | undefined) || process.env[key];
		if (value) {
			process.env[key] = value;
		} else {
			missing.push(key);
		}
	}

	return missing;
}

export default {
	async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
		bindRuntimeEnv(env);
		return handler.fetch(request, env, ctx);
	},

	async scheduled(controller, env, ctx) {
		const missing = bindRuntimeEnv(env);
		if (missing.length > 0) {
			throw new Error(`Scheduled automation requires Cloudflare secrets: ${missing.join(", ")}`);
		}

		const work = (async () => {
			const { runScheduledAutomation } = await import("./src/lib/automation/service");
			try {
				const result = await runScheduledAutomation();
				console.log("IndexFast scheduled automation completed", { cron: controller.cron, result });
			} catch (error) {
				// The run already recorded the failure in cron_runs; rethrow so Cloudflare marks the
				// invocation failed in its own logs too.
				console.error("IndexFast scheduled automation failed", { cron: controller.cron, error });
				throw error;
			}
		})();
		// Awaiting keeps the scheduled event alive for the whole run instead of relying on
		// waitUntil's post-return grace period, which can cut a long run off mid-way and leave
		// its cron_runs row stuck at 'running'. waitUntil stays as a second guard.
		ctx.waitUntil(work);
		await work;
	},
} satisfies ExportedHandler<CloudflareEnv>;

export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";

