import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mapDiagnosticFieldsToSteps, stepForField } from "./diagnostic-mapping";
import { ONBOARDING_STEPS } from "./steps";

describe("stepForField", () => {
	test("resolves every field in the contract's field catalog to exactly one step", () => {
		for (const step of ONBOARDING_STEPS) {
			for (const field of step.fields) {
				assert.equal(
					stepForField(field),
					step.id,
					`expected ${field} to resolve to step ${step.id}`,
				);
			}
		}
	});

	test("throws rather than silently falling back for an unmapped field", () => {
		assert.throws(() => stepForField("goal.plan_approach"));
	});
});

describe("mapDiagnosticFieldsToSteps", () => {
	test("maps a single-step batch of diagnostics", () => {
		assert.deepEqual(
			mapDiagnosticFieldsToSteps([
				"profile.prior_history.training_years",
				"profile.prior_history.completed_race_count_range",
			]),
			["prior_history"],
		);
	});

	test("de-duplicates and orders steps by the fixed wizard order", () => {
		assert.deepEqual(
			mapDiagnosticFieldsToSteps([
				"profile.restrictions.detail",
				"goal.target_date",
				"goal.modality",
				"profile.availability.minutes_by_day",
			]),
			["goal", "availability", "restrictions"],
		);
	});

	test("throws when any diagnostic field is unmapped", () => {
		assert.throws(() =>
			mapDiagnosticFieldsToSteps(["goal.target_date", "goal.plan_approach"]),
		);
	});
});
