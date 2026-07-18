import { expect, test, type Page } from "@playwright/test";

const route = "/plan/generating?plan_id=9dd180d0-058d-4ee5-b8cf-3e93867a4041";

async function setSession(page: Page, value: string) {
	await page.context().addCookies([
		{
			name: "kaito-e2e-session",
			value,
			url: "http://127.0.0.1:3000",
		},
	]);
}

async function expectNoHorizontalOverflow(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(
				() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
			),
		)
		.toBe(true);
}

test.describe("plan generation loading screen", () => {
	for (const [session, context] of [
		["anonymous", ""],
		["invalid", "&context=session_expired"],
		["unavailable", "&context=auth_unavailable"],
	] as const) {
		test(`preserves the private route guard for a ${session} session`, async ({ page }) => {
			await setSession(page, session);
			await page.goto(route);

			await expect(page).toHaveURL(
				new RegExp(`/login\\?returnTo=%2Fplan%2Fgenerating${context}$`),
			);
			await expect(
				page.getByRole("heading", { name: "Kaito está trazando tu ruta" }),
			).toHaveCount(0);
		});
	}

	test("renders accessible static status and CSS-driven simulated progress", async ({ page }) => {
		const apiRequests: string[] = [];
		page.on("request", (request) => {
			if (request.url().startsWith("http://127.0.0.1:9999")) apiRequests.push(request.url());
		});
		await setSession(page, "authenticated");
		await page.goto(route);

		const status = page.getByRole("status");
		await expect(status).toHaveCount(1);
		await expect(
			status.getByRole("heading", { name: "Kaito está trazando tu ruta" }),
		).toBeVisible();
		await expect(status).toContainText(
			"Combinando tu objetivo, tu disponibilidad, tu entrenamiento actual y tu experiencia",
		);
		await expect(
			page.getByRole("list", { name: "Preparación del plan" }).getByRole("listitem"),
		).toHaveText([
			"Analizando tu objetivo de carrera",
			"Revisando tu disponibilidad semanal",
			"Ajustando cargas y progresión",
			"Construyendo tu plan personalizado",
		]);
		await expect(page.locator('[data-progress-animation="sequential"] li')).toHaveCount(4);
		await expect(page.locator('[data-animation="continuous"]')).toHaveCount(1);
		await expect(page.locator(".plan-generating-landscape")).toHaveAttribute("aria-hidden", "true");
		await expect(page.locator(".plan-generating-loader")).toHaveAttribute("aria-hidden", "true");
		await expect(page.locator(".plan-generating-loader-ring")).not.toHaveCSS("animation-name", "none");
		expect(apiRequests).toEqual([]);
	});

	test("stays within mobile and desktop viewports and disables motion when requested", async ({ page }) => {
		await setSession(page, "authenticated");
		await page.goto(route);

		await page.setViewportSize({ width: 1440, height: 900 });
		await expectNoHorizontalOverflow(page);
		await expect(page.locator(".plan-generating-page")).toHaveCSS("overflow", "hidden");

		await page.setViewportSize({ width: 375, height: 667 });
		await expectNoHorizontalOverflow(page);
		await expect(
			page.getByRole("heading", { name: "Kaito está trazando tu ruta" }),
		).toBeVisible();

		await page.emulateMedia({ reducedMotion: "reduce" });
		await expect(page.locator(".plan-generating-loader-ring")).toHaveCSS("animation-name", "none");
		await expect(page.locator(".plan-generating-progress li").first()).toHaveCSS("animation-name", "none");
		await expect(page.locator(".plan-generating-progress li").first()).toHaveCSS("opacity", "1");
	});
});
