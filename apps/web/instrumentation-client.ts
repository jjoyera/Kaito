import * as Sentry from "@sentry/nextjs";
import { buildSentryInitOptions } from "./lib/sentry-scrubbing";

const options = buildSentryInitOptions();

if (options) {
	Sentry.init(options as Parameters<typeof Sentry.init>[0]);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
