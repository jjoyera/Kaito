import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	forbidOnly: Boolean(process.env.CI),
	workers: 1,
	use: {
		baseURL: "http://127.0.0.1:3000",
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
		command: "pnpm dev",
		env: {
			NEXT_PUBLIC_KAITO_TEST_AUTH_ADAPTER: "1",
			NEXT_PUBLIC_SENTRY_DSN: "",
		},
		reuseExistingServer: false,
		url: "http://127.0.0.1:3000",
		timeout: 120_000,
	},
});
