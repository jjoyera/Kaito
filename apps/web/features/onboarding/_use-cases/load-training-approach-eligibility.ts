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

type EligibilityLoadErrorReason = Extract<EligibilityLoadOutcome, { status: "error" }>["reason"];

function mapPlanningResourceError(error: PlanningResourceError): EligibilityLoadErrorReason {
	switch (error.kind) {
		case "onboarding_missing": return "onboarding_missing";
		case "onboarding_incomplete_or_conflict":
		case "onboarding_incomplete": return "onboarding_incomplete";
		case "unsupported": return "unsupported";
		default: return "unavailable";
	}
}

function mapPrivateApiError(error: PrivateApiError): EligibilityLoadErrorReason {
	return error.kind === "auth_required" || error.kind === "auth_rejected"
		? "auth"
		: "unavailable";
}

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
			return { status: "error", reason: mapPlanningResourceError(error) };
		}
		if (error instanceof PrivateApiError) {
			return { status: "error", reason: mapPrivateApiError(error) };
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
