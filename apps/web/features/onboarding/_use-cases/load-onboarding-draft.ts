import {
	fetchOnboardingSnapshot,
	type OnboardingApiDependencies,
	type OnboardingApiResult,
} from "../_adapters/onboarding-api";

export type LoadOnboardingDraftOutcome =
	| { status: "blank" }
	| { status: "loaded"; result: OnboardingApiResult }
	| { status: "error" };

export async function loadOnboardingDraft(
	validationDate: string,
	dependencies: OnboardingApiDependencies,
): Promise<LoadOnboardingDraftOutcome> {
	try {
		const result = await fetchOnboardingSnapshot(validationDate, dependencies);
		if (result === "not_found") {
			return { status: "blank" };
		}
		return { status: "loaded", result };
	} catch {
		return { status: "error" };
	}
}
