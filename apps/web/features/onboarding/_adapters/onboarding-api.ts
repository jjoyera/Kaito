import {
	privateFetch,
	type PrivateFetchDependencies,
} from "../../../shared/adapters/private-fetch";

export type OnboardingApiDependencies = PrivateFetchDependencies;

export type OnboardingDiagnostic = {
	code: string;
	field: string;
	message_key: string;
	severity: string;
	metadata: Record<string, unknown>;
};

export type OnboardingSnapshotPayload = {
	contract_version: string;
	state: "incomplete" | "completed";
	profile: Record<string, unknown>;
	goal: Record<string, unknown>;
};

export type OnboardingApiResult = {
	snapshot: OnboardingSnapshotPayload;
	diagnostics: OnboardingDiagnostic[];
};

const ONBOARDING_PATH = "/runner-profile/onboarding";

export async function fetchOnboardingSnapshot(
	validationDate: string,
	dependencies: OnboardingApiDependencies,
): Promise<OnboardingApiResult | "not_found"> {
	const response = await privateFetch(
		`${ONBOARDING_PATH}?validation_date=${encodeURIComponent(validationDate)}`,
		{ method: "GET" },
		dependencies,
		{ passthroughStatuses: [404] },
	);
	if (response.status === 404) {
		return "not_found";
	}
	return (await response.json()) as OnboardingApiResult;
}

export async function saveOnboardingSnapshot(
	snapshot: OnboardingSnapshotPayload,
	validationDate: string,
	dependencies: OnboardingApiDependencies,
): Promise<OnboardingApiResult> {
	const response = await privateFetch(
		ONBOARDING_PATH,
		{
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ snapshot, validation_date: validationDate }),
		},
		dependencies,
	);
	return (await response.json()) as OnboardingApiResult;
}
