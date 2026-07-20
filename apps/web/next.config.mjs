import path from "node:path";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs";

const monorepoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
	allowedDevOrigins: ["127.0.0.1"],
	output: "standalone",
	outputFileTracingRoot: monorepoRoot,
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
