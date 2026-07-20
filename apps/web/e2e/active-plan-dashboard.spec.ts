import { expect, test, type Page } from "@playwright/test";

const plan = {
	plan_approach: "mode_z",
	start_date: "2026-07-06",
	end_date: "2026-07-19",
	block_focus: "Durabilidad en montaña",
	weeks: [
		{
			week_number: 1,
			sessions: [
				{
					scheduled_date: "2026-07-06",
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
				{
					scheduled_date: "2026-07-06",
					session_type: "Técnica de carrera",
					planned_duration_minutes: 20,
					planned_distance_kilometers: "2.50",
					planned_elevation_meters: 0,
					intensity_description: "Suave",
					target_rpe_min: 2,
					target_rpe_max: 3,
					instructions: "Prioriza una pisada estable.",
					purpose: "Mejorar la técnica.",
				},
				{
					scheduled_date: "2026-07-08",
					session_type: "Recuperación activa",
					planned_duration_minutes: 30,
					planned_distance_kilometers: "0.00",
					planned_elevation_meters: 0,
					intensity_description: "Muy suave",
					target_rpe_min: 1,
					target_rpe_max: 2,
					instructions: "Muévete sin buscar carga.",
					purpose: "Facilitar la recuperación.",
				},
				{
					scheduled_date: "2026-07-12",
					session_type: "Tirada larga",
					planned_duration_minutes: 70,
					planned_distance_kilometers: "10.00",
					planned_elevation_meters: 500,
					intensity_description: "Moderada",
					target_rpe_min: 4,
					target_rpe_max: 5,
					instructions: "Mantén esfuerzo sostenible.",
					purpose: "Sumar tiempo en montaña.",
				},
			],
		},
		{
			week_number: 2,
			sessions: [
				{
					scheduled_date: "2026-07-13",
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

	test("shows the dashboard and chronological workout-only calendar tabs", async ({ page }) => {
		await page.clock.setFixedTime(new Date("2026-07-08T10:00:00Z"));
		await setSession(page);
		const outOfOrderPlan = {
			...plan,
			weeks: [
				{ ...plan.weeks[0], sessions: [plan.weeks[0].sessions[3], ...plan.weeks[0].sessions.slice(0, 3)] },
				plan.weeks[1],
			],
		};
		await interceptActivePlan(page, 200, outOfOrderPlan, 250);
		await page.goto("/plan");

		await expect(page.getByRole("heading", { name: "Cargando tu bloque activo" })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Tu plan de entrenamiento personalizado" }),
		).toBeVisible();

		const dashboardTab = page.getByRole("tab", { name: "Dashboard" });
		const calendarTab = page.getByRole("tab", { name: "Calendario" });
		await expect(dashboardTab).toHaveAttribute("aria-selected", "true");
		await expect(calendarTab).toHaveAttribute("aria-selected", "false");
		await expect(dashboardTab.locator("svg")).toHaveCount(1);

		const summary = page.getByRole("region", { name: "Resumen del bloque" });
		await expect(summary).toContainText("Kilómetros planificados esta semana17,5 km");
		await expect(summary).toContainText("Sesiones planificadas esta semana4");
		await expect(summary).toContainText("Días restantes del bloque activo12");
		await expect(summary).toContainText("Progreso temporal del bloque21 %");

		const nextSession = page.getByRole("region", { name: "Recuperación activa" });
		await expect(nextSession.getByText("Muévete sin buscar carga.")).toBeVisible();

		const calendar = page.getByRole("region", { name: "Esta semana" });
		const dayCards = calendar.locator(".plan-day-card");
		await expect(dayCards).toHaveCount(7);
		await expect(calendar.locator('.plan-day-card[data-today="true"]')).toHaveCount(1);
		await expect(calendar.getByRole("article", { name: /miércoles.*hoy/i })).toContainText("Recuperación activa30 min · 0 km");
		await expect(calendar.getByRole("article", { name: /lunes/i }).getByRole("listitem")).toHaveText([
			"Rodaje suave30 min · 5 km",
			"Técnica de carrera20 min · 2,5 km",
		]);
		await expect(calendar.getByRole("article", { name: /martes/i })).toContainText("Sin sesión planificada");
		await expect(page.getByText(/completad|pendiente|descanso|cumplimiento|carga real/i)).toHaveCount(0);

		await calendarTab.click();
		await expect(calendarTab).toHaveAttribute("aria-selected", "true");
		await expect(dashboardTab).toHaveAttribute("aria-selected", "false");
		await expect(summary).toBeHidden();

		const fullCalendar = page.getByRole("tabpanel", { name: "Calendario" });
		await expect(fullCalendar).toContainText("6 jul 2026 – 13 jul 2026");
		const workouts = fullCalendar.locator(".plan-workout-card");
		await expect(workouts).toHaveCount(5);
		await expect(workouts.locator("h2")).toHaveText([
			"Rodaje suave",
			"Técnica de carrera",
			"Recuperación activa",
			"Tirada larga",
			"Tirada larga",
		]);
		await expect(workouts.nth(0)).toContainText("lunes, 6 jul 2026");
		await expect(workouts.nth(0)).toContainText("Duración30 min");
		await expect(workouts.nth(0)).toContainText("Distancia5 km");
		await expect(fullCalendar.getByText("Sin sesión planificada")).toHaveCount(0);
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

	test("preserves the finished-block state when no future session remains", async ({ page }) => {
		await page.clock.setFixedTime(new Date("2026-07-20T10:00:00Z"));
		await setSession(page);
		await interceptActivePlan(page, 200, plan);
		await page.goto("/plan");

		await expect(page.getByRole("heading", { name: "No quedan sesiones programadas" })).toBeVisible();
		await expect(page.getByText("BLOQUE FINALIZADO")).toBeVisible();
	});

	test("recovers an API-rejected session", async ({ page }) => {
		await setSession(page);
		await interceptActivePlan(page, 401);
		await page.goto("/plan");

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fplan$/);
	});

	test("is responsive and exposes keyboard-operable navigation", async ({
		page,
	}) => {
		await page.clock.setFixedTime(new Date("2026-07-08T10:00:00Z"));
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

		const dashboardTab = page.getByRole("tab", { name: "Dashboard" });
		await dashboardTab.focus();
		await expect(dashboardTab).toBeFocused();
		await dashboardTab.press("ArrowRight");

		const calendarTab = page.getByRole("tab", { name: "Calendario" });
		await expect(calendarTab).toBeFocused();
		await expect(calendarTab).toHaveAttribute("aria-selected", "true");
		await expect(
			page.getByRole("heading", { name: "Calendario de entrenamientos" }),
		).toBeVisible();
	});
});
