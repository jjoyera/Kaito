import { expect, test } from "@playwright/test";

test.describe("/login", () => {
	test("shows labeled email/password controls and supports keyboard navigation", async ({
		page,
	}) => {
		await page.goto("/login");

		await expect(
			page.getByRole("heading", { name: /inicia sesión/i }),
		).toBeVisible();
		await expect(page.getByLabel("Correo electrónico")).toBeVisible();
		await expect(page.getByLabel("Contraseña")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Iniciar sesión" }),
		).toBeVisible();

		await page.keyboard.press("Tab");
		await expect(page.getByLabel("Correo electrónico")).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(page.getByLabel("Contraseña")).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(
			page.getByRole("button", { name: "Iniciar sesión" }),
		).toBeFocused();
	});

	test("validates required fields locally without attempting authentication", async ({
		page,
	}) => {
		await page.goto("/login");

		await page.getByRole("button", { name: "Iniciar sesión" }).click();

		await expect(
			page.getByText("El correo electrónico es obligatorio."),
		).toBeVisible();
		await expect(page.getByText("La contraseña es obligatoria.")).toBeVisible();
		await expect(page.getByLabel("Correo electrónico")).toHaveValue("");
		await expect(
			page.getByRole("button", { name: "Iniciar sesión" }),
		).toBeEnabled();
		await expect(
			page.getByText(
				"No hemos podido iniciar sesión con ese correo electrónico y contraseña.",
			),
		).toHaveCount(0);
		await expect(
			page.getByText(
				"Kaito no puede conectar con el servicio de inicio de sesión ahora mismo.",
			),
		).toHaveCount(0);
	});

	test("validates email format locally and preserves the entered email value", async ({
		page,
	}) => {
		await page.goto("/login");

		await page.getByLabel("Correo electrónico").fill("runner-at-kaito");
		await page.getByLabel("Contraseña").fill("trail-password");
		await page.getByRole("button", { name: "Iniciar sesión" }).click();

		await expect(
			page.getByText("Introduce un correo electrónico válido."),
		).toBeVisible();
		await expect(page.getByLabel("Correo electrónico")).toHaveValue(
			"runner-at-kaito",
		);
		await expect(
			page.getByRole("button", { name: "Iniciar sesión" }),
		).toBeEnabled();
		await expect(
			page.getByText(
				"No hemos podido iniciar sesión con ese correo electrónico y contraseña.",
			),
		).toHaveCount(0);
		await expect(
			page.getByText(
				"Kaito no puede conectar con el servicio de inicio de sesión ahora mismo.",
			),
		).toHaveCount(0);
	});

	test("prevents duplicate submissions while authentication is pending", async ({
		page,
	}) => {
		await page.goto("/login");

		await page.getByLabel("Correo electrónico").fill("pending@example.com");
		await page.getByLabel("Contraseña").fill("trail-password");
		const submit = page.getByRole("button", { name: "Iniciar sesión" });

		await submit.click();
		await expect(
			page.getByRole("button", { name: "Iniciando sesión…" }),
		).toBeDisabled();
		await page.getByLabel("Contraseña").focus();
		await page.keyboard.press("Enter");

		await expect(
			page.getByRole("button", { name: "Iniciando sesión…" }),
		).toBeDisabled();
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						(
							window as typeof window & {
								__KAITO_TEST_AUTH_CALL_COUNT__?: number;
							}
						).__KAITO_TEST_AUTH_CALL_COUNT__ ?? 0,
				),
			)
			.toBe(1);
	});

	test("shows generic invalid-credentials feedback", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel("Correo electrónico").fill("invalid@example.com");
		await page.getByLabel("Contraseña").fill("trail-password");
		await page.getByRole("button", { name: "Iniciar sesión" }).click();

		const feedback = page.getByRole("alert").filter({
			hasText:
				"No hemos podido iniciar sesión con ese correo electrónico y contraseña.",
		});
		await expect(feedback).toBeVisible();
		await expect(feedback).not.toContainText("provider");
		await expect(
			page.getByRole("button", { name: "Iniciar sesión" }),
		).toBeEnabled();

		await page.getByLabel("Correo electrónico").fill("runner@example.com");
		await page.getByRole("button", { name: "Iniciar sesión" }).click();
		await expect(page).toHaveURL("/");
	});

	test("shows separate technical/system error feedback", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel("Correo electrónico").fill("system@example.com");
		await page.getByLabel("Contraseña").fill("trail-password");
		await page.getByRole("button", { name: "Iniciar sesión" }).click();

		const feedback = page.getByRole("alert").filter({
			hasText:
				"Kaito no puede conectar con el servicio de inicio de sesión ahora mismo.",
		});
		await expect(feedback).toBeVisible();
		await expect(feedback).not.toContainText(
			"No hemos podido iniciar sesión con ese correo electrónico y contraseña.",
		);
		await expect(
			page.getByRole("button", { name: "Iniciar sesión" }),
		).toBeEnabled();

		await page.getByLabel("Correo electrónico").fill("runner@example.com");
		await page.getByRole("button", { name: "Iniciar sesión" }).click();
		await expect(page).toHaveURL("/");
	});

	test("hands off successful authentication to the authenticated flow", async ({
		page,
	}) => {
		await page.goto("/login");

		await page.getByLabel("Correo electrónico").fill("runner@example.com");
		await page.getByLabel("Contraseña").fill("trail-password");
		await page.getByRole("button", { name: "Iniciar sesión" }).click();

		await expect(page).toHaveURL("/");
		await expect(
			page.getByRole("heading", { name: "Project scaffold is running." }),
		).toBeVisible();
	});

	test("exposes field and form feedback to assistive technology", async ({
		page,
	}) => {
		await page.goto("/login");
		await expect(page.getByText("Kaito", { exact: true })).toBeVisible();

		await page.getByRole("button", { name: "Iniciar sesión" }).click();
		const email = page.getByLabel("Correo electrónico");
		const password = page.getByLabel("Contraseña");
		await expect(email).toHaveAttribute("aria-invalid", "true");
		await expect(email).toHaveAttribute(
			"aria-describedby",
			"login-email-error",
		);
		await expect(password).toHaveAttribute("aria-invalid", "true");
		await expect(password).toHaveAttribute(
			"aria-describedby",
			"login-password-error",
		);
		await expect(
			page
				.getByRole("alert")
				.filter({ hasText: "El correo electrónico es obligatorio." }),
		).toBeVisible();
		await expect(
			page
				.getByRole("alert")
				.filter({ hasText: "La contraseña es obligatoria." }),
		).toBeVisible();
	});

	test("keeps the form usable without decorative motion at narrow and wide viewports", async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto("/login");
		await expect(page.locator(".login-card")).toHaveCSS(
			"animation-name",
			"login-card-enter",
		);

		for (const viewport of [
			{ width: 375, height: 812 },
			{ width: 1440, height: 900 },
		]) {
			await page.setViewportSize(viewport);
			await page.emulateMedia({ reducedMotion: "reduce" });
			await page.goto("/login");
			await expect(page.locator(".login-card")).toHaveCSS(
				"animation-name",
				"none",
			);
			expect(
				await page
					.locator("html")
					.evaluate((element) => element.scrollWidth <= element.clientWidth),
			).toBe(true);
			await expect(
				page.getByRole("button", { name: "Iniciar sesión" }),
			).toBeVisible();
		}
	});
});
