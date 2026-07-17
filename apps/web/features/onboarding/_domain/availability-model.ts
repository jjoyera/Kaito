import type { AvailabilityDraft, WeekDay } from "./step-validation";

export type AvailabilityPresetMinutes = 45 | 60 | 120;

export type AvailabilityBaseMode =
	| { kind: "unset" }
	| { kind: "preset"; minutes: AvailabilityPresetMinutes }
	| { kind: "uniform-custom"; minutes: number }
	| { kind: "mixed" };

export type AvailabilityInteractionState = {
	minutesByDay: Partial<Record<WeekDay, number>>;
	pendingDays: readonly WeekDay[];
	baseMode: AvailabilityBaseMode;
};

export type AvailabilityAction =
	| { type: "toggle-day"; day: WeekDay }
	| { type: "choose-preset"; minutes: AvailabilityPresetMinutes }
	| { type: "set-exact-minutes"; day: WeekDay; minutes: number | undefined };

export type AvailabilityIssue =
	| "exact_value_required"
	| "invalid_day_value"
	| "insufficient_days"
	| "insufficient_weekly_minutes";

export const WEEKDAY_ORDER: readonly WeekDay[] = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
];

export const AVAILABILITY_PRESETS: readonly AvailabilityPresetMinutes[] = [
	45,
	60,
	120,
];

const WEEK_DAYS = new Set<WeekDay>(WEEKDAY_ORDER);

export function hydrateAvailability(
	minutesByDay: Partial<Record<WeekDay, number>>,
): AvailabilityInteractionState {
	const copiedMinutesByDay = { ...minutesByDay };
	return {
		minutesByDay: copiedMinutesByDay,
		pendingDays: [],
		baseMode: deriveBaseMode(copiedMinutesByDay),
	};
}

export function reduceAvailability(
	state: AvailabilityInteractionState,
	action: AvailabilityAction,
): AvailabilityInteractionState {
	switch (action.type) {
		case "toggle-day":
			return toggleDay(state, action.day);
		case "choose-preset":
			return choosePreset(state, action.minutes);
		case "set-exact-minutes":
			return setExactMinutes(state, action.day, action.minutes);
	}
}

export function selectedAvailabilityDays(
	state: AvailabilityInteractionState,
): readonly WeekDay[] {
	return WEEKDAY_ORDER.filter(
		(day) => state.minutesByDay[day] !== undefined || state.pendingDays.includes(day),
	);
}

export function toAvailabilityDraft(
	state: AvailabilityInteractionState,
): AvailabilityDraft {
	return { minutes_by_day: { ...state.minutesByDay } };
}

export function validateAvailabilityInteraction(
	state: AvailabilityInteractionState,
): readonly AvailabilityIssue[] {
	if (state.pendingDays.length > 0) return ["exact_value_required"];

	const entries = Object.entries(state.minutesByDay);
	if (
		entries.some(
			([day, minutes]) =>
				!WEEK_DAYS.has(day as WeekDay) ||
				!isValidExactMinutes(minutes),
		)
	) {
		return ["invalid_day_value"];
	}

	const issues: AvailabilityIssue[] = [];
	if (entries.length < 3) issues.push("insufficient_days");
	const totalMinutes = entries.reduce((total, [, minutes]) => total + minutes, 0);
	if (totalMinutes < 150) issues.push("insufficient_weekly_minutes");
	return issues;
}

function toggleDay(
	state: AvailabilityInteractionState,
	day: WeekDay,
): AvailabilityInteractionState {
	const isSelected =
		state.minutesByDay[day] !== undefined || state.pendingDays.includes(day);
	if (isSelected) {
		const { [day]: _, ...minutesByDay } = state.minutesByDay;
		const pendingDays = state.pendingDays.filter((pendingDay) => pendingDay !== day);
		return createState(minutesByDay, pendingDays, state.baseMode);
	}

	if (state.baseMode.kind === "preset" || state.baseMode.kind === "uniform-custom") {
		return createState(
			{ ...state.minutesByDay, [day]: state.baseMode.minutes },
			state.pendingDays,
			state.baseMode,
		);
	}

	return createState(
		{ ...state.minutesByDay },
		[...state.pendingDays, day],
		state.baseMode,
	);
}

function choosePreset(
	state: AvailabilityInteractionState,
	minutes: AvailabilityPresetMinutes,
): AvailabilityInteractionState {
	const selectedDays = selectedAvailabilityDays(state);
	return {
		minutesByDay: Object.fromEntries(
			selectedDays.map((day) => [day, minutes]),
		) as Partial<Record<WeekDay, number>>,
		pendingDays: [],
		baseMode: { kind: "preset", minutes },
	};
}

function setExactMinutes(
	state: AvailabilityInteractionState,
	day: WeekDay,
	minutes: number | undefined,
): AvailabilityInteractionState {
	if (minutes === undefined) {
		const { [day]: _, ...minutesByDay } = state.minutesByDay;
		const pendingDays = state.pendingDays.includes(day)
			? state.pendingDays
			: [...state.pendingDays, day];
		return createState(minutesByDay, pendingDays, state.baseMode);
	}

	return createState(
		{ ...state.minutesByDay, [day]: minutes },
		state.pendingDays.filter((pendingDay) => pendingDay !== day),
		state.baseMode,
	);
}

function createState(
	minutesByDay: Partial<Record<WeekDay, number>>,
	pendingDays: readonly WeekDay[],
	previousBaseMode: AvailabilityBaseMode,
): AvailabilityInteractionState {
	return {
		minutesByDay,
		pendingDays,
		baseMode: deriveBaseMode(minutesByDay, previousBaseMode),
	};
}

function deriveBaseMode(
	minutesByDay: Partial<Record<WeekDay, number>>,
	fallback: AvailabilityBaseMode = { kind: "unset" },
): AvailabilityBaseMode {
	const values = Object.values(minutesByDay);
	if (values.length === 0) {
		return fallback.kind === "preset" || fallback.kind === "uniform-custom"
			? fallback
			: { kind: "unset" };
	}
	if (values.some((minutes) => !isValidExactMinutes(minutes))) {
		return fallback.kind === "preset" || fallback.kind === "uniform-custom"
			? fallback
			: { kind: "unset" };
	}
	if (values.every((minutes) => minutes === values[0])) {
		const minutes = values[0];
		return AVAILABILITY_PRESETS.includes(minutes as AvailabilityPresetMinutes)
			? { kind: "preset", minutes: minutes as AvailabilityPresetMinutes }
			: { kind: "uniform-custom", minutes };
	}
	return { kind: "mixed" };
}

function isValidExactMinutes(minutes: unknown): minutes is number {
	return Number.isInteger(minutes) && minutes >= 15 && minutes <= 300;
}
