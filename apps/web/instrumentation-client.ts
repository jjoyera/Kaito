import * as Sentry from "@sentry/nextjs";
import { initSentryIfConfigured } from "./lib/sentry-scrubbing";

initSentryIfConfigured(Sentry);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
