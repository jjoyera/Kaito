import { expect, test, type Page, type Route } from "@playwright/test";

const API_ORIGIN = "http://127.0.0.1:9999";

type Snapshot = {
	contract_version: string;
	state: "incomplete" | "completed";
	profile: Record<string, unknown>;
	goal: Record<string, unknown>;
};

async function authenticate(page: Page) {
	await page.context().addCookies([
		{
			name: "kaito-e2e-session",
			value: "authenticated",
			url: "http://127.0.0.1:3000",
		},
	]);
}

async function startWithBlankDraft(page: Page) {
	await authenticate(page);
	await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
		await route.fulfill({ status: 404, body: "not found" });
	});
	await page.goto("/onboarding");
	await page.getByRole("button", { name: "Crear mi plan" }).click();
}

async function startAtStepTwo(
	page: Page,
	modality: "trail" | "ultra_trail",
) {
	await authenticate(page);
	const savedSnapshots: Snapshot[] = [];
	await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
		if (route.request().method() === "GET") {
			await route.fulfill({ status: 404, body: "not found" });
			return;
		}
		const body = JSON.parse(route.request().postData() ?? "{}");
		savedSnapshots.push(body.snapshot);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ snapshot: body.snapshot, diagnostics: [] }),
		});
	});
	await page.goto("/onboarding");
	await page.getByRole("button", { name: "Crear mi plan" }).click();
	await page
		.getByRole("button", { name: modality === "trail" ? "Trail" : "Ultra" })
		.click();
	await page.getByLabel("Distancia (km)").fill("45");
	await page.getByLabel("Desnivel + (m)").fill("1800");
	await page.getByLabel("Fecha objetivo").fill("2026-10-03");
	await page.getByRole("button", { name: "Continuar" }).click();
	return savedSnapshots;
}

test.describe("onboarding intro and step 1", () => {
	test("opens the race goal form with the requested progress and fields", async ({
		page,
	}) => {
		await startWithBlankDraft(page);

		await expect(page.getByText("Paso 1 de 7")).toBeVisible();
		await expect(page.getByText("14%", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Empecemos por tu objetivo" }),
		).toBeVisible();
		await expect(
			page.getByText(
				"Cuéntame qué carrera tienes en mente. Es la brújula de todo tu plan.",
			),
		).toBeVisible();

		const raceTypes = page.getByRole("group", { name: "Tipo de carrera" });
		await expect(raceTypes.getByRole("button")).toHaveCount(2);
		await expect(raceTypes.getByRole("button", { name: "Trail" })).toBeVisible();
		await expect(raceTypes.getByRole("button", { name: "Ultra" })).toBeVisible();
		await expect(page.getByLabel("Distancia (km)")).toBeVisible();
		await expect(page.getByLabel("Desnivel + (m)")).toBeVisible();
		await expect(page.getByLabel("Fecha objetivo")).toBeVisible();
		await expect(page.getByRole("button", { name: /Atrás/i })).toHaveCount(0);
		await expect(page.getByText("Tecnicidad del recorrido")).toHaveCount(0);
		await expect(page.getByText("Altitud máxima estimada")).toHaveCount(0);
	});

	test("shows step 2 for Trail and preserves both steps when going back", async ({
		page,
	}) => {
		const savedSnapshots = await startAtStepTwo(page, "trail");

		await expect(page.getByText("Paso 2 de 7")).toBeVisible();
		await expect(page.getByText("29%", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "¿Cuál es tu experiencia previa?" }),
		).toBeVisible();
		await expect(
			page.getByText(
				"Necesito saber de dónde partes para no pedirte ni de más ni de menos.",
			),
		).toBeVisible();
		const distance = page.getByLabel("Distancia más larga completada");
		await expect(distance).toHaveAttribute("type", "number");
		await distance.fill("45");
		await distance.pressSequentially("km");
		await expect(distance).toHaveValue("45");
		await expect(page.getByText("km", { exact: true })).toBeVisible();
		await page.getByLabel("Terreno habitual").selectOption("mountain");
		await expect(page.getByLabel("Terreno habitual").locator("option")).toHaveCount(5);
		await expect(page.getByRole("group", { name: "Experiencia en montaña" })).toBeVisible();
		await page.getByLabel("Media").check();
		await expect(
			page.getByRole("group", { name: "¿Has corrido un trail antes?" }),
		).toBeVisible();
		await page.getByLabel("Sí, una vez").check();

		const savesBeforeBack = savedSnapshots.length;
		await page.getByRole("button", { name: /Atrás/ }).click();
		expect(savedSnapshots).toHaveLength(savesBeforeBack);
		await expect(page.getByRole("button", { name: "Trail" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await page.getByRole("button", { name: "Continuar" }).click();
		await expect(distance).toHaveValue("45");
		await expect(page.getByLabel("Terreno habitual")).toHaveValue("mountain");
		await expect(page.getByLabel("Media")).toBeChecked();
		await expect(page.getByLabel("Sí, una vez")).toBeChecked();
		await page.getByRole("button", { name: "Continuar" }).click();
		expect(savedSnapshots.at(-1)?.profile).toMatchObject({
			prior_history: {
				longest_completed_distance_km: 45,
				habitual_terrain: "mountain",
				mountain_experience: "medium",
				prior_modality_race_frequency: "once",
			},
		});
		await expect(page.getByText("Paso 3 de 7")).toBeVisible();
		await expect(page.getByText("43%", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "¿Cómo entrenas ahora mismo?" }),
		).toBeVisible();
		await expect(
			page.getByText(/respuestas se refieren a las últimas cuatro semanas/),
		).toBeVisible();
		await page.getByLabel("Sesiones en las últimas 4 semanas").fill("8");
		await page
			.getByLabel("Distancia total en las últimas 4 semanas")
			.fill("50");
		await page
			.getByLabel("Desnivel positivo en las últimas 4 semanas")
			.fill("1200");
		await page
			.getByLabel("Salida más larga de las últimas 4 semanas")
			.fill("18");
		await page.getByLabel("Bastante constante").check();
		await expect(page.getByLabel(/Horas totales/)).toHaveCount(0);
		const savesBeforeBaseline = savedSnapshots.length;
		await page.getByRole("button", { name: "Continuar" }).click();
		await expect.poll(() => savedSnapshots.length).toBe(savesBeforeBaseline + 1);
		expect(savedSnapshots.at(-1)?.profile).toMatchObject({
			baseline_4_weeks: {
				sessions: 8,
				distance_km: 50,
				positive_elevation_m: 1200,
				longest_outing_km: 18,
				recent_consistency: "fairly_consistent",
			},
		});
	});

	test("uses Ultra wording and keeps step 2 visible on validation errors", async ({
		page,
	}) => {
		await startAtStepTwo(page, "ultra_trail");
		await expect(
			page.getByRole("group", { name: "¿Has corrido un ultra antes?" }),
		).toBeVisible();

		await page.getByRole("button", { name: "Continuar" }).click();
		await expect(
			page.getByRole("heading", { name: "¿Cuál es tu experiencia previa?" }),
		).toBeVisible();
		await expect(
			page.getByText("Este campo es obligatorio: Terreno habitual."),
		).toBeVisible();
	});

	test("keeps step 1 visible and shows errors when required values are empty", async ({
		page,
	}) => {
		await startWithBlankDraft(page);

		await page.getByRole("button", { name: "Continuar" }).click();

		await expect(
			page.getByRole("heading", { name: "Empecemos por tu objetivo" }),
		).toBeVisible();
		await expect(
			page.getByText("Este campo es obligatorio: Tipo de carrera."),
		).toBeVisible();
		await expect(page.locator("#goal-target-date-error")).toBeVisible();
	});
});

async function startWithHydratedAvailability(
	page: Page,
	minutesByDay: Record<string, number>,
) {
	await authenticate(page);
	const snapshot: Snapshot = {
		contract_version: "1",
		state: "incomplete",
		profile: {
			prior_history: {
				longest_completed_distance_km: 45,
				habitual_terrain: "mountain",
				mountain_experience: "medium",
				prior_modality_race_frequency: "once",
			},
			baseline_4_weeks: {
				sessions: 8,
				distance_km: 50,
				positive_elevation_m: 1200,
				longest_outing_km: 18,
				recent_consistency: "fairly_consistent",
			},
			availability: { minutes_by_day: minutesByDay },
		},
		goal: {
			modality: "trail",
			target_date: "2026-10-03",
			target_distance_km: 45,
			positive_elevation_m: 1800,
		},
	};
	await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
		if (route.request().method() === "GET") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					snapshot,
					diagnostics: [
						{
							code: "availability_insufficient_total",
							field: "profile.availability.minutes_by_day",
							message_key: "availability_insufficient_total",
							severity: "error",
							metadata: {},
						},
					],
				}),
			});
			return;
		}
		await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ snapshot, diagnostics: [] }) });
	});
	await page.goto("/onboarding");
	await page.getByRole("button", { name: "Crear mi plan" }).click();
	await expect(
		page.getByRole("heading", { name: "¿Cuándo puedes entrenar?" }),
	).toBeVisible();
}

async function startAtAvailabilityStep(page: Page) {
	const savedSnapshots = await startAtStepTwo(page, "trail");
	await page.getByLabel("Distancia más larga completada").fill("45");
	await page.getByLabel("Terreno habitual").selectOption("mountain");
	await page.getByLabel("Media").check();
	await page.getByLabel("Sí, una vez").check();
	await page.getByRole("button", { name: "Continuar" }).click();
	await page.getByLabel("Sesiones en las últimas 4 semanas").fill("8");
	await page
		.getByLabel("Distancia total en las últimas 4 semanas")
		.fill("50");
	await page
		.getByLabel("Desnivel positivo en las últimas 4 semanas")
		.fill("1200");
	await page
		.getByLabel("Salida más larga de las últimas 4 semanas")
		.fill("18");
	await page.getByLabel("Bastante constante").check();
	await page.getByRole("button", { name: "Continuar" }).click();
	await expect(
		page.getByRole("heading", { name: "¿Cuándo puedes entrenar?" }),
	).toBeVisible();
	return savedSnapshots;
}

test.describe("onboarding availability step", () => {
	test("presents the approved accessible controls and preserves exact overrides", async ({
		page,
	}) => {
		await startAtAvailabilityStep(page);

		await expect(page.getByText("Paso 4 de 7")).toBeVisible();
		await expect(page.getByText("57%", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Diseñaré el plan alrededor de tu vida, no al revés."),
		).toBeVisible();
		const weekdays = page.locator(
			".onboarding-availability-days .onboarding-choice-pill span",
		);
		await expect(weekdays).toHaveText(["L", "M", "X", "J", "V", "S", "D"]);
		await expect(page.getByRole("checkbox", { name: "Lunes" })).toBeVisible();
		await expect(page.getByRole("checkbox", { name: "Miércoles" })).toBeVisible();
		await expect(
			page.getByRole("radiogroup", { name: "Duración habitual" }),
		).toBeVisible();

		await page.getByRole("checkbox", { name: "Lunes" }).focus();
		await expect(page.getByRole("checkbox", { name: "Lunes" })).toBeFocused();
		await page.keyboard.press("Space");
		await expect(page.getByRole("checkbox", { name: "Lunes" })).toBeChecked();
		await page.getByRole("checkbox", { name: "Miércoles" }).check();
		await page.getByRole("checkbox", { name: "Sábado" }).check();
		await page.getByRole("radio", { name: "45 min" }).check();
		await page.getByRole("radio", { name: "45 min" }).focus();
		await page.keyboard.press("ArrowRight");
		await expect(page.getByRole("radio", { name: "1 h–1 h 30" })).toBeChecked();
		const wednesdayMinutes = page.getByLabel("Minutos disponibles el Miércoles");
		await wednesdayMinutes.focus();
		await wednesdayMinutes.press("ArrowUp");
		await expect(wednesdayMinutes).toHaveValue("61");
		await expect(page.getByLabel("Minutos disponibles el Lunes")).toHaveValue("60");
		await expect(page.getByLabel("Minutos disponibles el Miércoles")).toHaveValue("61");
		await expect(page.getByLabel("Minutos disponibles el Sábado")).toHaveValue("60");
		await expect(page.getByText("Varía por día")).toBeVisible();
	});

	test("maps all presets, keeps deselection sparse, and blocks invalid Continue without a PUT", async ({
		page,
	}) => {
		const savedSnapshots = await startAtAvailabilityStep(page);
		for (const day of ["Lunes", "Miércoles", "Sábado", "Domingo"] as const) {
			await page.getByRole("checkbox", { name: day }).check();
		}

		for (const [label, minutes] of [
			["45 min", "45"],
			["1 h–1 h 30", "60"],
			["2 h+", "120"],
		] as const) {
			await page.getByRole("radio", { name: label }).check();
			await expect(page.getByLabel("Minutos disponibles el Lunes")).toHaveValue(
				minutes,
			);
		}

		await page.getByRole("checkbox", { name: "Miércoles" }).uncheck();
		await page.getByRole("radio", { name: "45 min" }).check();
		const savesBeforeInvalidContinue = savedSnapshots.length;
		await page.getByRole("button", { name: "Continuar" }).click();
		expect(savedSnapshots).toHaveLength(savesBeforeInvalidContinue);
		await expect(
			page.getByRole("region", { name: "Configura tu plan" }).getByRole("alert"),
		).toContainText("150 minutos");
		await expect(
			page.getByRole("heading", { name: "¿Cuándo puedes entrenar?" }),
		).toBeVisible();

		await page.getByRole("radio", { name: "1 h–1 h 30" }).check();
		const saturdayMinutes = page.getByLabel("Minutos disponibles el Sábado");
		await saturdayMinutes.fill("90");
		await expect(saturdayMinutes).toHaveValue("90");
		await page.getByRole("button", { name: "Continuar" }).click();
		await expect.poll(() => savedSnapshots.length).toBe(savesBeforeInvalidContinue + 1);
		expect(savedSnapshots.at(-1)?.profile).toMatchObject({
			availability: {
				minutes_by_day: { monday: 60, saturday: 90, sunday: 60 },
			},
		});
		await expect(page.getByText("Paso 5 de 7")).toBeVisible();
	});

	test("reports too few days without saving", async ({ page }) => {
		const savedSnapshots = await startAtAvailabilityStep(page);
		await page.getByRole("checkbox", { name: "Lunes" }).check();
		await page.getByRole("checkbox", { name: "Miércoles" }).check();
		await page.getByRole("radio", { name: "2 h+" }).check();
		const savesBeforeInvalidContinue = savedSnapshots.length;
		await page.getByRole("button", { name: "Continuar" }).click();
		expect(savedSnapshots).toHaveLength(savesBeforeInvalidContinue);
		await expect(
			page.getByRole("region", { name: "Configura tu plan" }).getByRole("alert"),
		).toContainText("3 días");
	});

	test("hydrates mixed and uniform custom exact values without coercion", async ({
		page,
	}) => {
		await startWithHydratedAvailability(page, {
			monday: 45,
			wednesday: 75,
			saturday: 120,
		});
		await expect(page.getByText("Varía por día")).toBeVisible();
		await expect(page.getByLabel("Minutos disponibles el Miércoles")).toHaveValue(
			"75",
		);

		await startWithHydratedAvailability(page, {
			monday: 75,
			wednesday: 75,
			saturday: 75,
		});
		await expect(
			page.getByText("Duración uniforme personalizada: 75 min"),
		).toBeVisible();
		await expect(page.getByRole("radio", { name: "45 min" })).not.toBeChecked();
	});
});
