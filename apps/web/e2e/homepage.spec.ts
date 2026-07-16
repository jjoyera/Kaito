import { expect, test } from "@playwright/test";

test("homepage opens the login experience", async ({ page }) => {
	await page.goto("/");

	await expect(
		page.getByRole("heading", { name: /inicia sesión/i }),
	).toBeVisible();
	await expect(page.getByLabel("Correo electrónico")).toBeVisible();
	await expect(page.getByLabel("Contraseña")).toBeVisible();
});
