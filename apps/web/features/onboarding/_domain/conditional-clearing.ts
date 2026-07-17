import type {
	GoalDraft,
	Modality,
	RestrictionsDraft,
} from "./step-validation";

const HIDDEN_GOAL_FIELDS: Record<Modality, readonly (keyof GoalDraft)[]> = {
	trail: [
		"max_altitude_m",
		"obstacle_count",
		"obstacle_difficulty",
		"target_loops",
	],
	ultra_trail: [
		"max_altitude_m",
		"obstacle_count",
		"obstacle_difficulty",
		"target_loops",
	],
	ocr: [
		"positive_elevation_m",
		"max_altitude_m",
		"target_loops",
	],
	backyard: [
		"target_distance_km",
		"positive_elevation_m",
		"max_altitude_m",
		"obstacle_count",
		"obstacle_difficulty",
	],
};

export function clearHiddenGoalFields(goal: GoalDraft): GoalDraft {
	if (!goal.modality) {
		return goal;
	}

	const cleared: GoalDraft = { ...goal };
	for (const field of HIDDEN_GOAL_FIELDS[goal.modality]) {
		delete cleared[field];
	}
	return cleared;
}

export function clearRestrictionDetail(
	restrictions: RestrictionsDraft,
): RestrictionsDraft {
	if (restrictions.has_restrictions !== false) {
		return restrictions;
	}

	const cleared: RestrictionsDraft = { ...restrictions };
	delete cleared.detail;
	return cleared;
}
