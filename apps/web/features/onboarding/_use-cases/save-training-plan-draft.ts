import * as Sentry from "@sentry/nextjs";
import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import { PrivateApiError } from "../../../shared/adapters/private-fetch";
import {
	saveTrainingPlanDraft as persistTrainingPlanDraft,
	type TrainingPlanDraftResult,
	PlanningResourceError,
} from "../_adapters/training-planning-api";
import type { TrainingApproach } from "../_domain/training-approach-choice";

export type SaveDraftErrorReason =
	| "auth_required"
	| "auth_rejected"
	| "conflict"
	| "onboarding_missing"
	| "onboarding_incomplete"
	| "unsupported"
	| "blocked"
	| "stale"
	| "unavailable";

export type SaveDraftOutcome =
	| { status: "success"; draft: TrainingPlanDraftResult }
	| { status: "error"; reason: SaveDraftErrorReason };

function mapPlanningResourceError(error: PlanningResourceError): SaveDraftErrorReason {
	switch (error.kind) {
		case "onboarding_missing": return "onboarding_missing";
		case "onboarding_incomplete":
		case "onboarding_incomplete_or_conflict": return "onboarding_incomplete";
		case "unsupported": return "unsupported";
		case "blocked": return "blocked";
		case "stale": return "stale";
		default: return "conflict";
	}
}

function mapPrivateApiError(error: PrivateApiError): SaveDraftErrorReason {
	return error.kind === "auth_required" || error.kind === "auth_rejected"
		? error.kind
		: "unavailable";
}

export async function saveTrainingPlanDraft(
	approach: TrainingApproach,
	dependencies: PrivateFetchDependencies,
	captureException: (error: unknown) => unknown = Sentry.captureException,
): Promise<SaveDraftOutcome> {
	try {
		return {
			status: "success",
			draft: await persistTrainingPlanDraft(approach, dependencies),
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
