import * as Sentry from "@sentry/nextjs";
import { getSentryDsn, sentryPrivacyOptions } from "./lib/sentry-scrubbing";

const dsn = getSentryDsn();

if (dsn) {
	Sentry.init({
		dsn,
		...sentryPrivacyOptions(),
	} as Parameters<typeof Sentry.init>[0]);
}
