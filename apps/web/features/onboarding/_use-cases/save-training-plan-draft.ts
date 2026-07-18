import * as Sentry from "@sentry/nextjs";
import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import { PrivateApiError } from "../../../shared/adapters/private-fetch";
import {
	saveTrainingPlanDraft as persistTrainingPlanDraft,
	type TrainingPlanDraftResult,
	PlanningResourceError,
} from "../_adapters/training-planning-api";
import type { TrainingApproach } from "../_domain/training-approach-choice";

export type SaveDraftOutcome =
	| { status: "success"; draft: TrainingPlanDraftResult }
	| {
			status: "error";
			reason: "auth" | "conflict" | "onboarding_missing" | "unsupported" | "unavailable";
	  };

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
			if (error.kind === "onboarding_missing") return { status: "error", reason: "onboarding_missing" };
			if (error.kind === "unsupported") return { status: "error", reason: "unsupported" };
			if (error.kind === "stale") return { status: "error", reason: "unavailable" };
			return { status: "error", reason: "conflict" };
		}
		if (error instanceof PrivateApiError) {
			if (["auth_required", "auth_rejected"].includes(error.kind)) return { status: "error", reason: "auth" };
			return { status: "error", reason: "unavailable" };
		}
		captureException(error);
		return { status: "error", reason: "unavailable" };
	}
}
