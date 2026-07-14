import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import { saveOnboardingStep } from "./save-onboarding-step";

function dependencies(
	fetcher: PrivateFetchDependencies["fetcher"],
): PrivateFetchDependencies {
	return {
		apiBaseUrl: "https://api.kaito.test",
		getAccessToken: async () => "token",
		fetcher,
	};
}

describe("saveOnboardingStep", () => {
	it("persists the accumulated snapshot with state incomplete on advance", async () => {
		let capturedBody: unknown;
		const outcome = await saveOnboardingStep(
			{ profile: { restrictions: { has_restrictions: false } }, goal: { modality: "trail" } },
			"2026-07-13",
			dependencies(async (_input, init) => {
				capturedBody = JSON.parse(String(init?.body));
				return new Response(
					JSON.stringify({
						snapshot: {
							contract_version: "1",
							state: "incomplete",
							profile: { restrictions: { has_restrictions: false } },
							goal: { modality: "trail" },
						},
						diagnostics: [],
					}),
					{ status: 200 },
				);
			}),
		);

		assert.equal(
			(capturedBody as { snapshot: { state: string } }).snapshot.state,
			"incomplete",
		);
		assert.equal(outcome.status, "saved");
	});

	it("reports an error without throwing when the save fails, so local answers are preserved", async () => {
		const outcome = await saveOnboardingStep(
			{ profile: {}, goal: {} },
			"2026-07-13",
			dependencies(async () => new Response(null, { status: 503 })),
		);
		assert.deepEqual(outcome, { status: "error" });
	});

	it("reports an error without throwing for a network failure", async () => {
		const outcome = await saveOnboardingStep(
			{ profile: {}, goal: {} },
			"2026-07-13",
			dependencies(async () => {
				throw new Error("network down");
			}),
		);
		assert.deepEqual(outcome, { status: "error" });
	});
});
