import { strict as assert } from "node:assert";
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
	test("maps retained prior-history diagnostics", () => {
		assert.deepEqual(
			mapDiagnosticFieldsToSteps([
				"profile.prior_history.habitual_terrain",
				"profile.prior_history.mountain_experience",
			]),
			["prior_history"],
		);
	});

	test("rejects removed field diagnostics", () => {
		assert.throws(() => stepForField("profile.prior_history.legacy_metric"));
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
