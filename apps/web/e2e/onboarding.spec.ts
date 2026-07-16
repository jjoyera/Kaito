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

	test("saves an Ultra goal and continues the existing wizard flow", async ({
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
				body: JSON.stringify({
					snapshot: {
						contract_version: "1",
						state: "incomplete",
						profile: {},
						goal: capturedBody?.snapshot.goal ?? {},
					},
					diagnostics: [],
				}),
			});
		});

		await page.goto("/onboarding");
		await page.getByRole("button", { name: "Crear mi plan" }).click();
		await page.getByRole("button", { name: "Ultra" }).click();
		await expect(page.getByRole("button", { name: "Ultra" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await page.getByLabel("Distancia (km)").fill("65");
		await page.getByLabel("Desnivel + (m)").fill("3400");
		await page.getByLabel("Fecha objetivo").fill("2026-10-03");
		await page.getByRole("button", { name: "Continuar" }).click();

		await expect(
			page.getByRole("group", { name: "Cuéntanos tu experiencia previa" }),
		).toBeVisible();
		expect(capturedBody?.snapshot.goal).toEqual({
			modality: "ultra_trail",
			target_distance_km: 65,
			positive_elevation_m: 3400,
			target_date: "2026-10-03",
		});
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
