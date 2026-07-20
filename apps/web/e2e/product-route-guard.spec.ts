import { expect, test, type Page } from "@playwright/test";

const APP_URL = "http://127.0.0.1:3000";
const API_ORIGIN = "http://127.0.0.1:9999";

type ProductState =
	| "completed"
	| "incomplete-active"
	| "incomplete-none"
	| "missing-none"
	| "unavailable";

async function setRouteState(
	page: Page,
	productState: ProductState,
	session = "authenticated",
) {
	await page.context().addCookies([
		{ name: "kaito-e2e-session", value: session, url: APP_URL },
		{ name: "kaito-e2e-product-state", value: productState, url: APP_URL },
	]);
}

async function interceptNoActivePlan(page: Page) {
	await page.route(`${API_ORIGIN}/planning/active`, async (route) => {
		await route.fulfill({ status: 404, body: "not found" });
	});
}

test.describe("authenticated product route guard", () => {
	test("redirects completed onboarding to the empty plan dashboard", async ({
		page,
	}) => {
		await setRouteState(page, "completed");
		await interceptNoActivePlan(page);

		await page.goto("/onboarding");

		await expect(page).toHaveURL("/plan");
		await expect(
			page.getByRole("heading", { name: "Todavía no tienes un plan activo" }),
		).toBeVisible();
	});

	test("redirects incomplete onboarding with an active plan to plan", async ({
		page,
	}) => {
		await setRouteState(page, "incomplete-active");
		await interceptNoActivePlan(page);

		await page.goto("/onboarding");

		await expect(page).toHaveURL("/plan");
	});

	test("redirects incomplete plan access to onboarding without looping", async ({
		page,
	}) => {
		await setRouteState(page, "incomplete-none");

		await page.goto("/plan");

		await expect(page).toHaveURL("/onboarding");
		await expect(
			page.getByRole("heading", {
				name: "Tu plan de entrenamiento, hecho a tu medida",
			}),
		).toBeVisible();
		await page.waitForTimeout(200);
		await expect(page).toHaveURL("/onboarding");
	});

	test("does not accept a direct active-plan handoff marker", async ({ page }) => {
		await setRouteState(page, "incomplete-none");

		await page.goto("/plan?handoff=active-plan");

		await expect(page).toHaveURL("/onboarding");
	});

	test("allows missing onboarding without an active plan", async ({ page }) => {
		await setRouteState(page, "missing-none");

		await page.goto("/onboarding");

		await expect(
			page.getByRole("button", { name: "Crear mi plan" }),
		).toBeVisible();
	});

	for (const route of ["/onboarding", "/plan"] as const) {
		test(`renders a bounded retry state on ${route} when backend state is unavailable`, async ({
			page,
		}) => {
			await setRouteState(page, "unavailable");

			await page.goto(route);

			await expect(page).toHaveURL(route);
			await expect(
				page.getByRole("heading", {
					name: "No hemos podido comprobar el estado de tu cuenta",
				}),
			).toBeVisible();
			await expect(page.getByRole("link", { name: /Reintentar/ })).toHaveAttribute(
				"href",
				route,
			);
			await expect(page.locator(".onboarding-flow, .plan-dashboard")).toHaveCount(0);
		});
	}

	test("preserves the anonymous plan redirect and returnTo", async ({ page }) => {
		await setRouteState(page, "completed", "anonymous");

		await page.goto("/plan");

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fplan$/);
		await expect(page.locator(".plan-dashboard")).toHaveCount(0);
	});
});
