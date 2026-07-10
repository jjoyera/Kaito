import { expect, test } from "@playwright/test";

test("does not expose /login in production", async ({ page }) => {
	const response = await page.goto("/login");

	expect(response?.status()).toBe(404);
	await expect(
		page.getByRole("heading", { name: /sign in to kaito/i }),
	).toHaveCount(0);
});
