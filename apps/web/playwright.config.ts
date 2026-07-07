import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	forbidOnly: Boolean(process.env.CI),
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
		command: process.env.CI ? "pnpm start" : "pnpm dev",
		reuseExistingServer: !Boolean(process.env.CI),
		url: "http://127.0.0.1:3000",
		timeout: 120_000,
	},
});
