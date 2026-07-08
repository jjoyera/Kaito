import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
	allowedDevOrigins: ["127.0.0.1"],
};

const sentryOrg = process.env.SENTRY_ORG?.trim();
const sentryProject = process.env.SENTRY_PROJECT?.trim();
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();

const hasSentryUploadCredentials = Boolean(
	sentryOrg && sentryProject && sentryAuthToken,
);

export default hasSentryUploadCredentials
	? withSentryConfig(nextConfig, {
			org: sentryOrg,
			project: sentryProject,
			authToken: sentryAuthToken,
			silent: true,
			widenClientFileUpload: false,
			telemetry: false,
		})
	: nextConfig;
