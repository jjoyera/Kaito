import { expect, test } from "@playwright/test";

const PASSWORD = "Trail#42";
const POST_SIGNUP_CONFIRMATION_COPY =
	"Si los datos son correctos, recibirás un correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión.";

async function fillRegistration(page: import("@playwright/test").Page, email: string) {
	await page.getByLabel("Correo electrónico").fill(email);
	await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
	await page.getByLabel("Repite la contraseña").fill(PASSWORD);
}

async function registrationCalls(page: import("@playwright/test").Page) {
	return page.evaluate(() => Number(sessionStorage.getItem("kaito:e2e:signup-calls") ?? "0"));
}

test.describe("/register", () => {
	test("renders accessible fields and rejects invalid input without a call or overlay", async ({ page }) => {
		await page.goto("/register");
		await page.getByRole("button", { name: "Crear cuenta" }).click();
		await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
		await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
		await expect(page.getByText("El correo electrónico es obligatorio.")).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		expect(await registrationCalls(page)).toBe(0);
	});

	test("uses a non-native, request-bound modal and blocks every duplicate path", async ({ page }) => {
		await page.goto("/register");
		await fillRegistration(page, "pending@example.com");
		await page.getByRole("button", { name: "Crear cuenta" }).click();

		const dialog = page.getByRole("dialog", { name: "Creando tu cuenta" });
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveAttribute("aria-modal", "true");
		await expect(dialog).toContainText("Espera mientras procesamos tu registro.");
		await expect(page.locator("dialog")).toHaveCount(0);
		await expect(dialog).toBeFocused();
		await expect(page.locator("main.login-page")).toHaveAttribute("inert", "");
		await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
		await expect(page.locator('button[type="submit"]')).toBeDisabled();

		await page.keyboard.press("Escape");
		await page.keyboard.press("Tab");
		await expect(dialog).toBeFocused();
		await page.keyboard.press("Shift+Tab");
		await expect(dialog).toBeFocused();
		await page.evaluate(() => (document.querySelector('input[type="email"]') as HTMLElement).focus());
		await expect(dialog).toBeFocused();
		await page.locator(".auth-processing-overlay-backdrop").dispatchEvent("pointerdown");
		await page.locator("form").dispatchEvent("submit");
		expect(await registrationCalls(page)).toBe(1);
		await expect(dialog).toBeVisible();

		await expect(page).toHaveURL("/login", { timeout: 4_000 });
		await expect(page.getByRole("status")).toHaveText(POST_SIGNUP_CONFIRMATION_COPY);
	});

	test("restores prior inert and overflow ownership after an inline settlement", async ({ page }) => {
		await page.goto("/register");
		await page.evaluate(() => {
			const priorOwner = document.createElement("div");
			priorOwner.dataset.priorInert = "";
			priorOwner.inert = true;
			document.body.append(priorOwner);
			document.body.style.overflow = "clip";
		});
		await fillRegistration(page, "pending-system@example.com");
		await page.getByRole("button", { name: "Crear cuenta" }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 4_000 });
		await expect(page.locator("[data-prior-inert]")).toHaveAttribute("inert", "");
		await expect(page.locator("main")).not.toHaveAttribute("inert", "");
		await expect(page.locator("body")).toHaveCSS("overflow", "clip");
		await expect(page.locator(".register-feedback")).toBeFocused();
	});

	test("redirects no-session signup through a private one-time confirmation bridge", async ({ page }) => {
		await page.goto("/register");
		await fillRegistration(page, "confirmation@example.com");
		await page.getByRole("button", { name: "Crear cuenta" }).click();

		await expect(page).toHaveURL("/login");
		await expect(page.getByRole("status")).toHaveText(POST_SIGNUP_CONFIRMATION_COPY);
		expect(page.url()).not.toContain("confirmation@example.com");
		expect(page.url()).not.toContain(PASSWORD);
		const storage = await page.evaluate(() => JSON.stringify(sessionStorage));
		expect(storage).not.toContain("confirmation@example.com");
		expect(storage).not.toContain(PASSWORD);
		await page.reload();
		await expect(page.getByText(POST_SIGNUP_CONFIRMATION_COPY)).toHaveCount(0);
	});

	test("keeps duplicate feedback inline, focused, editable, and free of recovery UI", async ({ page }) => {
		await page.goto("/register");
		await fillRegistration(page, "duplicate@example.com");
		await page.getByRole("button", { name: "Crear cuenta" }).click();

		const feedback = page.getByRole("alert").filter({ hasText: "Ya existe una cuenta" });
		await expect(feedback).toBeVisible();
		await expect(page.locator(".register-feedback")).toBeFocused();
		await expect(page.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
		await expect(page.getByText(/recuperar|olvidaste/i)).toHaveCount(0);
		await page.getByLabel("Correo electrónico").fill("new@example.com");
		await expect(feedback).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
	});

	test("distinguishes a system failure and permits a successful retry", async ({ page }) => {
		await page.goto("/register");
		await fillRegistration(page, "system-once@example.com");
		await page.getByRole("button", { name: "Crear cuenta" }).click();
		const feedback = page.getByRole("alert").filter({ hasText: "Kaito no puede crear tu cuenta" });
		await expect(feedback).toBeVisible();
		await expect(page.locator(".register-feedback")).toBeFocused();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await page.getByRole("button", { name: "Crear cuenta" }).click();
		await expect(page).toHaveURL("/onboarding");
	});

	test("persists the 60-second fallback cooldown and blocks refresh bypass", async ({ page }) => {
		await page.goto("/register");
		await fillRegistration(page, "rate-limit@example.com");
		await page.getByRole("button", { name: "Crear cuenta" }).click();
		await expect(page.getByText(/60 segundos/)).toBeVisible();
		await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeDisabled();
		await page.locator("form").dispatchEvent("submit");
		expect(await registrationCalls(page)).toBe(1);

		await page.reload();
		await fillRegistration(page, "rate-limit@example.com");
		await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeDisabled();
		await page.locator("form").dispatchEvent("submit");
		expect(await registrationCalls(page)).toBe(1);
	});

	test("uses structured cooldown metadata, announces expiry once, and allows one new call", async ({ page }) => {
		await page.goto("/register");
		await fillRegistration(page, "short-rate-limit@example.com");
		await page.getByRole("button", { name: "Crear cuenta" }).click();
		await expect(page.getByText(/2 segundos/)).toBeVisible();
		await page.getByLabel("Correo electrónico").fill("short-rate-limit@example.com");
		await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeDisabled();
		await expect(page.getByRole("status").filter({ hasText: "Ya puedes" })).toBeVisible({ timeout: 3_500 });
		await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
		await page.getByRole("button", { name: "Crear cuenta" }).click();
		await expect(page).toHaveURL("/onboarding");
		expect(await registrationCalls(page)).toBe(2);
	});

	test("hands an immediate authenticated session to onboarding", async ({ page }) => {
		await page.goto("/register");
		await fillRegistration(page, "runner@kaito.app");
		await page.getByRole("button", { name: "Crear cuenta" }).click();
		await expect(page).toHaveURL("/onboarding");
		await expect(page.getByText(POST_SIGNUP_CONFIRMATION_COPY)).toHaveCount(0);
	});

	test("keeps processing understandable with reduced motion", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/register");
		await fillRegistration(page, "pending@example.com");
		await page.getByRole("button", { name: "Crear cuenta" }).click();
		await expect(page.getByRole("dialog")).toContainText("procesamos tu registro");
		await expect(page.locator(".auth-processing-overlay-spinner")).toHaveCSS("animation-name", "none");
	});
});
