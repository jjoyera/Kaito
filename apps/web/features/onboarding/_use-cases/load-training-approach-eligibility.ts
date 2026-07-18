import * as Sentry from "@sentry/nextjs";
import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import { PrivateApiError } from "../../../shared/adapters/private-fetch";
import {
	fetchTrainingApproachEligibility,
	PlanningResourceError,
} from "../_adapters/training-planning-api";
import {
	formatUtcCalendarDate,
	type TrainingApproachAssessment,
} from "../_domain/training-approach-choice";

export type EligibilityLoadOutcome =
	| { status: "success"; assessment: TrainingApproachAssessment }
	| {
			status: "error";
			reason: "auth" | "onboarding_missing" | "onboarding_incomplete" | "unsupported" | "unavailable";
	  };

export async function loadTrainingApproachEligibility(
	assessmentDate: string,
	dependencies: PrivateFetchDependencies,
	captureException: (error: unknown) => unknown = Sentry.captureException,
): Promise<EligibilityLoadOutcome> {
	try {
		return {
			status: "success",
			assessment: await fetchTrainingApproachEligibility(assessmentDate, dependencies),
		};
	} catch (error) {
		if (error instanceof PlanningResourceError) {
			if (error.kind === "onboarding_missing") return { status: "error", reason: "onboarding_missing" };
			if (error.kind === "onboarding_incomplete_or_conflict") return { status: "error", reason: "onboarding_incomplete" };
			return { status: "error", reason: error.kind === "unsupported" ? "unsupported" : "unavailable" };
		}
		if (error instanceof PrivateApiError) {
			if (["auth_required", "auth_rejected"].includes(error.kind)) return { status: "error", reason: "auth" };
			return { status: "error", reason: "unavailable" };
		}
		captureException(error);
		return { status: "error", reason: "unavailable" };
	}
}

export function loadCurrentTrainingApproachEligibility(
	dependencies: PrivateFetchDependencies,
	now: () => Date = () => new Date(),
): Promise<EligibilityLoadOutcome> {
	return loadTrainingApproachEligibility(formatUtcCalendarDate(now()), dependencies);
}
