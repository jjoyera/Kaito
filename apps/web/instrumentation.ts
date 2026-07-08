import * as Sentry from "@sentry/nextjs";
import { getSentryDsn } from "./lib/sentry-scrubbing";

export async function register() {
	if (!getSentryDsn()) return;

	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}
}

export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
	if (!getSentryDsn()) return;
	return Sentry.captureRequestError(...args);
};
