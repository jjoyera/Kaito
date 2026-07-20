import assert from "node:assert/strict";
import { test } from "node:test";

import { PrivateApiError } from "../../../shared/adapters/private-fetch";
import {
	generateTrainingPlan,
	PlanGenerationError,
} from "./generate-plan-api";

const validPlan = {
	plan_approach: "mode_z",
	start_date: "2026-07-06",
	end_date: "2026-07-12",
	block_focus: "Durabilidad en montaña",
	weeks: [
		{
			week_number: 1,
			sessions: [
				{
					scheduled_date: "2026-07-06",
					session_type: "Rodaje suave",
					planned_duration_minutes: 30,
					planned_distance_kilometers: "5.00",
					planned_elevation_meters: 25,
					intensity_description: "Suave",
					target_rpe_min: 2,
					target_rpe_max: 3,
					instructions: "Mantén un ritmo cómodo.",
					purpose: "Construir constancia.",
				},
			],
		},
	],
} as const;

function dependencies(response: Response) {
	return {
		apiBaseUrl: "https://api.example.test",
		getAccessToken: async () => "token",
		fetcher: async () => response,
	};
}

test("generation posts once and parses the exact public plan", async () => {
	const requests: Request[] = [];
	const result = await generateTrainingPlan({
		...dependencies(Response.json(validPlan)),
		fetcher: async (input, init) => {
			requests.push(new Request(input, init));
			return Response.json(validPlan);
		},
	});

	assert.deepEqual(result, validPlan);
	assert.equal(requests.length, 1);
	assert.equal(requests[0]?.method, "POST");
	assert.equal(requests[0]?.url, "https://api.example.test/planning/generate");
});

test("generation classifies safe API outcomes without reading their bodies", async () => {
	for (const [status, kind] of [
		[404, "missing_context"],
		[409, "cannot_generate"],
		[422, "invalid_generated_plan"],
		[503, "provider_unavailable"],
	] as const) {
		await assert.rejects(
			generateTrainingPlan(
				dependencies(new Response("private provider detail", { status })),
			),
			(error) =>
				error instanceof PlanGenerationError &&
				error.kind === kind &&
				!error.message.includes("private provider detail"),
		);
	}
});

test("generation rejects malformed success and preserves session errors", async () => {
	await assert.rejects(
		generateTrainingPlan(
			dependencies(Response.json({ ...validPlan, internal_id: "private" })),
		),
		(error) =>
			error instanceof PlanGenerationError &&
			error.kind === "invalid_generated_plan",
	);

	await assert.rejects(
		generateTrainingPlan({
			...dependencies(Response.json(validPlan)),
			getAccessToken: async () => undefined,
		}),
		(error) =>
			error instanceof PrivateApiError && error.kind === "auth_required",
	);
});
