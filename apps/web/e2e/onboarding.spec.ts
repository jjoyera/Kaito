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
