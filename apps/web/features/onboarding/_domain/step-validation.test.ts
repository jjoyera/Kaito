import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import { validateStep, type OnboardingSnapshotDraft } from "./step-validation";

function draft(
	overrides: Partial<OnboardingSnapshotDraft> = {},
): OnboardingSnapshotDraft {
	return {
		profile: {},
		goal: {},
		...overrides,
	};
}

describe("validateStep(goal)", () => {
	test("flags required fields as missing on a blank goal", () => {
		const errors = validateStep("goal", draft());
		assert.equal(errors["goal.modality"], "required");
		assert.equal(errors["goal.target_date"], "required");
	});

	test("accepts a valid Trail goal with the three visible race-detail fields", () => {
		const errors = validateStep(
			"goal",
			draft({
				goal: {
					modality: "trail",
					target_date: "2026-12-01",
					target_distance_km: 42,
					positive_elevation_m: 1500,
				},
			}),
		);
		assert.deepEqual(errors, {});
	});

	test("requires distance and elevation, but not removed or optional goal fields", () => {
		const errors = validateStep(
			"goal",
			draft({
				goal: { modality: "trail", target_date: "2026-12-01" },
			}),
		);
		assert.equal(errors["goal.target_distance_km"], "required");
		assert.equal(errors["goal.positive_elevation_m"], "required");
		assert.equal(errors["goal.max_altitude_m"], undefined);
	});

	test("accepts Ultra with the same fields as Trail", () => {
		const errors = validateStep(
			"goal",
			draft({
				goal: {
					modality: "ultra_trail",
					target_date: "2026-12-01",
					target_distance_km: 65,
					positive_elevation_m: 3400,
				},
			}),
		);
		assert.deepEqual(errors, {});
	});

	test("rejects race types that are not currently offered in step 1", () => {
		const errors = validateStep(
			"goal",
			draft({
				goal: { modality: "ocr", target_date: "2026-12-01" },
			}),
		);
		assert.equal(errors["goal.modality"], "invalid_type");
	});
});

describe("validateStep(prior_history)", () => {
	test("requires the four answers visible in step 2", () => {
		const errors = validateStep("prior_history", draft());
		assert.deepEqual(errors, {
			"profile.prior_history.longest_completed_distance_km": "required",
			"profile.prior_history.habitual_terrain": "required",
			"profile.prior_history.mountain_experience": "required",
			"profile.prior_history.prior_modality_race_frequency": "required",
		});
	});

	test("accepts dedicated step 2 values without requiring hidden legacy fields", () => {
		const errors = validateStep(
			"prior_history",
			draft({
				profile: {
					prior_history: {
						longest_completed_distance_km: 0,
						habitual_terrain: "mixed",
						mountain_experience: "low",
						prior_modality_race_frequency: "never",
					},
				},
			}),
		);
		assert.deepEqual(errors, {});
	});

	test("rejects invalid dedicated values and negative distance", () => {
		const errors = validateStep(
			"prior_history",
			draft({
				profile: {
					prior_history: {
						longest_completed_distance_km: -1,
						habitual_terrain: "forest",
						mountain_experience: "expert",
						prior_modality_race_frequency: "sometimes",
					} as unknown as OnboardingSnapshotDraft["profile"]["prior_history"],
				},
			}),
		);
		assert.equal(
			errors["profile.prior_history.longest_completed_distance_km"],
			"out_of_range",
		);
		assert.equal(errors["profile.prior_history.habitual_terrain"], "invalid_type");
		assert.equal(
			errors["profile.prior_history.mountain_experience"],
			"invalid_type",
		);
		assert.equal(
			errors["profile.prior_history.prior_modality_race_frequency"],
			"invalid_type",
		);
	});
});

describe("validateStep(baseline)", () => {
	test("requires all preceding-four-week totals and recent consistency", () => {
		const errors = validateStep("baseline", draft());
		assert.deepEqual(errors, {
			"profile.baseline_4_weeks.sessions": "required",
			"profile.baseline_4_weeks.distance_km": "required",
			"profile.baseline_4_weeks.positive_elevation_m": "required",
			"profile.baseline_4_weeks.longest_outing_km": "required",
			"profile.baseline_4_weeks.total_running_minutes": "required",
			"profile.baseline_4_weeks.longest_outing_duration_minutes": "required",
			"profile.baseline_4_weeks.longest_outing_positive_elevation_m": "required",
			"profile.baseline_4_weeks.recent_consistency": "required",
		});
	});

	test("accepts an all-zero baseline without defaulting blank answers", () => {
		const errors = validateStep(
			"baseline",
			draft({
				profile: {
					baseline_4_weeks: {
						sessions: 0,
						distance_km: 0,
						positive_elevation_m: 0,
						longest_outing_km: 0,
						total_running_minutes: 0,
						longest_outing_duration_minutes: 0,
						longest_outing_positive_elevation_m: 0,
						recent_consistency: "irregular",
					},
				},
			}),
		);
		assert.deepEqual(errors, {});
	});

	test("requires strict non-negative integers for the new baseline fields", () => {
		const fields = [
			"total_running_minutes",
			"longest_outing_duration_minutes",
			"longest_outing_positive_elevation_m",
		] as const;
		for (const field of fields) {
			for (const invalid of [
				true,
				1.5,
				-1,
				Number.NaN,
				Number.POSITIVE_INFINITY,
				"1",
			]) {
				const baseline = {
					sessions: 1,
					distance_km: 10,
					positive_elevation_m: 100,
					longest_outing_km: 5,
					total_running_minutes: 60,
					longest_outing_duration_minutes: 30,
					longest_outing_positive_elevation_m: 50,
					recent_consistency: "irregular" as const,
				};
				baseline[field] = invalid as number;
				const errors = validateStep(
					"baseline",
					draft({ profile: { baseline_4_weeks: baseline } }),
				);
				assert.equal(
					errors[`profile.baseline_4_weeks.${field}`],
					"out_of_range",
				);
			}
		}
	});

	test("attaches longest-outing relationship errors to the offending fields", () => {
		const errors = validateStep(
			"baseline",
			draft({
				profile: {
					baseline_4_weeks: {
						sessions: 2,
						distance_km: 12,
						positive_elevation_m: 100,
						longest_outing_km: 8,
						total_running_minutes: 60,
						longest_outing_duration_minutes: 61,
						longest_outing_positive_elevation_m: 101,
						recent_consistency: "fairly_consistent",
					},
				},
			}),
		);
		assert.equal(
			errors["profile.baseline_4_weeks.longest_outing_duration_minutes"],
			"out_of_range",
		);
		assert.equal(
			errors["profile.baseline_4_weeks.longest_outing_positive_elevation_m"],
			"out_of_range",
		);
	});

	test("rejects invalid consistency and negative retained numeric values", () => {
		const errors = validateStep(
			"baseline",
			draft({
				profile: {
					baseline_4_weeks: {
						sessions: 3,
						distance_km: -5,
						positive_elevation_m: 100,
						longest_outing_km: 10,
						recent_consistency: "sometimes",
					} as unknown as OnboardingSnapshotDraft["profile"]["baseline_4_weeks"],
				},
			}),
		);
		assert.equal(
			errors["profile.baseline_4_weeks.distance_km"],
			"out_of_range",
		);
		assert.equal(
			errors["profile.baseline_4_weeks.recent_consistency"],
			"invalid_type",
		);
	});
});

describe("validateStep(availability)", () => {
	test("requires at least 3 present days and 150 total minutes", () => {
		const errors = validateStep(
			"availability",
			draft({
				profile: {
					availability: { minutes_by_day: { monday: 30, tuesday: 30 } },
				},
			}),
		);
		assert.equal(
			errors["profile.availability.minutes_by_day"],
			"out_of_range",
		);
	});

	test("accepts 3 present days meeting the 150-minute floor", () => {
		const errors = validateStep(
			"availability",
			draft({
				profile: {
					availability: {
						minutes_by_day: { monday: 60, wednesday: 60, friday: 60 },
					},
				},
			}),
		);
		assert.deepEqual(errors, {});
	});

	test("rejects a per-day value outside 15-300", () => {
		const errors = validateStep(
			"availability",
			draft({
				profile: {
					availability: {
						minutes_by_day: { monday: 10, wednesday: 60, friday: 60 },
					},
				},
			}),
		);
		assert.equal(
			errors["profile.availability.minutes_by_day"],
			"invalid_type",
		);
	});
});

describe("validateStep(physical_status)", () => {
	test("requires a physical status but accepts an omitted detail", () => {
		assert.deepEqual(validateStep("physical_status", draft()), {
			"profile.physical_status.status": "required",
			"profile.physical_status.has_pain_or_limitation": "required",
		});
		assert.deepEqual(
			validateStep(
				"physical_status",
				draft({
					profile: {
						physical_status: {
							status: "feeling_good",
							has_pain_or_limitation: false,
						},
					},
				}),
			),
			{},
		);
	});

	test("rejects an unknown status and detail longer than 500 characters", () => {
		const errors = validateStep(
			"physical_status",
			draft({
				profile: {
					physical_status: {
						status: "fine",
						has_pain_or_limitation: false,
						pain_or_limitation_detail: "x".repeat(501),
					} as unknown as OnboardingSnapshotDraft["profile"]["physical_status"],
				},
			}),
		);
		assert.deepEqual(errors, {
			"profile.physical_status.status": "invalid_type",
			"profile.physical_status.pain_or_limitation_detail": "invalid_length",
		});
	});

	test("preserves valid internal whitespace in the optional detail", () => {
		assert.deepEqual(
			validateStep(
				"physical_status",
				draft({
					profile: {
						physical_status: {
							status: "recovering",
							has_pain_or_limitation: true,
							pain_or_limitation_affects_running: true,
							pain_or_limitation_detail: "Rodilla derecha\n  al bajar",
						},
					},
				}),
			),
			{},
		);
	});
});

test("requires structured pain answers and conditionally requires running impact", () => {
	assert.deepEqual(
		validateStep(
			"physical_status",
			draft({ profile: { physical_status: { status: "feeling_good" } } }),
		),
		{ "profile.physical_status.has_pain_or_limitation": "required" },
	);
	assert.deepEqual(
		validateStep(
			"physical_status",
			draft({
				profile: {
					physical_status: {
						status: "feeling_good",
						has_pain_or_limitation: true,
					},
				},
			}),
		),
		{
			"profile.physical_status.pain_or_limitation_affects_running": "required",
		},
	);
});

describe("validateStep(preferences)", () => {
	test("requires all three training preference choices", () => {
		const errors = validateStep("preferences", draft());
		assert.deepEqual(errors, {
			"profile.training_preferences.mountain_trail_access": "required",
			"profile.training_preferences.gym_access": "required",
			"profile.training_preferences.planning_preference": "required",
		});
	});

	test("accepts a complete set of training preferences", () => {
		const errors = validateStep(
			"preferences",
			draft({
				profile: {
					training_preferences: {
						mountain_trail_access: "weekends_only",
						gym_access: "home_only",
						planning_preference: "flexible_weekly",
					},
				},
			}),
		);
		assert.deepEqual(errors, {});
	});

	test("rejects values outside the preference enums", () => {
		const errors = validateStep(
			"preferences",
			draft({
				profile: {
					training_preferences: {
						mountain_trail_access: "daily",
						gym_access: "no",
						planning_preference: "random",
					} as unknown as OnboardingSnapshotDraft["profile"]["training_preferences"],
				},
			}),
		);
		assert.deepEqual(errors, {
			"profile.training_preferences.mountain_trail_access": "invalid_type",
			"profile.training_preferences.gym_access": "invalid_type",
			"profile.training_preferences.planning_preference": "invalid_type",
		});
	});
});
