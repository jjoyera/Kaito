import type { OnboardingDiagnostic } from "../_adapters/onboarding-api";
import { clearHiddenGoalFields } from "./conditional-clearing";
import {
	validateStep,
	type OnboardingSnapshotDraft,
} from "./step-validation";
import { ONBOARDING_STEPS } from "./steps";

export type DiagnosticsByField = Partial<
	Record<string, OnboardingDiagnostic>
>;

export function normalizeWizardDraft(
	draft: OnboardingSnapshotDraft,
): OnboardingSnapshotDraft {
	return {
		...draft,
		profile: { ...draft.profile },
		goal: { ...draft.goal },
	};
}

export function createBlankWizardDraft(): OnboardingSnapshotDraft {
	return normalizeWizardDraft({ profile: {}, goal: {} });
}

export function applyConditionalClearing(
	draft: OnboardingSnapshotDraft,
): OnboardingSnapshotDraft {
	return {
		profile: { ...draft.profile },
		goal: clearHiddenGoalFields(draft.goal),
	};
}

export function toDiagnosticsByField(
	diagnostics: readonly OnboardingDiagnostic[],
): DiagnosticsByField {
	const byField: DiagnosticsByField = {};
	for (const diagnostic of diagnostics) {
		byField[diagnostic.field] = diagnostic;
	}
	return byField;
}

export function firstIncompleteStepIndex(
	draft: OnboardingSnapshotDraft,
	diagnostics: DiagnosticsByField,
): number {
	const index = ONBOARDING_STEPS.findIndex(
		(step) =>
			Object.keys(validateStep(step.id, draft)).length > 0 ||
			step.fields.some((field) => diagnostics[field] !== undefined),
	);
	return index === -1 ? ONBOARDING_STEPS.length - 1 : index;
}
