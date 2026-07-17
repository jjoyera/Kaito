export type StepId =
	| "goal"
	| "prior_history"
	| "baseline"
	| "availability"
	| "restrictions";

export type StepDefinition = {
	id: StepId;
	fields: readonly string[];
};

export const ONBOARDING_STEPS: readonly StepDefinition[] = [
	{
		id: "goal",
		fields: [
			"goal.modality",
			"goal.target_date",
			"goal.target_distance_km",
			"goal.positive_elevation_m",
			"goal.technicality",
			"goal.max_altitude_m",
			"goal.obstacle_count",
			"goal.obstacle_difficulty",
			"goal.target_loops",
		],
	},
	{
		id: "prior_history",
		fields: [
			"profile.prior_history.training_years",
			"profile.prior_history.completed_race_count_range",
			"profile.prior_history.longest_completed_distance_km",
			"profile.prior_history.practiced_modalities",
			"profile.prior_history.practiced_terrain",
			"profile.prior_history.habitual_terrain",
			"profile.prior_history.mountain_experience",
			"profile.prior_history.prior_modality_race_frequency",
		],
	},
	{
		id: "baseline",
		fields: [
			"profile.baseline_4_weeks.sessions",
			"profile.baseline_4_weeks.distance_km",
			"profile.baseline_4_weeks.positive_elevation_m",
			"profile.baseline_4_weeks.longest_outing_km",
			"profile.baseline_4_weeks.recent_consistency",
		],
	},
	{
		id: "availability",
		fields: ["profile.availability.minutes_by_day"],
	},
	{
		id: "restrictions",
		fields: [
			"profile.restrictions.has_restrictions",
			"profile.restrictions.detail",
		],
	},
] as const;

export function stepIndex(id: StepId): number {
	return ONBOARDING_STEPS.findIndex((step) => step.id === id);
}

export function stepAfter(id: StepId): StepId | undefined {
	return ONBOARDING_STEPS[stepIndex(id) + 1]?.id;
}

export function stepBefore(id: StepId): StepId | undefined {
	return ONBOARDING_STEPS[stepIndex(id) - 1]?.id;
}
