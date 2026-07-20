import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const API_ORIGIN = "http://127.0.0.1:9999";
const route = "/plan/generating?plan_id=9dd180d0-058d-4ee5-b8cf-3e93867a4041";

const plan = {
	plan_approach: "kaio_path",
	start_date: "2099-07-06",
	end_date: "2099-07-12",
	block_focus: "Construir constancia en montaña",
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
	],
};

async function setSession(page: Page, value: string) {
	await page.context().addCookies([
		{
			name: "kaito-e2e-session",
			value,
			url: "http://127.0.0.1:3000",
		},
	]);
}

async function fulfillJson(route: Route, status: number, body?: unknown) {
	await route.fulfill({
		status,
		contentType: "application/json",
		body: body === undefined ? "" : JSON.stringify(body),
	});
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

async function getVisibleBoundingBox(locator: Locator) {
	await expect(locator).toBeVisible();
	const box = await locator.boundingBox();
	expect(box).not.toBeNull();
	if (!box) throw new Error("Expected a visible element to have a bounding box");
	return box;
}

test.describe("plan generation flow", () => {
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

	test("starts exactly one automatic request and redirects to the active dashboard", async ({ page }) => {
		await setSession(page, "authenticated");
		let generationCalls = 0;
		await page.route(`${API_ORIGIN}/planning/generate`, async (apiRoute) => {
			generationCalls += 1;
			expect(apiRoute.request().method()).toBe("POST");
			expect(apiRoute.request().headers().authorization).toBe("Bearer test-access-token");
			await new Promise((resolve) => setTimeout(resolve, 250));
			await fulfillJson(apiRoute, 200, plan);
		});
		await page.route(`${API_ORIGIN}/planning/active`, (apiRoute) =>
			fulfillJson(apiRoute, 200, plan),
		);

		await page.goto(route);
		await expect(
			page.getByRole("heading", { name: "Kaito está trazando tu ruta" }),
		).toBeVisible();
		await expect(page).toHaveURL(/\/plan$/);
		await expect(
			page.getByRole("heading", { name: "Construir constancia en montaña" }),
		).toBeVisible();
		expect(generationCalls).toBe(1);
	});

	for (const [name, status, body, heading] of [
		["provider", 503, { detail: "private provider detail" }, "El servicio de generación no está disponible"],
		["validation", 422, { detail: "private validation detail" }, "No hemos podido validar tu plan"],
		["malformed success", 200, { ...plan, internal_id: "private" }, "No hemos podido validar tu plan"],
	] as const) {
		test(`shows a safe ${name} error`, async ({ page }) => {
			await setSession(page, "authenticated");
			await page.route(`${API_ORIGIN}/planning/generate`, (apiRoute) =>
				fulfillJson(apiRoute, status, body),
			);
			await page.goto(route);

			const alert = page.getByRole("alert");
			await expect(alert.getByRole("heading", { name: heading })).toBeVisible();
			await expect(page.getByText(/private provider detail|private validation detail/)).toHaveCount(0);
			await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
		});
	}

	test("retries only after a manual action and ignores a retry double click", async ({ page }) => {
		await setSession(page, "authenticated");
		let generationCalls = 0;
		await page.route(`${API_ORIGIN}/planning/generate`, async (apiRoute) => {
			generationCalls += 1;
			if (generationCalls === 1) {
				await fulfillJson(apiRoute, 503, { detail: "private" });
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 200));
			await fulfillJson(apiRoute, 200, plan);
		});
		await page.route(`${API_ORIGIN}/planning/active`, (apiRoute) =>
			fulfillJson(apiRoute, 200, plan),
		);
		await page.goto(route);

		const retry = page.getByRole("button", { name: "Reintentar" });
		await expect(retry).toBeVisible();
		await page.waitForTimeout(100);
		expect(generationCalls).toBe(1);
		await retry.dblclick();
		await expect(page).toHaveURL(/\/plan$/);
		expect(generationCalls).toBe(2);
	});

	test("recovers an API-rejected session through the existing login flow", async ({ page }) => {
		await setSession(page, "authenticated");
		await page.route(`${API_ORIGIN}/planning/generate`, (apiRoute) =>
			fulfillJson(apiRoute, 401, { detail: "Not authenticated" }),
		);
		await page.goto(route);

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fplan%2Fgenerating$/);
	});

	test("keeps honest progress accessible and responsive while the request is pending", async ({ page }) => {
		await setSession(page, "authenticated");
		await page.route(`${API_ORIGIN}/planning/generate`, async (apiRoute) => {
			await new Promise((resolve) => setTimeout(resolve, 2_000));
			await fulfillJson(apiRoute, 200, plan);
		});
		await page.route(`${API_ORIGIN}/planning/active`, (apiRoute) =>
			fulfillJson(apiRoute, 200, plan),
		);
		await page.goto(route);

		const status = page.getByRole("status");
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
		await expect(page.locator(".plan-generating-landscape")).toHaveAttribute("aria-hidden", "true");
		await expect(page.locator(".plan-generating-loader")).toHaveAttribute("aria-hidden", "true");
		await expect(page.locator(".plan-generating-loader-ring")).not.toHaveCSS("animation-name", "none");

		await page.setViewportSize({ width: 1440, height: 900 });
		await expectNoHorizontalOverflow(page);
		await page.setViewportSize({ width: 375, height: 667 });
		await expectNoHorizontalOverflow(page);

		const loadingScreen = page.locator('[data-loading-screen="plan-generation"]');
		const loader = page.locator('[data-animation="continuous"]');
		const progress = page.getByRole("list", { name: "Preparación del plan" });
		const [screenBox, loaderBox, statusBox, progressBox] = await Promise.all([
			getVisibleBoundingBox(loadingScreen),
			getVisibleBoundingBox(loader),
			getVisibleBoundingBox(status),
			getVisibleBoundingBox(progress),
		]);
		expect(statusBox.y).toBeGreaterThanOrEqual(loaderBox.y + loaderBox.height - 2);
		expect(progressBox.y).toBeGreaterThanOrEqual(statusBox.y + statusBox.height - 2);
		expect(progressBox.y + progressBox.height).toBeLessThanOrEqual(screenBox.y + screenBox.height + 2);

		await page.emulateMedia({ reducedMotion: "reduce" });
		await expect(page.locator(".plan-generating-loader-ring")).toHaveCSS("animation-name", "none");
		await expect(page.locator(".plan-generating-progress li").first()).toHaveCSS("opacity", "1");
	});

	test("continues deterministically from completed onboarding to the active dashboard", async ({ page }) => {
		await setSession(page, "authenticated");
		const requests: string[] = [];
		await page.route(`${API_ORIGIN}/**`, async (apiRoute) => {
			const request = apiRoute.request();
			const pathname = new URL(request.url()).pathname;
			requests.push(`${request.method()} ${pathname}`);
			if (pathname === "/runner-profile/onboarding") {
				await fulfillJson(apiRoute, 200, {
					snapshot: { contract_version: "1", state: "completed", profile: {}, goal: {} },
					diagnostics: [],
				});
				return;
			}
			if (pathname === "/planning/training-approach-eligibility") {
				await fulfillJson(apiRoute, 200, {
					recommended_approach: "kaio_path",
					approaches: [
						{ approach: "kaio_path", available: true, blocking_reason_codes: [] },
						{ approach: "mode_z", available: true, blocking_reason_codes: [] },
						{ approach: "kaioken", available: false, blocking_reason_codes: ["insufficient_volume_ratio"] },
					],
					safety_restriction_codes: [],
				});
				return;
			}
			if (pathname === "/planning/training-plan-draft") {
				await fulfillJson(apiRoute, 200, {
					plan_id: "9dd180d0-058d-4ee5-b8cf-3e93867a4041",
					status: "draft",
					plan_approach: "kaio_path",
				});
				return;
			}
			await fulfillJson(apiRoute, 200, plan);
		});

		await page.goto("/onboarding");
		await page.getByRole("button", { name: "Crear mi plan" }).click();
		await page.getByRole("radio", { name: /Camino Kaio/ }).check();
		await page.getByRole("button", { name: /Generar mi plan/ }).click();

		await expect(page).toHaveURL(/\/plan$/);
		await expect(
			page.getByRole("heading", { name: "Construir constancia en montaña" }),
		).toBeVisible();
		expect(requests.filter((request) => request === "PUT /planning/training-plan-draft")).toHaveLength(1);
		expect(requests.filter((request) => request === "POST /planning/generate")).toHaveLength(1);
		expect(requests.filter((request) => request === "GET /planning/active")).toHaveLength(1);
	});
});
