import { expect, test } from "@playwright/test";

test("homepage shows scaffold heading", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Project scaffold is running." }),
	).toBeVisible();
});
