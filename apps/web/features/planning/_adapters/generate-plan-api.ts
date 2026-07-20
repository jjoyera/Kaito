import {
	privateFetch,
	type PrivateFetchDependencies,
} from "../../../shared/adapters/private-fetch";
import {
	parseActiveTrainingPlan,
	type ActiveTrainingPlan,
} from "./active-plan-api";

export type PlanGenerationErrorKind =
	| "missing_context"
	| "cannot_generate"
	| "invalid_generated_plan"
	| "provider_unavailable";

export class PlanGenerationError extends Error {
	constructor(readonly kind: PlanGenerationErrorKind) {
		super(kind);
		this.name = "PlanGenerationError";
	}
}

export async function generateTrainingPlan(
	dependencies: PrivateFetchDependencies,
): Promise<ActiveTrainingPlan> {
	const response = await privateFetch(
		"/planning/generate",
		{ method: "POST" },
		dependencies,
		{ passthroughStatuses: [404, 409, 422, 503] },
	);

	if (response.status === 404) {
		throw new PlanGenerationError("missing_context");
	}
	if (response.status === 409) {
		throw new PlanGenerationError("cannot_generate");
	}
	if (response.status === 422) {
		throw new PlanGenerationError("invalid_generated_plan");
	}
	if (response.status === 503) {
		throw new PlanGenerationError("provider_unavailable");
	}

	try {
		return parseActiveTrainingPlan(await response.json());
	} catch {
		throw new PlanGenerationError("invalid_generated_plan");
	}
}
