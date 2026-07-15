import {
	saveOnboardingSnapshot,
	type OnboardingApiDependencies,
	type OnboardingApiResult,
} from "../_adapters/onboarding-api";
import type { OnboardingSnapshotDraft } from "../_domain/step-validation";

export type CompleteOnboardingOutcome =
	| { status: "completed"; result: OnboardingApiResult }
	| { status: "demoted"; result: OnboardingApiResult }
	| { status: "error" };

export async function completeOnboarding(
	snapshot: OnboardingSnapshotDraft,
	validationDate: string,
	dependencies: OnboardingApiDependencies,
): Promise<CompleteOnboardingOutcome> {
	try {
		const result = await saveOnboardingSnapshot(
			{
				contract_version: "1",
				state: "completed",
				profile: snapshot.profile,
				goal: snapshot.goal,
			},
			validationDate,
			dependencies,
		);
		if (result.snapshot.state === "completed") {
			return { status: "completed", result };
		}
		return { status: "demoted", result };
	} catch {
		return { status: "error" };
	}
}
