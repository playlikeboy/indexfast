/*
 * /llms.txt, generated from src/lib/llms.ts at build time so prices and page lists match the data
 * files. Static (no request data), served as plain UTF-8 text and cached at the edge.
 */
import { buildLlmsTxt } from "@/lib/llms";

export const dynamic = "force-static";

export function GET() {
	return new Response(buildLlmsTxt(), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=86400",
		},
	});
}
