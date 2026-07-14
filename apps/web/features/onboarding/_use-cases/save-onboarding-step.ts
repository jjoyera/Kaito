import {
	saveOnboardingSnapshot,
	type OnboardingApiDependencies,
	type OnboardingApiResult,
} from "../_adapters/onboarding-api";
import type { OnboardingSnapshotDraft } from "../_domain/step-validation";

export type SaveOnboardingStepOutcome =
	| { status: "saved"; result: OnboardingApiResult }
	| { status: "error" };

export async function saveOnboardingStep(
	snapshot: OnboardingSnapshotDraft,
	validationDate: string,
	dependencies: OnboardingApiDependencies,
): Promise<SaveOnboardingStepOutcome> {
	try {
		const result = await saveOnboardingSnapshot(
			{
				contract_version: "1",
				state: "incomplete",
				profile: snapshot.profile,
				goal: snapshot.goal,
			},
			validationDate,
			dependencies,
		);
		return { status: "saved", result };
	} catch {
		return { status: "error" };
	}
}
