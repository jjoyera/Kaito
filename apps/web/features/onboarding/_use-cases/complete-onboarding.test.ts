import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import { completeOnboarding } from "./complete-onboarding";

function dependencies(
	fetcher: PrivateFetchDependencies["fetcher"],
): PrivateFetchDependencies {
	return {
		apiBaseUrl: "https://api.kaito.test",
		getAccessToken: async () => "token",
		fetcher,
	};
}

const completeSnapshot = {
	profile: {
		prior_history: {
			longest_completed_distance_km: 21,
		},
		baseline_4_weeks: {
			sessions: 4,
			distance_km: 40,
			positive_elevation_m: 800,
			longest_outing_km: 15,
			recent_consistency: "fairly_consistent" as const,
		},
		availability: {
			minutes_by_day: { monday: 60, wednesday: 60, friday: 60 },
		},
		training_preferences: {
			mountain_trail_access: "easy_access" as const,
			gym_access: "yes" as const,
			planning_preference: "fixed_routine" as const,
		},
	},
	goal: {
		modality: "trail" as const,
		target_date: "2026-12-01",
		target_distance_km: 42,
		positive_elevation_m: 1500,
	},
};

describe("completeOnboarding", () => {
	it("submits state=completed and reports success when it stays completed", async () => {
		let capturedBody: string | undefined;
		const outcome = await completeOnboarding(
			completeSnapshot,
			"2026-07-13",
			dependencies(async (_input, init) => {
				capturedBody = String(init?.body);
				return new Response(
					JSON.stringify({
						snapshot: { contract_version: "1", state: "completed", ...completeSnapshot },
						diagnostics: [],
					}),
					{ status: 200 },
				);
			}),
		);

		assert.equal(
			capturedBody,
			JSON.stringify({
				snapshot: {
					contract_version: "1",
					state: "completed",
					...completeSnapshot,
				},
				validation_date: "2026-07-13",
			}),
		);
		assert.equal(outcome.status, "completed");
	});

	it("reports a demotion when the backend returns state=incomplete with diagnostics", async () => {
		const outcome = await completeOnboarding(
			completeSnapshot,
			"2026-07-13",
			dependencies(
				async () =>
					new Response(
						JSON.stringify({
							snapshot: {
								contract_version: "1",
								state: "incomplete",
								...completeSnapshot,
							},
							diagnostics: [
								{
									code: "target_date_not_future",
									field: "goal.target_date",
									message_key: "target_date_not_future",
									severity: "error",
									metadata: {},
								},
							],
						}),
						{ status: 200 },
					),
			),
		);

		assert.equal(outcome.status, "demoted");
		if (outcome.status === "demoted") {
			assert.equal(outcome.result.diagnostics[0]?.field, "goal.target_date");
		}
	});

	it("reports an error without throwing for a backend failure", async () => {
		const outcome = await completeOnboarding(
			completeSnapshot,
			"2026-07-13",
			dependencies(async () => new Response(null, { status: 503 })),
		);
		assert.deepEqual(outcome, { status: "error" });
	});
});
