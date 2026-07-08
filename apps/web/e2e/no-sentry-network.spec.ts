import { expect, test } from "@playwright/test";

// How long (ms) to observe after a potential error for any async Sentry
// SDK transport (envelope / ingestion / store) calls to surface.
const SENTRY_TRANSPORT_OBSERVATION_MS = 500;

test("no DSN renders the app without Sentry ingestion requests", async ({
	page,
}) => {
	const sentryRequests: string[] = [];

	await page.route(
		/sentry\.io|\/api\/\d+\/(envelope|store)|\/envelope\//i,
		async (route) => {
			sentryRequests.push(route.request().url());
			await route.abort();
		},
	);

	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Project scaffold is running." }),
	).toBeVisible();

	// Give any accidental async SDK transport during normal boot/render a brief
	// opportunity to attempt a request.
	await page.waitForTimeout(SENTRY_TRANSPORT_OBSERVATION_MS);

	// Trigger a client-side error via the window ErrorEvent API.  Without a DSN
	// the Sentry SDK must never initialise, so no ingestion request should be
	// made even when the SDK's GlobalHandlers integration would normally fire.
	// This exercises the no-DSN gate on the error-capture path without needing
	// a dedicated Next.js route or API handler.
	await page.evaluate(() => {
		window.dispatchEvent(
			new ErrorEvent("error", {
				error: new Error("no-dsn-validation: synthetic client error"),
				message: "no-dsn-validation: synthetic client error",
				bubbles: true,
			}),
		);
		// Also fire an unhandled rejection to cover the PromiseRejectionHandler path.
		void Promise.reject(
			new Error("no-dsn-validation: synthetic unhandled rejection"),
		);
	});

	// Second observation window: allow the SDK transport window for any async
	// error-capture attempt triggered by the dispatched events above.
	await page.waitForTimeout(SENTRY_TRANSPORT_OBSERVATION_MS);

	expect(sentryRequests).toEqual([]);
});
