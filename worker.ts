import handler from "./.open-next/worker.js";

const runtimeEnvKeys = ["DATABASE_URL"] as const;

function bindRuntimeEnv(env: CloudflareEnv) {
	const values = env as unknown as Record<string, string | undefined>;
	const missing: string[] = [];

	for (const key of runtimeEnvKeys) {
		const value = values[key] || process.env[key];
		if (value) {
			process.env[key] = value;
		} else {
			missing.push(key);
		}
	}

	return missing;
}

export default {
	fetch: handler.fetch,

	async scheduled(controller, env, ctx) {
		const missing = bindRuntimeEnv(env);
		if (missing.length > 0) {
			throw new Error(`Scheduled automation requires Cloudflare secrets: ${missing.join(", ")}`);
		}

		ctx.waitUntil(
			(async () => {
				const { runScheduledAutomation } = await import("./src/lib/automation/service");
				const result = await runScheduledAutomation();
				console.log("IndexFast scheduled automation completed", {
					cron: controller.cron,
					result,
				});
			})(),
		);
	},
} satisfies ExportedHandler<CloudflareEnv>;

export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";

