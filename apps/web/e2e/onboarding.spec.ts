import { expect, test, type Page, type Route } from "@playwright/test";

const API_ORIGIN = "http://127.0.0.1:9999";

type Diagnostic = {
	code: string;
	field: string;
	message_key: string;
	severity: string;
	metadata: Record<string, unknown>;
};

type Snapshot = {
	contract_version: string;
	state: "incomplete" | "completed";
	profile: Record<string, unknown>;
	goal: Record<string, unknown>;
};

function apiBody(
	snapshot: Snapshot,
	diagnostics: Diagnostic[] = [],
): { snapshot: Snapshot; diagnostics: Diagnostic[] } {
	return { snapshot, diagnostics };
}

async function authenticate(page: Page) {
	await page.context().addCookies([
		{
			name: "kaito-e2e-session",
			value: "authenticated",
			url: "http://127.0.0.1:3000",
		},
	]);
}

const VALID_TRAIL_GOAL = {
	modality: "trail",
	target_date: "2026-12-01",
	target_distance_km: 42,
	positive_elevation_m: 1500,
	technicality: "medium",
};

const VALID_PRIOR_HISTORY = {
	training_years: 2,
	completed_race_count_range: "one_to_three",
	longest_completed_distance_km: 21,
	practiced_modalities: ["trail"],
	practiced_terrain: ["mountain"],
};

const VALID_BASELINE = {
	sessions: 4,
	training_hours: 5,
	distance_km: 40,
	positive_elevation_m: 800,
	longest_outing_km: 15,
};

const VALID_AVAILABILITY = {
	minutes_by_day: { monday: 60, wednesday: 60, friday: 60 },
};

const VALID_RESTRICTIONS = { has_restrictions: false };

test.describe("onboarding wizard", () => {
	test("resumes from a stored draft at the first incomplete step", async ({
		page,
	}) => {
		await authenticate(page);
		await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
			if (route.request().method() !== "GET") {
				await route.fulfill({ status: 404, body: "not found" });
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(
					apiBody({
						contract_version: "1",
						state: "incomplete",
						profile: { prior_history: VALID_PRIOR_HISTORY },
						goal: VALID_TRAIL_GOAL,
					}),
				),
			});
		});

		await page.goto("/onboarding");

		await expect(
			page.getByRole("group", { name: "¿Cómo han sido tus últimas 4 semanas?" }),
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Objetivo" })).toHaveAttribute(
			"data-status",
			"complete",
		);
		await expect(
			page.getByRole("button", { name: "Historial previo" }),
		).toHaveAttribute("data-status", "complete");

		await page.getByRole("button", { name: "Objetivo" }).click();
		await expect(page.locator("#goal-modality")).toHaveValue("trail");
		await expect(page.locator("#goal-target-date")).toHaveValue("2026-12-01");
	});

	test("saves the accumulated snapshot with state=incomplete on advance", async ({
		page,
	}) => {
		await authenticate(page);
		let capturedBody: { snapshot: Snapshot; validation_date: string } | undefined;
		await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
			const request = route.request();
			if (request.method() === "GET") {
				await route.fulfill({ status: 404, body: "not found" });
				return;
			}
			capturedBody = JSON.parse(request.postData() ?? "{}");
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(
					apiBody({
						contract_version: "1",
						state: "incomplete",
						profile: {},
						goal: capturedBody.snapshot.goal,
					}),
				),
			});
		});

		await page.goto("/onboarding");
		await page.selectOption("#goal-modality", "trail");
		await page.fill("#goal-target-date", "2026-12-01");
		await page.fill("#goal-target-distance-km", "42");
		await page.fill("#goal-positive-elevation-m", "1500");
		await page.selectOption("#goal-technicality", "medium");
		await page.getByRole("button", { name: "Siguiente" }).click();

		await expect(
			page.getByRole("group", { name: "Cuéntanos tu experiencia previa" }),
		).toBeVisible();
		expect(capturedBody?.snapshot.state).toBe("incomplete");
		expect(
			(capturedBody?.snapshot.goal as { modality: string }).modality,
		).toBe("trail");
	});

	test("blocks advancing past a step with an empty required field", async ({
		page,
	}) => {
		await authenticate(page);
		let putCount = 0;
		await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
			if (route.request().method() === "PUT") putCount += 1;
			await route.fulfill({ status: 404, body: "not found" });
		});

		await page.goto("/onboarding");
		await page.selectOption("#goal-modality", "trail");
		// target_date is left empty on purpose.
		await page.getByRole("button", { name: "Siguiente" }).click();

		await expect(
			page.getByRole("group", { name: "¿Cuál es tu objetivo?" }),
		).toBeVisible();
		await expect(page.locator("#goal-target-date-error")).toBeVisible();
		expect(putCount).toBe(0);
	});

	test("jumps directly between reached steps via the navigator without losing data", async ({
		page,
	}) => {
		await authenticate(page);
		await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
			const request = route.request();
			if (request.method() === "GET") {
				await route.fulfill({ status: 404, body: "not found" });
				return;
			}
			const body = JSON.parse(request.postData() ?? "{}");
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(
					apiBody({
						contract_version: "1",
						state: "incomplete",
						profile: body.snapshot.profile,
						goal: body.snapshot.goal,
					}),
				),
			});
		});

		await page.goto("/onboarding");
		await page.selectOption("#goal-modality", "trail");
		await page.fill("#goal-target-date", "2026-12-01");
		await page.fill("#goal-target-distance-km", "42");
		await page.fill("#goal-positive-elevation-m", "1500");
		await page.selectOption("#goal-technicality", "medium");
		await page.getByRole("button", { name: "Siguiente" }).click();
		await expect(
			page.getByRole("group", { name: "Cuéntanos tu experiencia previa" }),
		).toBeVisible();

		await page.fill("#prior-history-training-years", "2");

		// Jump back to step 1 without losing the in-progress answer on step 2.
		await page.getByRole("button", { name: "Objetivo" }).click();
		await expect(page.locator("#goal-modality")).toHaveValue("trail");

		// Jump forward again directly (not via "Siguiente") and confirm the
		// step-2 answer survived the round trip.
		await page.getByRole("button", { name: "Historial previo" }).click();
		await expect(page.locator("#prior-history-training-years")).toHaveValue(
			"2",
		);
	});

	test("clears hidden goal fields when the modality changes", async ({
		page,
	}) => {
		await authenticate(page);
		let capturedGoal: Record<string, unknown> | undefined;
		await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
			const request = route.request();
			if (request.method() === "GET") {
				await route.fulfill({ status: 404, body: "not found" });
				return;
			}
			const body = JSON.parse(request.postData() ?? "{}");
			capturedGoal = body.snapshot.goal;
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(
					apiBody({
						contract_version: "1",
						state: "incomplete",
						profile: {},
						goal: capturedGoal,
					}),
				),
			});
		});

		await page.goto("/onboarding");
		await page.selectOption("#goal-modality", "ocr");
		await page.fill("#goal-target-date", "2026-12-01");
		await page.fill("#goal-target-distance-km", "15");
		await page.fill("#goal-obstacle-count", "20");
		await expect(page.locator("#goal-obstacle-count")).toBeVisible();

		await page.selectOption("#goal-modality", "backyard");
		await expect(page.locator("#goal-obstacle-count")).toHaveCount(0);
		await page.fill("#goal-target-loops", "12");
		await page.getByRole("button", { name: "Siguiente" }).click();

		await expect(
			page.getByRole("group", { name: "Cuéntanos tu experiencia previa" }),
		).toBeVisible();
		expect(capturedGoal?.obstacle_count).toBeUndefined();
		expect(capturedGoal?.target_loops).toBe(12);
	});

	test("shows a completion confirmation when the backend accepts the final step", async ({
		page,
	}) => {
		await authenticate(page);
		await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
			const request = route.request();
			if (request.method() === "GET") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify(
						apiBody({
							contract_version: "1",
							state: "incomplete",
							profile: {
								prior_history: VALID_PRIOR_HISTORY,
								baseline_4_weeks: VALID_BASELINE,
								availability: VALID_AVAILABILITY,
								restrictions: VALID_RESTRICTIONS,
							},
							goal: VALID_TRAIL_GOAL,
						}),
					),
				});
				return;
			}
			const body = JSON.parse(request.postData() ?? "{}");
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(
					apiBody({
						contract_version: "1",
						state: body.snapshot.state,
						profile: body.snapshot.profile,
						goal: body.snapshot.goal,
					}),
				),
			});
		});

		await page.goto("/onboarding");
		await expect(
			page.getByRole("group", {
				name: "¿Tienes restricciones o molestias a tener en cuenta?",
			}),
		).toBeVisible();
		await page.getByRole("button", { name: "Completar" }).click();

		await expect(
			page.getByRole("heading", { name: "¡Onboarding completado!" }),
		).toBeVisible();
	});

	test("marks the affected step incomplete and stays put when the backend demotes completion", async ({
		page,
	}) => {
		await authenticate(page);
		await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
			const request = route.request();
			if (request.method() === "GET") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify(
						apiBody({
							contract_version: "1",
							state: "incomplete",
							profile: {
								prior_history: VALID_PRIOR_HISTORY,
								baseline_4_weeks: VALID_BASELINE,
								availability: VALID_AVAILABILITY,
								restrictions: VALID_RESTRICTIONS,
							},
							goal: VALID_TRAIL_GOAL,
						}),
					),
				});
				return;
			}
			const body = JSON.parse(request.postData() ?? "{}");
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(
					apiBody(
						{
							contract_version: "1",
							state: "incomplete",
							profile: body.snapshot.profile,
							goal: body.snapshot.goal,
						},
						[
							{
								code: "target_date_not_future",
								field: "goal.target_date",
								message_key: "target_date_not_future",
								severity: "error",
								metadata: {},
							},
						],
					),
				),
			});
		});

		await page.goto("/onboarding");
		await expect(
			page.getByRole("group", {
				name: "¿Tienes restricciones o molestias a tener en cuenta?",
			}),
		).toBeVisible();
		await page.getByRole("button", { name: "Completar" }).click();

		await expect(
			page.getByRole("heading", { name: "¡Onboarding completado!" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("group", {
				name: "¿Tienes restricciones o molestias a tener en cuenta?",
			}),
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Objetivo" })).toHaveAttribute(
			"data-status",
			"incomplete",
		);

		await page.getByRole("button", { name: "Objetivo" }).click();
		await expect(
			page.getByRole("group", { name: "¿Cuál es tu objetivo?" }),
		).toBeVisible();
	});
});
