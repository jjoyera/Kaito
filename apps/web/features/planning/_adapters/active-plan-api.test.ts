import assert from "node:assert/strict";
import { test } from "node:test";

import { PrivateApiError } from "../../../shared/adapters/private-fetch";
import {
	fetchActiveTrainingPlan,
	parseActiveTrainingPlan,
	planCalendarDate,
	remainingBlockDays,
} from "./active-plan-api";

const validPlan = {
	plan_approach: "mode_z",
	start_date: "2026-07-06",
	end_date: "2026-07-19",
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

test("parser accepts the exact public active-plan response", () => {
	assert.deepEqual(parseActiveTrainingPlan(validPlan), validPlan);
});

test("parser rejects missing, extra, wrongly typed, and private fields", () => {
	const cases: unknown[] = [
		{ ...validPlan, block_focus: undefined },
		{ ...validPlan, unexpected: true },
		{
			...validPlan,
			weeks: [{ ...validPlan.weeks[0], week_number: "1" }],
		},
		{ ...validPlan, plan_id: "private" },
		{
			...validPlan,
			weeks: [
				{
					...validPlan.weeks[0],
					sessions: [
						{
							...validPlan.weeks[0].sessions[0],
							session_order: 1,
						},
					],
				},
			],
		},
	];

	for (const value of cases) {
		assert.throws(
			() => parseActiveTrainingPlan(value),
			/invalid_active_plan_response/,
		);
	}
});

test("parser rejects a plan whose start date is after its end date", () => {
	assert.throws(
		() =>
			parseActiveTrainingPlan({
				...validPlan,
				start_date: "2026-07-20",
				end_date: "2026-07-19",
			}),
		/invalid_active_plan_response/,
	);
});

test("plan calendar date uses Europe/Madrid at a UTC date boundary", () => {
	assert.equal(
		planCalendarDate(new Date("2026-07-05T22:30:00Z")),
		"2026-07-06",
	);
});

test("remaining block days exclude pre-start waiting and clamp after expiry", () => {
	assert.equal(
		remainingBlockDays("2026-07-01", "2026-07-06", "2026-07-19"),
		14,
	);
	assert.equal(
		remainingBlockDays("2026-07-10", "2026-07-06", "2026-07-19"),
		10,
	);
	assert.equal(
		remainingBlockDays("2026-07-20", "2026-07-06", "2026-07-19"),
		0,
	);
});

test("adapter maps 404 to empty and parses a successful response", async () => {
	const empty = await fetchActiveTrainingPlan(
		dependencies(new Response(null, { status: 404 })),
	);
	assert.equal(empty, "empty");

	const active = await fetchActiveTrainingPlan(
		dependencies(Response.json(validPlan)),
	);
	assert.deepEqual(active, validPlan);
});

test("adapter preserves safe auth/service failures and rejects malformed success", async () => {
	await assert.rejects(
		fetchActiveTrainingPlan({
			...dependencies(Response.json(validPlan)),
			getAccessToken: async () => undefined,
		}),
		(error) =>
			error instanceof PrivateApiError && error.kind === "auth_required",
	);

	await assert.rejects(
		fetchActiveTrainingPlan(
			dependencies(new Response(null, { status: 503 })),
		),
		(error) =>
			error instanceof PrivateApiError && error.kind === "auth_unavailable",
	);

	await assert.rejects(
		fetchActiveTrainingPlan(
			dependencies(Response.json({ ...validPlan, plan_id: "private" })),
		),
		/invalid_active_plan_response/,
	);
});
