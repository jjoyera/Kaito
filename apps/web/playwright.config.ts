import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.KAITO_PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
	testDir: "./e2e",
	testIgnore: "login-production.spec.ts",
	forbidOnly: Boolean(process.env.CI),
	workers: 1,
	use: {
		baseURL,
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
			},
		},
	],
	webServer: {
		command: `pnpm dev --port ${webPort}`,
		env: {
			NEXT_PUBLIC_KAITO_TEST_AUTH_ADAPTER: "1",
			NEXT_PUBLIC_SENTRY_DSN: "",
		},
		reuseExistingServer: false,
		url: baseURL,
		timeout: 120_000,
	},
});
