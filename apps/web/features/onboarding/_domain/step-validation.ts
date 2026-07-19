import { hydrateAvailability, validateAvailabilityInteraction } from "./availability-model";
import type { StepId } from "./steps";

export type Modality = "trail" | "ultra_trail" | "ocr" | "backyard";
export type ObstacleDifficulty = "low" | "medium" | "high";
export type HabitualTerrain = "mountain" | "trail" | "road" | "mixed";
export type MountainExperience = "low" | "medium" | "high";
export type PriorModalityRaceFrequency = "never" | "once" | "multiple";
export type RecentConsistency =
	| "irregular"
	| "fairly_consistent"
	| "very_consistent";
export type WeekDay =
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday"
	| "sunday";

export type GoalDraft = {
	modality?: Modality;
	target_date?: string;
	target_distance_km?: number;
	positive_elevation_m?: number;
	max_altitude_m?: number;
	obstacle_count?: number;
	obstacle_difficulty?: ObstacleDifficulty;
	target_loops?: number;
};

export type PriorHistoryDraft = {
	longest_completed_distance_km?: number;
	habitual_terrain?: HabitualTerrain;
	mountain_experience?: MountainExperience;
	prior_modality_race_frequency?: PriorModalityRaceFrequency;
};

export type BaselineDraft = {
	sessions?: number;
	distance_km?: number;
	positive_elevation_m?: number;
	longest_outing_km?: number;
	total_running_minutes?: number;
	longest_outing_duration_minutes?: number;
	longest_outing_positive_elevation_m?: number;
	recent_consistency?: RecentConsistency;
};

export type AvailabilityDraft = {
	minutes_by_day?: Partial<Record<WeekDay, number>>;
};

export type MountainTrailAccess =
	| "easy_access"
	| "weekends_only"
	| "very_limited";
export type GymAccess = "yes" | "home_only";
export type PlanningPreference = "fixed_routine" | "flexible_weekly";
export type PhysicalStatus =
	| "feeling_good"
	| "carrying_fatigue"
	| "recovering";

export type TrainingPreferencesDraft = {
	mountain_trail_access?: MountainTrailAccess;
	gym_access?: GymAccess;
	planning_preference?: PlanningPreference;
};

export type PhysicalStatusDraft = {
	status?: PhysicalStatus;
	has_pain_or_limitation?: boolean;
	pain_or_limitation_affects_running?: boolean;
	pain_or_limitation_detail?: string;
};

export type OnboardingSnapshotDraft = {
	profile: {
		prior_history?: PriorHistoryDraft;
		baseline_4_weeks?: BaselineDraft;
		availability?: AvailabilityDraft;
		training_preferences?: TrainingPreferencesDraft;
		physical_status?: PhysicalStatusDraft;
	};
	goal: GoalDraft;
};

export type FieldErrorCode =
	| "required"
	| "invalid_type"
	| "out_of_range"
	| "invalid_length";

export type FieldErrors = Partial<Record<string, FieldErrorCode>>;

const GOAL_MODALITIES = new Set<Modality>(["trail", "ultra_trail"]);
const HABITUAL_TERRAINS = new Set<HabitualTerrain>([
	"mountain",
	"trail",
	"road",
	"mixed",
]);
const MOUNTAIN_EXPERIENCE = new Set<MountainExperience>([
	"low",
	"medium",
	"high",
]);
const PRIOR_RACE_FREQUENCIES = new Set<PriorModalityRaceFrequency>([
	"never",
	"once",
	"multiple",
]);
const RECENT_CONSISTENCIES = new Set<RecentConsistency>([
	"irregular",
	"fairly_consistent",
	"very_consistent",
]);
const MOUNTAIN_TRAIL_ACCESS = new Set<MountainTrailAccess>([
	"easy_access",
	"weekends_only",
	"very_limited",
]);
const GYM_ACCESS = new Set<GymAccess>(["yes", "home_only"]);
const PLANNING_PREFERENCES = new Set<PlanningPreference>([
	"fixed_routine",
	"flexible_weekly",
]);
const PHYSICAL_STATUSES = new Set<PhysicalStatus>([
	"feeling_good",
	"carrying_fatigue",
	"recovering",
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CONDITIONAL_GOAL_FIELDS: Record<Modality, readonly string[]> = {
	trail: ["goal.target_distance_km", "goal.positive_elevation_m"],
	ultra_trail: ["goal.target_distance_km", "goal.positive_elevation_m"],
	ocr: ["goal.target_distance_km", "goal.obstacle_count"],
	backyard: ["goal.target_loops"],
};

function isNonNegativeNumber(
	value: unknown,
	{ halfStep = false }: { halfStep?: boolean } = {},
): value is number {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		return false;
	}
	return !halfStep || Number.isInteger(value * 2);
}

function isPositiveNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) >= 1;
}

export function validateGoalStep(goal: GoalDraft): FieldErrors {
	const errors: FieldErrors = {};

	if (goal.modality === undefined) {
		errors["goal.modality"] = "required";
	} else if (!GOAL_MODALITIES.has(goal.modality)) {
		errors["goal.modality"] = "invalid_type";
	}

	if (!goal.target_date) {
		errors["goal.target_date"] = "required";
	} else if (!DATE_PATTERN.test(goal.target_date)) {
		errors["goal.target_date"] = "invalid_type";
	}

	const conditionalFields =
		goal.modality && GOAL_MODALITIES.has(goal.modality)
			? CONDITIONAL_GOAL_FIELDS[goal.modality]
			: [];

	for (const field of conditionalFields) {
		applyConditionalGoalCheck(field, goal, errors);
	}

	return errors;
}

function applyConditionalGoalCheck(
	field: string,
	goal: GoalDraft,
	errors: FieldErrors,
): void {
	switch (field) {
		case "goal.target_distance_km":
			if (goal.target_distance_km === undefined) errors[field] = "required";
			else if (!isPositiveNumber(goal.target_distance_km))
				errors[field] = "out_of_range";
			return;
		case "goal.positive_elevation_m":
			if (goal.positive_elevation_m === undefined) errors[field] = "required";
			else if (!isPositiveNumber(goal.positive_elevation_m))
				errors[field] = "out_of_range";
			return;
		case "goal.obstacle_count":
			if (goal.obstacle_count === undefined) errors[field] = "required";
			else if (!isPositiveInteger(goal.obstacle_count))
				errors[field] = "out_of_range";
			return;
		case "goal.target_loops":
			if (goal.target_loops === undefined) errors[field] = "required";
			else if (!isPositiveInteger(goal.target_loops))
				errors[field] = "out_of_range";
			return;
		default:
			return;
	}
}

export function validatePriorHistoryStep(
	priorHistory: PriorHistoryDraft,
): FieldErrors {
	const errors: FieldErrors = {};

	if (priorHistory.longest_completed_distance_km === undefined) {
		errors["profile.prior_history.longest_completed_distance_km"] =
			"required";
	} else if (
		!isNonNegativeNumber(priorHistory.longest_completed_distance_km)
	) {
		errors["profile.prior_history.longest_completed_distance_km"] =
			"out_of_range";
	}

	if (priorHistory.habitual_terrain === undefined) {
		errors["profile.prior_history.habitual_terrain"] = "required";
	} else if (!HABITUAL_TERRAINS.has(priorHistory.habitual_terrain)) {
		errors["profile.prior_history.habitual_terrain"] = "invalid_type";
	}

	if (priorHistory.mountain_experience === undefined) {
		errors["profile.prior_history.mountain_experience"] = "required";
	} else if (!MOUNTAIN_EXPERIENCE.has(priorHistory.mountain_experience)) {
		errors["profile.prior_history.mountain_experience"] = "invalid_type";
	}

	if (priorHistory.prior_modality_race_frequency === undefined) {
		errors["profile.prior_history.prior_modality_race_frequency"] = "required";
	} else if (
		!PRIOR_RACE_FREQUENCIES.has(
			priorHistory.prior_modality_race_frequency,
		)
	) {
		errors["profile.prior_history.prior_modality_race_frequency"] =
			"invalid_type";
	}

	return errors;
}

export function validateBaselineStep(baseline: BaselineDraft): FieldErrors {
	const errors: FieldErrors = {};

	if (baseline.sessions === undefined) {
		errors["profile.baseline_4_weeks.sessions"] = "required";
	} else if (!isNonNegativeInteger(baseline.sessions)) {
		errors["profile.baseline_4_weeks.sessions"] = "out_of_range";
	}

	if (baseline.distance_km === undefined) {
		errors["profile.baseline_4_weeks.distance_km"] = "required";
	} else if (!isNonNegativeNumber(baseline.distance_km)) {
		errors["profile.baseline_4_weeks.distance_km"] = "out_of_range";
	}

	if (baseline.positive_elevation_m === undefined) {
		errors["profile.baseline_4_weeks.positive_elevation_m"] = "required";
	} else if (!isNonNegativeNumber(baseline.positive_elevation_m)) {
		errors["profile.baseline_4_weeks.positive_elevation_m"] = "out_of_range";
	}

	if (baseline.longest_outing_km === undefined) {
		errors["profile.baseline_4_weeks.longest_outing_km"] = "required";
	} else if (!isNonNegativeNumber(baseline.longest_outing_km)) {
		errors["profile.baseline_4_weeks.longest_outing_km"] = "out_of_range";
	}

	const integerFields = [
		["total_running_minutes", baseline.total_running_minutes],
		["longest_outing_duration_minutes", baseline.longest_outing_duration_minutes],
		[
			"longest_outing_positive_elevation_m",
			baseline.longest_outing_positive_elevation_m,
		],
	] as const;
	for (const [field, value] of integerFields) {
		const path = `profile.baseline_4_weeks.${field}`;
		if (value === undefined) errors[path] = "required";
		else if (!isNonNegativeInteger(value)) errors[path] = "out_of_range";
	}

	if (
		isNonNegativeInteger(baseline.longest_outing_duration_minutes) &&
		isNonNegativeInteger(baseline.total_running_minutes) &&
		baseline.longest_outing_duration_minutes > baseline.total_running_minutes
	) {
		errors["profile.baseline_4_weeks.longest_outing_duration_minutes"] =
			"out_of_range";
	}
	if (
		isNonNegativeInteger(baseline.longest_outing_positive_elevation_m) &&
		isNonNegativeNumber(baseline.positive_elevation_m) &&
		baseline.longest_outing_positive_elevation_m > baseline.positive_elevation_m
	) {
		errors["profile.baseline_4_weeks.longest_outing_positive_elevation_m"] =
			"out_of_range";
	}

	if (baseline.recent_consistency === undefined) {
		errors["profile.baseline_4_weeks.recent_consistency"] = "required";
	} else if (!RECENT_CONSISTENCIES.has(baseline.recent_consistency)) {
		errors["profile.baseline_4_weeks.recent_consistency"] = "invalid_type";
	}

	return errors;
}

export function validateAvailabilityStep(
	availability: AvailabilityDraft,
): FieldErrors {
	const minutesByDay = availability.minutes_by_day;
	if (minutesByDay === undefined || Object.keys(minutesByDay).length === 0) {
		return { "profile.availability.minutes_by_day": "required" };
	}

	const issues = validateAvailabilityInteraction(hydrateAvailability(minutesByDay));
	if (issues.length === 0) return {};
	return {
		"profile.availability.minutes_by_day": issues.includes("invalid_day_value")
			? "invalid_type"
			: "out_of_range",
	};
}

export function validatePreferencesStep(
	preferences: TrainingPreferencesDraft,
): FieldErrors {
	const errors: FieldErrors = {};
	const fields = [
		[
			"profile.training_preferences.mountain_trail_access",
			preferences.mountain_trail_access,
			MOUNTAIN_TRAIL_ACCESS,
		],
		[
			"profile.training_preferences.gym_access",
			preferences.gym_access,
			GYM_ACCESS,
		],
		[
			"profile.training_preferences.planning_preference",
			preferences.planning_preference,
			PLANNING_PREFERENCES,
		],
	] as const;

	for (const [field, value, allowed] of fields) {
		if (value === undefined) errors[field] = "required";
		else if (!(allowed as ReadonlySet<string>).has(value)) {
			errors[field] = "invalid_type";
		}
	}
	return errors;
}

export function validatePhysicalStatusStep(
	physicalStatus: PhysicalStatusDraft,
): FieldErrors {
	const errors: FieldErrors = {};
	if (physicalStatus.status === undefined) {
		errors["profile.physical_status.status"] = "required";
	} else if (!PHYSICAL_STATUSES.has(physicalStatus.status)) {
		errors["profile.physical_status.status"] = "invalid_type";
	}

	if (physicalStatus.has_pain_or_limitation === undefined) {
		errors["profile.physical_status.has_pain_or_limitation"] = "required";
	} else if (typeof physicalStatus.has_pain_or_limitation !== "boolean") {
		errors["profile.physical_status.has_pain_or_limitation"] = "invalid_type";
	} else if (
		physicalStatus.has_pain_or_limitation &&
		physicalStatus.pain_or_limitation_affects_running === undefined
	) {
		errors["profile.physical_status.pain_or_limitation_affects_running"] =
			"required";
	} else if (
		physicalStatus.pain_or_limitation_affects_running !== undefined &&
		typeof physicalStatus.pain_or_limitation_affects_running !== "boolean"
	) {
		errors["profile.physical_status.pain_or_limitation_affects_running"] =
			"invalid_type";
	}

	const detail = physicalStatus.pain_or_limitation_detail;
	if (detail !== undefined) {
		if (typeof detail !== "string") {
			errors["profile.physical_status.pain_or_limitation_detail"] =
				"invalid_type";
		} else if (detail.trim().length > 500) {
			errors["profile.physical_status.pain_or_limitation_detail"] =
				"invalid_length";
		}
	}
	return errors;
}

export function validateStep(
	stepId: StepId,
	snapshot: OnboardingSnapshotDraft,
): FieldErrors {
	switch (stepId) {
		case "goal":
			return validateGoalStep(snapshot.goal);
		case "prior_history":
			return validatePriorHistoryStep(snapshot.profile.prior_history ?? {});
		case "baseline":
			return validateBaselineStep(snapshot.profile.baseline_4_weeks ?? {});
		case "availability":
			return validateAvailabilityStep(snapshot.profile.availability ?? {});
		case "preferences":
			return validatePreferencesStep(snapshot.profile.training_preferences ?? {});
		case "physical_status":
			return validatePhysicalStatusStep(snapshot.profile.physical_status ?? {});
	}
}
