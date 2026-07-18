import { privateFetch, type PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import type {
	TrainingApproach,
	TrainingApproachAssessment,
} from "../_domain/training-approach-choice";

export type PlanningResourceErrorKind =
	| "onboarding_missing"
	| "onboarding_incomplete_or_conflict"
	| "onboarding_incomplete"
	| "blocked"
	| "draft_conflict"
	| "unsupported"
	| "stale";

export class PlanningResourceError extends Error {
	constructor(readonly kind: PlanningResourceErrorKind) {
		super(kind);
		this.name = "PlanningResourceError";
	}
}

const APPROACHES = ["kaio_path", "mode_z", "kaioken"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TrainingPlanDraftResult = {
	plan_id: string;
	status: "draft";
	plan_approach: TrainingApproach;
};

export async function fetchTrainingApproachEligibility(
	assessmentDate: string,
	dependencies: PrivateFetchDependencies,
): Promise<TrainingApproachAssessment> {
	const response = await privateFetch(
		`/planning/training-approach-eligibility?assessment_date=${encodeURIComponent(assessmentDate)}`,
		{ method: "GET" },
		dependencies,
		{ passthroughStatuses: [404, 409, 422] },
	);
	if (response.status === 404) throw new PlanningResourceError("onboarding_missing");
	if (response.status === 409) throw new PlanningResourceError("onboarding_incomplete_or_conflict");
	if (response.status === 422) throw new PlanningResourceError(await classifyUnprocessable(response));
	return parseEligibilityResponse(await response.json());
}

export async function saveTrainingPlanDraft(
	planApproach: TrainingApproach,
	dependencies: PrivateFetchDependencies,
): Promise<TrainingPlanDraftResult> {
	const response = await privateFetch(
		"/planning/training-plan-draft",
		{
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ plan_approach: planApproach }),
		},
		dependencies,
		{ passthroughStatuses: [404, 409, 422] },
	);
	if (response.status === 404) throw new PlanningResourceError("onboarding_missing");
	if (response.status === 409) throw new PlanningResourceError(await classifyDraftConflict(response));
	if (response.status === 422) throw new PlanningResourceError(await classifyUnprocessable(response));
	return parseDraftResponse(await response.json());
}

async function classifyDraftConflict(
	response: Response,
): Promise<"onboarding_incomplete" | "blocked" | "draft_conflict"> {
	try {
		const body = await response.json() as { detail?: unknown };
		if (body.detail === "Onboarding is incomplete") return "onboarding_incomplete";
		if (body.detail === "blocked_approach") return "blocked";
		return "draft_conflict";
	} catch {
		return "draft_conflict";
	}
}

async function classifyUnprocessable(response: Response): Promise<"unsupported" | "stale"> {
	try {
		const body = await response.json() as { detail?: unknown };
		return body.detail === "unsupported_modality" ? "unsupported" : "stale";
	} catch {
		return "stale";
	}
}

function parseEligibilityResponse(value: unknown): TrainingApproachAssessment {
	if (
		!isExactRecord(value, ["recommended_approach", "approaches", "safety_restriction_codes"]) ||
		(value.recommended_approach !== "kaio_path" && value.recommended_approach !== "mode_z") ||
		!Array.isArray(value.approaches) ||
		value.approaches.length !== APPROACHES.length ||
		!value.approaches.every((item, index) =>
			isExactRecord(item, ["approach", "available", "blocking_reason_codes"]) &&
			item.approach === APPROACHES[index] &&
			typeof item.available === "boolean" &&
			isStringArray(item.blocking_reason_codes),
		) ||
		!isStringArray(value.safety_restriction_codes)
	) {
		throw new Error("invalid_planning_response");
	}
	return value as TrainingApproachAssessment;
}

function parseDraftResponse(value: unknown): TrainingPlanDraftResult {
	if (
		!isExactRecord(value, ["plan_id", "status", "plan_approach"]) ||
		typeof value.plan_id !== "string" ||
		!UUID_PATTERN.test(value.plan_id) ||
		value.status !== "draft" ||
		!APPROACHES.includes(value.plan_approach as TrainingApproach)
	) {
		throw new Error("invalid_planning_response");
	}
	return value as TrainingPlanDraftResult;
}

function isExactRecord(
	value: unknown,
	keys: readonly string[],
): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === keys.length &&
		keys.every((key) => Object.hasOwn(value, key))
	);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}
