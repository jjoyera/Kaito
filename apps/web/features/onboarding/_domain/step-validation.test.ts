import assert from "node:assert/strict";
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

	test("accepts a valid trail goal with its conditional fields", () => {
		const errors = validateStep(
			"goal",
			draft({
				goal: {
					modality: "trail",
					target_date: "2026-12-01",
					target_distance_km: 42,
					positive_elevation_m: 1500,
					technicality: "medium",
				},
			}),
		);
		assert.deepEqual(errors, {});
	});

	test("requires trail-specific fields but not OCR/backyard-specific ones", () => {
		const errors = validateStep(
			"goal",
			draft({
				goal: { modality: "trail", target_date: "2026-12-01" },
			}),
		);
		assert.equal(errors["goal.target_distance_km"], "required");
		assert.equal(errors["goal.positive_elevation_m"], "required");
		assert.equal(errors["goal.technicality"], "required");
		assert.equal(errors["goal.obstacle_count"], undefined);
		assert.equal(errors["goal.target_loops"], undefined);
	});

	test("requires only target_loops for backyard", () => {
		const errors = validateStep(
			"goal",
			draft({
				goal: { modality: "backyard", target_date: "2026-12-01" },
			}),
		);
		assert.deepEqual(Object.keys(errors), ["goal.target_loops"]);
	});

	test("requires distance and obstacle_count for OCR, not elevation/technicality", () => {
		const errors = validateStep(
			"goal",
			draft({
				goal: { modality: "ocr", target_date: "2026-12-01" },
			}),
		);
		assert.equal(errors["goal.target_distance_km"], "required");
		assert.equal(errors["goal.obstacle_count"], "required");
		assert.equal(errors["goal.positive_elevation_m"], undefined);
		assert.equal(errors["goal.technicality"], undefined);
	});

	test("rejects target_loops below 1", () => {
		const errors = validateStep(
			"goal",
			draft({
				goal: {
					modality: "backyard",
					target_date: "2026-12-01",
					target_loops: 0,
				},
			}),
		);
		assert.equal(errors["goal.target_loops"], "out_of_range");
	});
});

describe("validateStep(prior_history)", () => {
	test("flags every required field as missing when blank", () => {
		const errors = validateStep("prior_history", draft());
		assert.equal(errors["profile.prior_history.training_years"], "required");
		assert.equal(
			errors["profile.prior_history.completed_race_count_range"],
			"required",
		);
		assert.equal(
			errors["profile.prior_history.practiced_modalities"],
			"required",
		);
	});

	test("accepts a new runner explicitly reporting no prior experience", () => {
		const errors = validateStep(
			"prior_history",
			draft({
				profile: {
					prior_history: {
						training_years: 0,
						completed_race_count_range: "none",
						longest_completed_distance_km: 0,
						practiced_modalities: [],
						practiced_terrain: [],
					},
				},
			}),
		);
		assert.deepEqual(errors, {});
	});

	test("rejects training_years that are not whole or half years", () => {
		const errors = validateStep(
			"prior_history",
			draft({
				profile: {
					prior_history: {
						training_years: 1.3,
						completed_race_count_range: "one_to_three",
						longest_completed_distance_km: 10,
						practiced_modalities: ["trail"],
						practiced_terrain: ["trail"],
					},
				},
			}),
		);
		assert.equal(
			errors["profile.prior_history.training_years"],
			"out_of_range",
		);
	});
});

describe("validateStep(baseline)", () => {
	test("flags every required field as missing when blank", () => {
		const errors = validateStep("baseline", draft());
		assert.equal(errors["profile.baseline_4_weeks.sessions"], "required");
		assert.equal(
			errors["profile.baseline_4_weeks.training_hours"],
			"required",
		);
	});

	test("accepts an all-zero baseline for a runner starting from rest", () => {
		const errors = validateStep(
			"baseline",
			draft({
				profile: {
					baseline_4_weeks: {
						sessions: 0,
						training_hours: 0,
						distance_km: 0,
						positive_elevation_m: 0,
						longest_outing_km: 0,
					},
				},
			}),
		);
		assert.deepEqual(errors, {});
	});

	test("rejects negative values", () => {
		const errors = validateStep(
			"baseline",
			draft({
				profile: {
					baseline_4_weeks: {
						sessions: 3,
						training_hours: 4,
						distance_km: -5,
						positive_elevation_m: 100,
						longest_outing_km: 10,
					},
				},
			}),
		);
		assert.equal(
			errors["profile.baseline_4_weeks.distance_km"],
			"out_of_range",
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
