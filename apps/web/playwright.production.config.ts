import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	testMatch: "login-production.spec.ts",
	forbidOnly: Boolean(process.env.CI),
	workers: 1,
	use: {
		...devices["Desktop Chrome"],
		baseURL: "http://127.0.0.1:3100",
	},
	webServer: {
		command: "pnpm build && pnpm start --port 3100",
		env: {
			VERCEL_ENV: "production",
			NEXT_PUBLIC_SENTRY_DSN: "",
		},
		reuseExistingServer: false,
		url: "http://127.0.0.1:3100",
		timeout: 120_000,
	},
});
