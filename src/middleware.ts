import { NextResponse, type NextRequest } from "next/server";
import { stack } from "@/stack";

export async function middleware(request: NextRequest) {
	try {
		const user = await stack.getUser();
		if (user) {
			return NextResponse.next();
		}
	} catch {
		// Treat stale or malformed auth cookies as signed-out state.
	}

	return NextResponse.redirect(new URL(stack.urls.signIn, request.url));
}

export const config = {
	matcher: ["/dashboard/:path*", "/admin/:path*"],
};
