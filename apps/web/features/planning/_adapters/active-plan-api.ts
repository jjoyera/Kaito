import {
	privateFetch,
	type PrivateFetchDependencies,
} from "../../../shared/adapters/private-fetch";

export type ActiveTrainingSession = {
	scheduled_date: string;
	session_type: string;
	planned_duration_minutes: number;
	planned_distance_kilometers: string;
	planned_elevation_meters: number;
	intensity_description: string;
	target_rpe_min: number;
	target_rpe_max: number;
	instructions: string;
	purpose: string;
};

export type ActiveTrainingWeek = {
	week_number: number;
	sessions: ActiveTrainingSession[];
};

export type ActiveTrainingPlan = {
	plan_approach: "kaio_path" | "mode_z" | "kaioken";
	start_date: string;
	end_date: string;
	block_focus: string;
	weeks: ActiveTrainingWeek[];
};

const PLAN_KEYS = [
	"plan_approach",
	"start_date",
	"end_date",
	"block_focus",
	"weeks",
] as const;
const WEEK_KEYS = ["week_number", "sessions"] as const;
const SESSION_KEYS = [
	"scheduled_date",
	"session_type",
	"planned_duration_minutes",
	"planned_distance_kilometers",
	"planned_elevation_meters",
	"intensity_description",
	"target_rpe_min",
	"target_rpe_max",
	"instructions",
	"purpose",
] as const;
const APPROACHES = ["kaio_path", "mode_z", "kaioken"] as const;

export async function fetchActiveTrainingPlan(
	dependencies: PrivateFetchDependencies,
): Promise<ActiveTrainingPlan | "empty"> {
	const response = await privateFetch(
		"/planning/active",
		{ method: "GET" },
		dependencies,
		{ passthroughStatuses: [404] },
	);
	if (response.status === 404) {
		return "empty";
	}

	try {
		return parseActiveTrainingPlan(await response.json());
	} catch {
		throw new Error("invalid_active_plan_response");
	}
}

export function planCalendarDate(now = new Date()): string {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Madrid",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const dateParts = Object.fromEntries(
		parts.map(({ type, value }) => [type, value]),
	);
	return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export function remainingBlockDays(
	today: string,
	startDate: string,
	endDate: string,
): number {
	if (today > endDate) {
		return 0;
	}

	const firstRemainingDate = today < startDate ? startDate : today;
	const remainingMilliseconds =
		Date.parse(`${endDate}T00:00:00Z`) -
		Date.parse(`${firstRemainingDate}T00:00:00Z`);
	return Math.floor(remainingMilliseconds / 86_400_000) + 1;
}

export function parseActiveTrainingPlan(value: unknown): ActiveTrainingPlan {
	if (
		!isExactRecord(value, PLAN_KEYS) ||
		!APPROACHES.includes(value.plan_approach as never) ||
		!isDate(value.start_date) ||
		!isDate(value.end_date) ||
		value.start_date > value.end_date ||
		!isNonEmptyText(value.block_focus) ||
		!Array.isArray(value.weeks) ||
		value.weeks.length < 1 ||
		value.weeks.length > 4 ||
		!value.weeks.every(isValidWeek)
	) {
		throw new Error("invalid_active_plan_response");
	}
	return value as ActiveTrainingPlan;
}

function isValidWeek(value: unknown): boolean {
	return (
		isExactRecord(value, WEEK_KEYS) &&
		isIntegerInRange(value.week_number, 1) &&
		Array.isArray(value.sessions) &&
		value.sessions.length > 0 &&
		value.sessions.every(isValidSession)
	);
}

function isValidSession(value: unknown): boolean {
	return (
		isExactRecord(value, SESSION_KEYS) &&
		isDate(value.scheduled_date) &&
		isNonEmptyText(value.session_type) &&
		isIntegerInRange(value.planned_duration_minutes, 0) &&
		isDecimal(value.planned_distance_kilometers) &&
		isIntegerInRange(value.planned_elevation_meters, 0) &&
		isNonEmptyText(value.intensity_description) &&
		isIntegerInRange(value.target_rpe_min, 1, 10) &&
		isIntegerInRange(value.target_rpe_max, 1, 10) &&
		value.target_rpe_min <= value.target_rpe_max &&
		isNonEmptyText(value.instructions) &&
		isNonEmptyText(value.purpose)
	);
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

function isNonEmptyText(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isIntegerInRange(
	value: unknown,
	min: number,
	max = Number.MAX_SAFE_INTEGER,
): value is number {
	return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isDecimal(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^\d+(?:\.\d+)?$/.test(value) &&
		Number.isFinite(Number(value))
	);
}

function isDate(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const parsed = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}
