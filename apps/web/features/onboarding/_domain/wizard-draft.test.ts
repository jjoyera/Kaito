import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import type { OnboardingSnapshotDraft } from "./step-validation";
import {
	applyConditionalClearing,
	createBlankWizardDraft,
	firstIncompleteStepIndex,
	normalizeWizardDraft,
	toDiagnosticsByField,
} from "./wizard-draft";

const completeDraft: OnboardingSnapshotDraft = {
	profile: {
		prior_history: {
			longest_completed_distance_km: 42,
			habitual_terrain: "mountain" as const,
			mountain_experience: "medium" as const,
			prior_modality_race_frequency: "once" as const,
		},
		baseline_4_weeks: {
			sessions: 4,
			distance_km: 42,
			positive_elevation_m: 1500,
			longest_outing_km: 20,
			recent_consistency: "fairly_consistent" as const,
		},
		availability: {
			minutes_by_day: { monday: 60, wednesday: 60, saturday: 90 },
		},
		training_preferences: {
			mountain_trail_access: "easy_access",
			gym_access: "yes",
			planning_preference: "fixed_routine",
		},
		physical_status: {
			status: "feeling_good",
		},
	},
	goal: {
		modality: "trail" as const,
		target_date: "2026-10-03",
		target_distance_km: 45,
		positive_elevation_m: 1800,
	},
};

describe("wizard draft normalization", () => {
	test("does not create removed prior-history collection defaults", () => {
		const draft = { profile: {}, goal: {} };

		const normalized = normalizeWizardDraft(draft);

		assert.deepEqual(normalized.profile, {});
		assert.deepEqual(draft, { profile: {}, goal: {} });
	});

	test("creates a fresh normalized blank draft", () => {
		const first = createBlankWizardDraft();
		const second = createBlankWizardDraft();

		assert.deepEqual(first, { profile: {}, goal: {} });
		assert.notEqual(first, second);
	});
});

describe("wizard draft preparation", () => {
	test("trims physical detail at the boundary and omits it when blank", () => {
		const withDetail = applyConditionalClearing({
			profile: {
				physical_status: {
					status: "carrying_fatigue",
					pain_or_limitation_detail: "  Gemelo derecho\n  tras correr  ",
				},
			},
			goal: {},
		});
		assert.deepEqual(withDetail.profile.physical_status, {
			status: "carrying_fatigue",
			pain_or_limitation_detail: "Gemelo derecho\n  tras correr",
		});

		const blankDetail = applyConditionalClearing({
			profile: {
				physical_status: {
					status: "feeling_good",
					pain_or_limitation_detail: " \n ",
				},
			},
			goal: {},
		});
		assert.deepEqual(blankDetail.profile.physical_status, {
			status: "feeling_good",
		});
	});

	test("clears hidden goal values without mutating preferences or the draft", () => {
		const draft = {
			profile: {
				training_preferences: {
					mountain_trail_access: "very_limited" as const,
					gym_access: "home_only" as const,
					planning_preference: "flexible_weekly" as const,
				},
			},
			goal: {
				modality: "trail" as const,
				target_distance_km: 42,
				positive_elevation_m: 1200,
				obstacle_count: 10,
			},
		};

		const cleared = applyConditionalClearing(draft);

		assert.deepEqual(cleared.profile.training_preferences, draft.profile.training_preferences);
		assert.equal(cleared.goal.obstacle_count, undefined);
		assert.equal(draft.goal.obstacle_count, 10);
	});
});

describe("wizard diagnostic navigation", () => {
	test("indexes diagnostics by field and keeps the latest diagnostic", () => {
		const first = {
			code: "required",
			field: "goal.target_date",
			message_key: "required",
			severity: "error",
			metadata: {},
		};
		const latest = { ...first, code: "invalid", message_key: "invalid" };

		assert.deepEqual(toDiagnosticsByField([first, latest]), {
			"goal.target_date": latest,
		});
	});

	test("selects the first locally incomplete executable step", () => {
		const draft = structuredClone(completeDraft);
		delete draft.profile.baseline_4_weeks?.sessions;

		assert.equal(firstIncompleteStepIndex(draft, {}), 2);
	});

	test("selects the first step with a server diagnostic even when locally valid", () => {
		const diagnostic = {
			code: "invalid",
			field: "profile.prior_history.habitual_terrain",
			message_key: "invalid",
			severity: "error",
			metadata: {},
		};

		assert.equal(
			firstIncompleteStepIndex(completeDraft, toDiagnosticsByField([diagnostic])),
			1,
		);
	});

	test("falls back to the final executable step when the draft is complete", () => {
		assert.equal(firstIncompleteStepIndex(completeDraft, {}), 5);
	});
});
