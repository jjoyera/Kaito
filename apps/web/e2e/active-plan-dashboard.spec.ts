import { expect, test, type Page } from "@playwright/test";

const plan = {
	plan_approach: "mode_z",
	start_date: "2099-07-06",
	end_date: "2099-07-19",
	block_focus: "Durabilidad en montaña",
	weeks: [
		{
			week_number: 1,
			sessions: [
				{
					scheduled_date: "2099-07-06",
					session_type: "Rodaje suave",
					planned_duration_minutes: 30,
					planned_distance_kilometers: "5.00",
					planned_elevation_meters: 25,
					intensity_description: "Suave",
					target_rpe_min: 2,
					target_rpe_max: 3,
					instructions: "Mantén un ritmo cómodo.",
					purpose: "Construir constancia.",
				},
			],
		},
		{
			week_number: 2,
			sessions: [
				{
					scheduled_date: "2099-07-13",
					session_type: "Tirada larga",
					planned_duration_minutes: 75,
					planned_distance_kilometers: "12.50",
					planned_elevation_meters: 650,
					intensity_description: "Moderada",
					target_rpe_min: 4,
					target_rpe_max: 6,
					instructions: "Camina en las subidas más exigentes.",
					purpose: "Sumar tiempo en montaña.",
				},
			],
		},
	],
};

async function setSession(page: Page, value = "authenticated") {
	await page.context().addCookies([
		{
			name: "kaito-e2e-session",
			value,
			url: "http://127.0.0.1:3000",
		},
		...(value === "authenticated"
			? [
					{
						name: "kaito-e2e-product-state",
						value: "completed",
						url: "http://127.0.0.1:3000",
					},
				]
			: []),
	]);
}

async function interceptActivePlan(
	page: Page,
	status: number,
	body?: unknown,
	delay = 0,
) {
	await page.route(
		"http://127.0.0.1:9999/planning/active",
		async (route) => {
			if (delay) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
			await route.fulfill({
				status,
				contentType: "application/json",
				body: body === undefined ? "" : JSON.stringify(body),
			});
		},
	);
}

test.describe("active plan dashboard", () => {
	for (const [value, suffix] of [
		["anonymous", ""],
		["invalid", "&context=session_expired"],
		["unavailable", "&context=auth_unavailable"],
	] as const) {
		test(`protects /plan for ${value} sessions`, async ({ page }) => {
			await setSession(page, value);
			await page.goto("/plan");

			await expect(page).toHaveURL(
				new RegExp(`/login\\?returnTo=%2Fplan${suffix}$`),
			);
		});
	}

	test("shows only derived plan metrics, next session, and weekly details", async ({
		page,
	}) => {
		await setSession(page);
		await interceptActivePlan(page, 200, plan, 250);
		await page.goto("/plan");

		await expect(
			page.getByRole("heading", { name: "Cargando tu bloque activo" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Durabilidad en montaña" }),
		).toBeVisible();

		const summary = page.getByRole("region", { name: "Resumen del bloque" });
		await expect(summary).toContainText("2");
		await expect(summary).toContainText("17,5 km");
		await expect(summary).toContainText("675 m");

		const nextSession = page.getByRole("region", { name: "Rodaje suave" });
		await expect(
			nextSession.getByRole("heading", { name: "Rodaje suave" }),
		).toBeVisible();
		await expect(
			nextSession.getByText("Mantén un ritmo cómodo."),
		).toBeVisible();

		const secondWeek = page
			.getByRole("article")
			.filter({ hasText: "Semana 2" });
		await expect(secondWeek).toContainText("12,5 km · 650 m de desnivel");
		await expect(secondWeek.getByRole("listitem")).toContainText("Moderada");
		await expect(
			page.getByText(/completad|cumplimiento|carga real|coach dice/i),
		).toHaveCount(0);
	});

	test("renders empty and safe malformed/service errors", async ({ page }) => {
		await setSession(page);
		await interceptActivePlan(page, 404);
		await page.goto("/plan");

		const emptyStatus = page.getByRole("status");
		await expect(
			emptyStatus.getByRole("heading", {
				name: "Todavía no tienes un plan activo",
			}),
		).toBeVisible();
		await expect(emptyStatus).not.toHaveAttribute("aria-live");

		await interceptActivePlan(page, 200, { ...plan, plan_id: "private" });
		await page.reload();
		const errorAlert = page.locator(".plan-state-card[role='alert']");
		await expect(
			errorAlert.getByRole("heading", {
				name: "No hemos podido cargar tu plan",
			}),
		).toBeVisible();
		await expect(errorAlert).not.toHaveAttribute("aria-live");

		await interceptActivePlan(page, 500, {
			detail: "private provider detail",
		});
		await page.getByRole("button", { name: "Reintentar" }).click();
		await expect(page.getByText("private provider detail")).toHaveCount(0);
	});

	test("recovers an API-rejected session", async ({ page }) => {
		await setSession(page);
		await interceptActivePlan(page, 401);
		await page.goto("/plan");

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fplan$/);
	});

	test("is responsive and exposes keyboard-operable navigation and details", async ({
		page,
	}) => {
		await setSession(page);
		await interceptActivePlan(page, 200, plan);
		await page.goto("/plan");

		await expect
			.poll(() =>
				page.evaluate(
					() =>
						document.documentElement.scrollWidth <=
						document.documentElement.clientWidth,
				),
			)
			.toBe(true);

		await page.setViewportSize({ width: 375, height: 667 });
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						document.documentElement.scrollWidth <=
						document.documentElement.clientWidth,
				),
			)
			.toBe(true);

		const calendarLink = page.getByRole("link", { name: "Calendario" });
		await calendarLink.focus();
		await expect(calendarLink).toBeFocused();

		const details = page.getByRole("group").first();
		await details.getByText("Ver indicaciones").focus();
		await page.keyboard.press("Enter");
		await expect(
			details.getByText("Mantén un ritmo cómodo."),
		).toBeVisible();
	});
});
