import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import { loadOnboardingDraft } from "./load-onboarding-draft";

const storedResult = {
	snapshot: {
		contract_version: "1",
		state: "incomplete" as const,
		profile: {
			availability: {
				minutes_by_day: { monday: 45, wednesday: 75, saturday: 120 },
			},
			training_preferences: {
				mountain_trail_access: "easy_access" as const,
				gym_access: "yes" as const,
				planning_preference: "fixed_routine" as const,
			},
		},
		goal: { modality: "trail" },
	},
	diagnostics: [],
};

function dependencies(
	fetcher: PrivateFetchDependencies["fetcher"],
): PrivateFetchDependencies {
	return {
		apiBaseUrl: "https://api.kaito.test",
		getAccessToken: async () => "token",
		fetcher,
	};
}

describe("loadOnboardingDraft", () => {
	it("hydrates the exact sparse availability returned by GET", async () => {
		let requestedUrl: string | undefined;
		const outcome = await loadOnboardingDraft(
			"2026-07-13",
			dependencies(async (input) => {
				requestedUrl = String(input);
				return new Response(JSON.stringify(storedResult), { status: 200 });
			}),
		);
		assert.equal(
			requestedUrl,
			"https://api.kaito.test/runner-profile/onboarding?validation_date=2026-07-13",
		);
		assert.ok(
			JSON.stringify(outcome) ===
				JSON.stringify({ status: "loaded", result: storedResult }),
			"onboarding response mismatch",
		);
		if (outcome.status !== "loaded") {
			assert.fail("expected loaded onboarding draft");
		}
		assert.ok(
			JSON.stringify(outcome.result.snapshot.profile.availability?.minutes_by_day) ===
				JSON.stringify({ monday: 45, wednesday: 75, saturday: 120 }),
			"availability round-trip mismatch",
		);
		assert.equal(
			"baseMode" in (outcome.result.snapshot.profile.availability ?? {}),
			false,
		);
		assert.equal(
			"pendingDays" in (outcome.result.snapshot.profile.availability ?? {}),
			false,
		);
	});

	it("starts blank when there is no stored snapshot yet", async () => {
		const outcome = await loadOnboardingDraft(
			"2026-07-13",
			dependencies(async () => new Response(null, { status: 404 })),
		);
		assert.deepEqual(outcome, { status: "blank" });
	});

	it("reports a load error without throwing for backend failures", async () => {
		const outcome = await loadOnboardingDraft(
			"2026-07-13",
			dependencies(async () => new Response(null, { status: 503 })),
		);
		assert.deepEqual(outcome, { status: "error" });
	});

	it("reports a load error without throwing for network failures", async () => {
		const outcome = await loadOnboardingDraft(
			"2026-07-13",
			dependencies(async () => {
				throw new Error("network down");
			}),
		);
		assert.deepEqual(outcome, { status: "error" });
	});
});
