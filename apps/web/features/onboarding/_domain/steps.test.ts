import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import { ONBOARDING_STEPS, stepAfter, stepBefore, stepIndex } from "./steps";

describe("ONBOARDING_STEPS", () => {
	test("declares the fixed onboarding order with no plan-approach content", () => {
		assert.deepEqual(
			ONBOARDING_STEPS.map((step) => step.id),
			["goal", "prior_history", "baseline", "availability", "restrictions"],
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
			"goal.technicality",
			"goal.max_altitude_m",
			"goal.obstacle_count",
			"goal.obstacle_difficulty",
			"goal.target_loops",
		]);
	});

	test("restrictions step owns has_restrictions and detail", () => {
		const restrictionsStep = ONBOARDING_STEPS.find(
			(step) => step.id === "restrictions",
		);
		assert.deepEqual(restrictionsStep?.fields, [
			"profile.restrictions.has_restrictions",
			"profile.restrictions.detail",
		]);
	});
});

describe("stepIndex", () => {
	test("returns the position of a known step", () => {
		assert.equal(stepIndex("goal"), 0);
		assert.equal(stepIndex("restrictions"), 4);
	});
});

describe("stepAfter / stepBefore", () => {
	test("walks forward through the fixed order", () => {
		assert.equal(stepAfter("goal"), "prior_history");
		assert.equal(stepAfter("baseline"), "availability");
	});

	test("returns undefined past the last step", () => {
		assert.equal(stepAfter("restrictions"), undefined);
	});

	test("walks backward through the fixed order", () => {
		assert.equal(stepBefore("restrictions"), "availability");
		assert.equal(stepBefore("prior_history"), "goal");
	});

	test("returns undefined before the first step", () => {
		assert.equal(stepBefore("goal"), undefined);
	});
});
