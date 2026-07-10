import { expect, test } from "@playwright/test";

test("exposes /login in production", async ({ page }) => {
	const response = await page.goto("/login");

	expect(response?.status()).toBe(200);
	await expect(
		page.getByRole("heading", { name: /inicia sesión/i }),
	).toBeVisible();
	await expect(page.getByText("Kaito", { exact: true })).toBeVisible();
});
