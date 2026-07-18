import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import {
	fetchTrainingApproachEligibility,
	PlanningResourceError,
	saveTrainingPlanDraft,
} from "./training-planning-api";

function dependencies(fetcher: PrivateFetchDependencies["fetcher"]): PrivateFetchDependencies {
	return {
		apiBaseUrl: "https://api.kaito.test",
		getAccessToken: async () => "token",
		fetcher,
	};
}

const eligibility = {
	recommended_approach: "mode_z",
	approaches: [
		{ approach: "kaio_path", available: true, blocking_reason_codes: [] },
		{ approach: "mode_z", available: false, blocking_reason_codes: ["recovering"] },
		{ approach: "kaioken", available: false, blocking_reason_codes: ["insufficient_volume_ratio"] },
	],
	safety_restriction_codes: ["no_load_increase"],
};

const planId = "9dd180d0-058d-4ee5-b8cf-3e93867a4041";

describe("training planning API", () => {
	it("requests eligibility using the exact encoded UTC date", async () => {
		await fetchTrainingApproachEligibility(
			"2026-07-01",
			dependencies(async (input) => {
				assert.equal(
					String(input),
					"https://api.kaito.test/planning/training-approach-eligibility?assessment_date=2026-07-01",
				);
				return new Response(JSON.stringify(eligibility), { status: 200 });
			}),
		);
	});

	it("distinguishes unsupported modality from a stale assessment date", async () => {
		for (const [detail, kind] of [["unsupported_modality", "unsupported"], ["assessment_date_out_of_range", "stale"]] as const) {
			await assert.rejects(
				fetchTrainingApproachEligibility("2026-07-01", dependencies(async () => new Response(JSON.stringify({ detail }), { status: 422 }))),
				(error) => error instanceof PlanningResourceError && error.kind === kind,
			);
		}
	});

	it("classifies exact draft conflict details by endpoint semantics", async () => {
		for (const [detail, kind] of [
			["Onboarding is incomplete", "onboarding_incomplete"],
			["blocked_approach", "blocked"],
			["draft_plan_conflict", "draft_conflict"],
		] as const) {
			await assert.rejects(
				saveTrainingPlanDraft(
					"mode_z",
					dependencies(async () => new Response(JSON.stringify({ detail }), { status: 409 })),
				),
				(error) => error instanceof PlanningResourceError && error.kind === kind,
			);
		}
	});

	it("persists only the canonical selected approach", async () => {
		let body: string | undefined;
		const result = await saveTrainingPlanDraft(
			"mode_z",
			dependencies(async (input, init) => {
				assert.equal(String(input), "https://api.kaito.test/planning/training-plan-draft");
				body = String(init?.body);
				return new Response(
					JSON.stringify({ plan_id: planId, status: "draft", plan_approach: "mode_z" }),
					{ status: 200 },
				);
			}),
		);
		assert.equal(body, JSON.stringify({ plan_approach: "mode_z" }));
		assert.equal(result.plan_id, planId);
	});

	it("rejects malformed successful eligibility payloads before the UI can consume them", async () => {
		for (const malformed of [
			{ ...eligibility, approaches: undefined },
			{ ...eligibility, approaches: eligibility.approaches.slice(0, 2) },
			{ ...eligibility, approaches: [...eligibility.approaches].reverse() },
			{ ...eligibility, safety_restriction_codes: [false] },
			{ ...eligibility, owner_id: "unsafe" },
		]) {
			await assert.rejects(
				fetchTrainingApproachEligibility(
					"2026-07-01",
					dependencies(async () => new Response(JSON.stringify(malformed), { status: 200 })),
				),
				/error|invalid/i,
			);
		}
	});

	it("rejects invalid successful draft responses", async () => {
		for (const malformed of [
			{ status: "draft", plan_approach: "mode_z" },
			{ plan_id: "not-a-uuid", status: "draft", plan_approach: "mode_z" },
			{ plan_id: planId, status: "active", plan_approach: "mode_z" },
			{ plan_id: planId, status: "draft", plan_approach: "z_mode" },
			{ plan_id: planId, status: "draft", plan_approach: "mode_z", owner_id: "unsafe" },
		]) {
			await assert.rejects(
				saveTrainingPlanDraft(
					"mode_z",
					dependencies(async () => new Response(JSON.stringify(malformed), { status: 200 })),
				),
				/error|invalid/i,
			);
		}
	});
});
