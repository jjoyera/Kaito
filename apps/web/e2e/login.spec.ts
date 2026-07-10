import { expect, test } from "@playwright/test";

test.describe("/login", () => {
	test("shows labeled email/password controls and supports keyboard navigation", async ({
		page,
	}) => {
		await page.goto("/login");

		await expect(
			page.getByRole("heading", { name: /sign in to kaito/i }),
		).toBeVisible();
		await expect(page.getByLabel("Email address")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
		await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

		await page.keyboard.press("Tab");
		await expect(page.getByLabel("Email address")).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(page.getByLabel("Password")).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
	});

	test("validates required fields locally without attempting authentication", async ({
		page,
	}) => {
		await page.goto("/login");

		await page.getByRole("button", { name: "Sign in" }).click();

		await expect(page.getByText("Email is required.")).toBeVisible();
		await expect(page.getByText("Password is required.")).toBeVisible();
		await expect(page.getByLabel("Email address")).toHaveValue("");
		await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
		await expect(
			page.getByText("We could not sign you in with that email and password."),
		).toHaveCount(0);
		await expect(
			page.getByText("Kaito could not reach the sign-in service right now."),
		).toHaveCount(0);
	});

	test("validates email format locally and preserves the entered email value", async ({
		page,
	}) => {
		await page.goto("/login");

		await page.getByLabel("Email address").fill("runner-at-kaito");
		await page.getByLabel("Password").fill("trail-password");
		await page.getByRole("button", { name: "Sign in" }).click();

		await expect(page.getByText("Enter a valid email address.")).toBeVisible();
		await expect(page.getByLabel("Email address")).toHaveValue(
			"runner-at-kaito",
		);
		await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
		await expect(
			page.getByText("We could not sign you in with that email and password."),
		).toHaveCount(0);
		await expect(
			page.getByText("Kaito could not reach the sign-in service right now."),
		).toHaveCount(0);
	});

	test("prevents duplicate submissions while authentication is pending", async ({
		page,
	}) => {
		await page.goto("/login");

		await page.getByLabel("Email address").fill("pending@example.com");
		await page.getByLabel("Password").fill("trail-password");
		const submit = page.getByRole("button", { name: "Sign in" });

		await submit.click();
		await expect(
			page.getByRole("button", { name: "Signing in…" }),
		).toBeDisabled();
		await page.getByLabel("Password").focus();
		await page.keyboard.press("Enter");

		await expect(
			page.getByRole("button", { name: "Signing in…" }),
		).toBeDisabled();
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						(
							window as typeof window & {
								__KAITO_TEST_AUTH_CALL_COUNT__?: number;
							}
						).__KAITO_TEST_AUTH_CALL_COUNT__ ?? 0,
				),
			)
			.toBe(1);
	});

	test("shows generic invalid-credentials feedback", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel("Email address").fill("invalid@example.com");
		await page.getByLabel("Password").fill("trail-password");
		await page.getByRole("button", { name: "Sign in" }).click();

		const feedback = page.getByRole("alert").filter({
			hasText: "We could not sign you in with that email and password.",
		});
		await expect(feedback).toBeVisible();
		await expect(feedback).not.toContainText("provider");
		await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

		await page.getByLabel("Email address").fill("runner@example.com");
		await page.getByRole("button", { name: "Sign in" }).click();
		await expect(page).toHaveURL("/");
	});

	test("shows separate technical/system error feedback", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel("Email address").fill("system@example.com");
		await page.getByLabel("Password").fill("trail-password");
		await page.getByRole("button", { name: "Sign in" }).click();

		const feedback = page.getByRole("alert").filter({
			hasText: "Kaito could not reach the sign-in service right now.",
		});
		await expect(feedback).toBeVisible();
		await expect(feedback).not.toContainText(
			"We could not sign you in with that email and password.",
		);
		await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

		await page.getByLabel("Email address").fill("runner@example.com");
		await page.getByRole("button", { name: "Sign in" }).click();
		await expect(page).toHaveURL("/");
	});

	test("hands off successful authentication to the authenticated flow", async ({
		page,
	}) => {
		await page.goto("/login");

		await page.getByLabel("Email address").fill("runner@example.com");
		await page.getByLabel("Password").fill("trail-password");
		await page.getByRole("button", { name: "Sign in" }).click();

		await expect(page).toHaveURL("/");
		await expect(
			page.getByRole("heading", { name: "Project scaffold is running." }),
		).toBeVisible();
	});
});
