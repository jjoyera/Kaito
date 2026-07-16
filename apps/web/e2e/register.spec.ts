import { expect, test } from "@playwright/test";

test.describe("/register", () => {
	test("shows the registration fields in the centered auth card", async ({
		page,
	}) => {
		await page.goto("/register");

		await expect(
			page.getByRole("heading", { name: "Crea tu cuenta" }),
		).toBeVisible();
		await expect(page.locator(".login-card")).toBeVisible();
		await expect(page.getByLabel("Correo electrónico")).toBeVisible();
		await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
		await expect(page.getByLabel("Repite la contraseña")).toBeVisible();
		await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeVisible();
	});

	test("reports required fields with accessible local errors", async ({ page }) => {
		await page.goto("/register");
		await page.getByRole("button", { name: "Crear cuenta" }).click();

		const email = page.getByLabel("Correo electrónico");
		const password = page.getByLabel("Contraseña", { exact: true });
		const repeatPassword = page.getByLabel("Repite la contraseña");
		await expect(email).toHaveAttribute("aria-invalid", "true");
		await expect(email).toHaveAttribute(
			"aria-describedby",
			"register-email-error",
		);
		await expect(password).toHaveAttribute("aria-invalid", "true");
		await expect(password).toHaveAttribute(
			"aria-describedby",
			"register-password-hint register-password-error",
		);
		await expect(repeatPassword).toHaveAttribute("aria-invalid", "true");
		await expect(
			page.getByRole("alert").filter({
				hasText: "El correo electrónico es obligatorio.",
			}),
		).toBeVisible();
		await expect(
			page.getByRole("alert").filter({ hasText: "La contraseña es obligatoria." }),
		).toBeVisible();
		await expect(
			page.getByRole("alert").filter({ hasText: "Repite la contraseña." }),
		).toBeVisible();
	});

	test("validates email, password strength, and password confirmation locally", async ({
		page,
	}) => {
		await page.goto("/register");
		await page.getByLabel("Correo electrónico").fill("runner-at-kaito");
		await page.getByLabel("Contraseña", { exact: true }).fill("Trail123");
		await page.getByLabel("Repite la contraseña").fill("Different#42");
		await page.getByRole("button", { name: "Crear cuenta" }).click();

		await expect(
			page.getByText("Introduce un correo electrónico válido."),
		).toBeVisible();
		await expect(
			page.getByText(
				"La contraseña debe incluir mayúscula, minúscula, número y símbolo.",
			),
		).toBeVisible();
		await expect(page.getByText("Las contraseñas deben coincidir.")).toBeVisible();
		await expect(page.getByLabel("Correo electrónico")).toHaveValue(
			"runner-at-kaito",
		);
	});

	test("shows an informational result for valid input without backend registration", async ({
		page,
	}) => {
		await page.goto("/register");
		await page.getByLabel("Correo electrónico").fill("runner@kaito.app");
		await page.getByLabel("Contraseña", { exact: true }).fill("Trail#42");
		await page.getByLabel("Repite la contraseña").fill("Trail#42");
		await page.getByRole("button", { name: "Crear cuenta" }).click();

		await expect(page.getByRole("status")).toContainText(
			"La creación de cuentas todavía no está conectada.",
		);
		await expect(page).toHaveURL("/register");
	});
});
