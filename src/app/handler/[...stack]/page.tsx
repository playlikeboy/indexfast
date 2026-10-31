/*
 * Mount point for every Stack Auth screen (sign in, sign up, account). Stack draws the form with the
 * Cobalt theme set in layout.tsx; this wrapper only centres it on the page ground.
 */
import { StackHandler } from "@stackframe/stack";
import { stack } from "@/stack";

type HandlerPageProps = {
	params: Promise<{ stack?: string[] }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function HandlerPage(props: HandlerPageProps) {
	const params = await props.params;
	const searchParams = await props.searchParams;

	return (
		<main className="flex min-h-dvh items-center justify-center bg-background px-(--gutter) py-(--section-gap-s)">
			<StackHandler
				app={stack}
				fullPage={false}
				routeProps={{
					params,
					searchParams,
				}}
			/>
		</main>
	);
}
