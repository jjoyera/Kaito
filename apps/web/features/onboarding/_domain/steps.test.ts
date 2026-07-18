import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import { ONBOARDING_STEPS, stepAfter, stepBefore, stepIndex } from "./steps";

describe("ONBOARDING_STEPS", () => {
	test("declares the fixed onboarding order with no plan-approach content", () => {
		assert.deepEqual(
			ONBOARDING_STEPS.map((step) => step.id),
			[
				"goal",
				"prior_history",
				"baseline",
				"availability",
				"preferences",
				"physical_status",
			],
		);
	});

	test("assigns every contract field to exactly one step", () => {
		const allFields = ONBOARDING_STEPS.flatMap((step) => step.fields);
		const uniqueFields = new Set(allFields);
		assert.equal(uniqueFields.size, allFields.length);
	});

	test("goal step owns every goal.* field including modality-conditional ones", () => {
		const goalStep = ONBOARDING_STEPS.find((step) => step.id === "goal");
		assert.deepEqual(goalStep?.fields, [
			"goal.modality",
			"goal.target_date",
			"goal.target_distance_km",
			"goal.positive_elevation_m",
			"goal.max_altitude_m",
			"goal.obstacle_count",
			"goal.obstacle_difficulty",
			"goal.target_loops",
		]);
	});

	test("prior-history step owns only retained contract fields", () => {
		const priorHistoryStep = ONBOARDING_STEPS.find(
			(step) => step.id === "prior_history",
		);
		assert.deepEqual(priorHistoryStep?.fields, [
			"profile.prior_history.longest_completed_distance_km",
			"profile.prior_history.habitual_terrain",
			"profile.prior_history.mountain_experience",
			"profile.prior_history.prior_modality_race_frequency",
		]);
	});

	test("baseline step owns retained totals and consistency, but not training hours", () => {
		const baselineStep = ONBOARDING_STEPS.find((step) => step.id === "baseline");
		assert.deepEqual(baselineStep?.fields, [
			"profile.baseline_4_weeks.sessions",
			"profile.baseline_4_weeks.distance_km",
			"profile.baseline_4_weeks.positive_elevation_m",
			"profile.baseline_4_weeks.longest_outing_km",
			"profile.baseline_4_weeks.recent_consistency",
		]);
	});

	test("preferences step owns the three training preference choices", () => {
		const preferencesStep = ONBOARDING_STEPS.find(
			(step) => step.id === "preferences",
		);
		assert.deepEqual(preferencesStep?.fields, [
			"profile.training_preferences.mountain_trail_access",
			"profile.training_preferences.gym_access",
			"profile.training_preferences.planning_preference",
		]);
	});

	test("physical-status step owns its required status and optional detail", () => {
		const physicalStatusStep = ONBOARDING_STEPS.find(
			(step) => step.id === "physical_status",
		);
		assert.deepEqual(physicalStatusStep?.fields, [
			"profile.physical_status.status",
			"profile.physical_status.pain_or_limitation_detail",
		]);
	});
});

describe("stepIndex", () => {
	test("returns the position of a known step", () => {
		assert.equal(stepIndex("goal"), 0);
		assert.equal(stepIndex("preferences"), 4);
		assert.equal(stepIndex("physical_status"), 5);
	});
});

describe("stepAfter / stepBefore", () => {
	test("walks forward through the fixed order", () => {
		assert.equal(stepAfter("goal"), "prior_history");
		assert.equal(stepAfter("baseline"), "availability");
	});

	test("returns undefined past the last step", () => {
		assert.equal(stepAfter("preferences"), "physical_status");
		assert.equal(stepAfter("physical_status"), undefined);
	});

	test("walks backward through the fixed order", () => {
		assert.equal(stepBefore("physical_status"), "preferences");
		assert.equal(stepBefore("preferences"), "availability");
		assert.equal(stepBefore("prior_history"), "goal");
	});

	test("returns undefined before the first step", () => {
		assert.equal(stepBefore("goal"), undefined);
	});
});
