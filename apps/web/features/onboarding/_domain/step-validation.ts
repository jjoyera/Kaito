import type { StepId } from "./steps";

export type Modality = "trail" | "ultra_trail" | "ocr" | "backyard";
export type Technicality = "low" | "medium" | "high";
export type RaceCountRange =
	| "none"
	| "one_to_three"
	| "four_to_ten"
	| "eleven_to_twenty_five"
	| "twenty_six_plus";
export type PracticedTerrain = "road" | "trail" | "mountain" | "mixed";
export type HabitualTerrain = "mountain" | "trail" | "road" | "mixed";
export type MountainExperience = "low" | "medium" | "high";
export type PriorModalityRaceFrequency = "never" | "once" | "multiple";
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
	technicality?: Technicality;
	max_altitude_m?: number;
	obstacle_count?: number;
	obstacle_difficulty?: Technicality;
	target_loops?: number;
};

export type PriorHistoryDraft = {
	training_years?: number;
	completed_race_count_range?: RaceCountRange;
	longest_completed_distance_km?: number;
	practiced_modalities?: Modality[];
	practiced_terrain?: PracticedTerrain[];
	habitual_terrain?: HabitualTerrain;
	mountain_experience?: MountainExperience;
	prior_modality_race_frequency?: PriorModalityRaceFrequency;
};

export type BaselineDraft = {
	sessions?: number;
	training_hours?: number;
	distance_km?: number;
	positive_elevation_m?: number;
	longest_outing_km?: number;
};

export type AvailabilityDraft = {
	minutes_by_day?: Partial<Record<WeekDay, number>>;
};

export type RestrictionsDraft = {
	has_restrictions?: boolean;
	detail?: string;
};

export type OnboardingSnapshotDraft = {
	profile: {
		prior_history?: PriorHistoryDraft;
		baseline_4_weeks?: BaselineDraft;
		availability?: AvailabilityDraft;
		restrictions?: RestrictionsDraft;
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
const WEEK_DAYS = new Set<WeekDay>([
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
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

	if (baseline.training_hours === undefined) {
		errors["profile.baseline_4_weeks.training_hours"] = "required";
	} else if (
		!isNonNegativeNumber(baseline.training_hours, { halfStep: true })
	) {
		errors["profile.baseline_4_weeks.training_hours"] = "out_of_range";
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

	return errors;
}

export function validateAvailabilityStep(
	availability: AvailabilityDraft,
): FieldErrors {
	const errors: FieldErrors = {};
	const minutesByDay = availability.minutes_by_day;

	if (minutesByDay === undefined || Object.keys(minutesByDay).length === 0) {
		errors["profile.availability.minutes_by_day"] = "required";
		return errors;
	}

	const entries = Object.entries(minutesByDay) as Array<
		[string, number | null | undefined]
	>;
	const hasInvalidEntry = entries.some(
		([day, minutes]) =>
			!WEEK_DAYS.has(day as WeekDay) ||
			minutes === null ||
			minutes === undefined ||
			!Number.isInteger(minutes) ||
			minutes < 15 ||
			minutes > 300,
	);
	if (hasInvalidEntry) {
		errors["profile.availability.minutes_by_day"] = "invalid_type";
		return errors;
	}

	const presentDays = entries.length;
	const totalMinutes = entries.reduce(
		(sum, [, minutes]) => sum + (minutes ?? 0),
		0,
	);
	if (presentDays < 3 || totalMinutes < 150) {
		errors["profile.availability.minutes_by_day"] = "out_of_range";
	}

	return errors;
}

export function validateRestrictionsStep(
	restrictions: RestrictionsDraft,
): FieldErrors {
	const errors: FieldErrors = {};

	if (restrictions.has_restrictions === undefined) {
		errors["profile.restrictions.has_restrictions"] = "required";
		return errors;
	}
	if (typeof restrictions.has_restrictions !== "boolean") {
		errors["profile.restrictions.has_restrictions"] = "invalid_type";
		return errors;
	}

	if (!restrictions.has_restrictions) {
		return errors;
	}

	const detail = restrictions.detail?.trim() ?? "";
	if (detail.length === 0) {
		errors["profile.restrictions.detail"] = "required";
	} else if (detail.length > 500) {
		errors["profile.restrictions.detail"] = "invalid_length";
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
		case "restrictions":
			return validateRestrictionsStep(snapshot.profile.restrictions ?? {});
	}
}
