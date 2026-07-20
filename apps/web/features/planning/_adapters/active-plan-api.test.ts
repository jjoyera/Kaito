import assert from "node:assert/strict";
import { test } from "node:test";

import { PrivateApiError } from "../../../shared/adapters/private-fetch";
import {
	activeBlockMetrics,
	chronologicalPlanSessions,
	currentPlanWeek,
	fetchActiveTrainingPlan,
	parseActiveTrainingPlan,
	planCalendarDate,
	remainingBlockDays,
	temporalBlockProgress,
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
	assert.equal(remainingBlockDays("2026-07-06", "2026-07-06", "2026-07-06"), 1);
});

test("temporal progress clamps before and after a block and handles one-day blocks", () => {
	assert.equal(temporalBlockProgress("2026-07-05", "2026-07-06", "2026-07-19"), 0);
	assert.equal(temporalBlockProgress("2026-07-06", "2026-07-06", "2026-07-19"), 7);
	assert.equal(temporalBlockProgress("2026-07-20", "2026-07-06", "2026-07-19"), 100);
	assert.equal(temporalBlockProgress("2026-07-06", "2026-07-06", "2026-07-06"), 100);
});

test("calendar sessions are chronological and preserve backend order on the same date", () => {
	const sessions = [
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-12", session_type: "Última" },
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-06", session_type: "Primera" },
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-06", session_type: "Segunda" },
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-08", session_type: "Intermedia" },
	];

	assert.deepEqual(
		chronologicalPlanSessions(sessions).map((session) => session.session_type),
		["Primera", "Segunda", "Intermedia", "Última"],
	);
	assert.equal(sessions[0]?.session_type, "Última");
});

test("current week includes Monday through Sunday and keeps sessions in backend order", () => {
	const sessions = [
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-06", session_type: "Primera" },
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-06", session_type: "Segunda" },
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-12", session_type: "Recuperación" },
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-13", session_type: "Fuera" },
	];
	const week = currentPlanWeek("2026-07-08", sessions);

	assert.deepEqual(week.map((day) => day.date), [
		"2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09",
		"2026-07-10", "2026-07-11", "2026-07-12",
	]);
	assert.deepEqual(week[0]?.sessions.map((session) => session.session_type), ["Primera", "Segunda"]);
	assert.equal(week[6]?.sessions[0]?.session_type, "Recuperación");
});

test("active block metrics count and sum only the current Monday-Sunday week", () => {
	const sessions = [
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-06", planned_distance_kilometers: "5.25" },
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-12", planned_distance_kilometers: "7.50" },
		{ ...validPlan.weeks[0].sessions[0], scheduled_date: "2026-07-13", planned_distance_kilometers: "99.00" },
	];

	assert.deepEqual(activeBlockMetrics("2026-07-08", "2026-07-06", "2026-07-19", sessions), {
		plannedKilometers: 12.75,
		plannedSessionCount: 2,
		remainingDays: 12,
		temporalProgress: 21,
	});
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
