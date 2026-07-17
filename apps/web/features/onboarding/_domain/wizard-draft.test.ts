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
			training_hours: 6,
			distance_km: 42,
			positive_elevation_m: 1500,
			longest_outing_km: 20,
		},
		availability: {
			minutes_by_day: { monday: 60, wednesday: 60, saturday: 90 },
		},
		restrictions: { has_restrictions: false },
	},
	goal: {
		modality: "trail" as const,
		target_date: "2026-10-03",
		target_distance_km: 45,
		positive_elevation_m: 1800,
	},
};

describe("wizard draft normalization", () => {
	test("adds the collection defaults expected by the prior-history form", () => {
		const draft = { profile: {}, goal: {} };

		const normalized = normalizeWizardDraft(draft);

		assert.deepEqual(normalized.profile.prior_history, {
			practiced_modalities: [],
			practiced_terrain: [],
		});
		assert.deepEqual(draft, { profile: {}, goal: {} });
	});

	test("creates a fresh normalized blank draft", () => {
		const first = createBlankWizardDraft();
		const second = createBlankWizardDraft();

		assert.deepEqual(first, {
			profile: {
				prior_history: { practiced_modalities: [], practiced_terrain: [] },
			},
			goal: {},
		});
		assert.notEqual(first, second);
		assert.notEqual(first.profile.prior_history, second.profile.prior_history);
	});
});

describe("wizard draft preparation", () => {
	test("clears hidden goal and restriction values without mutating the draft", () => {
		const draft = {
			profile: {
				restrictions: {
					has_restrictions: false as const,
					detail: "Do not persist",
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

		assert.equal(cleared.profile.restrictions?.detail, undefined);
		assert.equal(cleared.goal.obstacle_count, undefined);
		assert.equal(draft.profile.restrictions.detail, "Do not persist");
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
			field: "profile.prior_history.training_years",
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
		assert.equal(firstIncompleteStepIndex(completeDraft, {}), 4);
	});
});
