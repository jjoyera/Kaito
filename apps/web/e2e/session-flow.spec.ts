import { expect, test } from "@playwright/test";

test.describe("session route flow", () => {
	test("redirects anonymous onboarding requests without rendering private content", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "kaito-e2e-session",
				value: "anonymous",
				url: "http://127.0.0.1:3000",
			},
		]);
		await page.goto("/onboarding?source=invite");

		await expect(page).toHaveURL(
			/\/login\?returnTo=%2Fonboarding%3Fsource%3Dinvite$/,
		);
		await expect(
			page.getByRole("heading", { name: /cuéntanos tu punto de partida/i }),
		).toHaveCount(0);
		await expect(page.getByText(/sesión caducó/i)).toHaveCount(0);
	});

	test("fails closed when Supabase configuration is unavailable", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "kaito-e2e-session",
				value: "unavailable",
				url: "http://127.0.0.1:3000",
			},
		]);
		await page.goto("/onboarding");

		await expect(page).toHaveURL(
			/\/login\?returnTo=%2Fonboarding&context=auth_unavailable$/,
		);
		await expect(
			page.getByText(/no está disponible temporalmente/i),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /cuéntanos tu punto de partida/i }),
		).toHaveCount(0);
	});

	test("shows an accessible loading boundary before delayed session resolution without private content", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "kaito-e2e-session",
				value: "authenticated",
				url: "http://127.0.0.1:3000",
			},
			{
				name: "kaito-e2e-delay-session",
				value: "1",
				url: "http://127.0.0.1:3000",
			},
		]);
		await page.goto("/");
		const navigation = page.goto("/onboarding");

		await expect(page.getByRole("status")).toHaveText(/Preparando tu plan/i);
		await expect(
			page.getByRole("heading", { name: /cuéntanos tu punto de partida/i }),
		).toHaveCount(0);
		await navigation;
		await expect(
			page.getByRole("heading", {
				name: "Tu plan de entrenamiento, hecho a tu medida",
			}),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Crear mi plan" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /cuéntanos tu punto de partida/i }),
		).toHaveCount(0);
	});

	test("uses onboarding as the safe post-login handoff", async ({ page }) => {
		await page.goto("/login?returnTo=https://attacker.example");
		await page.getByLabel("Correo electrónico").fill("runner@example.com");
		await page.getByLabel("Contraseña").fill("trail-password");
		await page.getByRole("button", { name: "Iniciar sesión" }).click();

		await expect(page).toHaveURL("/onboarding");
		await expect(
			page.getByRole("heading", {
				name: "Tu plan de entrenamiento, hecho a tu medida",
			}),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Crear mi plan" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /cuéntanos tu punto de partida/i }),
		).toHaveCount(0);
	});

	test("renders bounded expiry context but not private content for an invalid session", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "kaito-e2e-session",
				value: "invalid",
				url: "http://127.0.0.1:3000",
			},
		]);
		await page.goto("/onboarding");

		await expect(page).toHaveURL(
			/\/login\?returnTo=%2Fonboarding&context=session_expired$/,
		);
		await expect(page.getByText(/sesión.*caduc/i)).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /cuéntanos tu punto de partida/i }),
		).toHaveCount(0);
	});

	test("hands an authenticated login visit to its safe return destination", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "kaito-e2e-session",
				value: "authenticated",
				url: "http://127.0.0.1:3000",
			},
		]);
		await page.goto("/login?returnTo=/onboarding?step=1");

		await expect(page).toHaveURL("/onboarding?step=1");
	});
});
