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
	test("requires four preceding-four-week totals and recent consistency", () => {
		const errors = validateStep("baseline", draft());
		assert.deepEqual(errors, {
			"profile.baseline_4_weeks.sessions": "required",
			"profile.baseline_4_weeks.distance_km": "required",
			"profile.baseline_4_weeks.positive_elevation_m": "required",
			"profile.baseline_4_weeks.longest_outing_km": "required",
			"profile.baseline_4_weeks.recent_consistency": "required",
		});
	});

	test("accepts an all-zero baseline without training hours", () => {
		const errors = validateStep(
			"baseline",
			draft({
				profile: {
					baseline_4_weeks: {
						sessions: 0,
						distance_km: 0,
						positive_elevation_m: 0,
						longest_outing_km: 0,
						recent_consistency: "irregular",
					},
				},
			}),
		);
		assert.deepEqual(errors, {});
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

describe("validateStep(restrictions)", () => {
	test("does not require detail when has_restrictions is false", () => {
		const errors = validateStep(
			"restrictions",
			draft({ profile: { restrictions: { has_restrictions: false } } }),
		);
		assert.deepEqual(errors, {});
	});

	test("requires detail when has_restrictions is true", () => {
		const errors = validateStep(
			"restrictions",
			draft({ profile: { restrictions: { has_restrictions: true } } }),
		);
		assert.equal(errors["profile.restrictions.detail"], "required");
	});

	test("accepts trimmed detail within 1-500 characters, including sensitive wording", () => {
		const errors = validateStep(
			"restrictions",
			draft({
				profile: {
					restrictions: {
						has_restrictions: true,
						detail: "Recovering from a knee injury, cleared to run by physio.",
					},
				},
			}),
		);
		assert.deepEqual(errors, {});
	});
});
