import {
	privateFetch,
	type PrivateFetchDependencies,
} from "../../../shared/adapters/private-fetch";
import type {
	ActivePlanPresence,
	OnboardingProductState,
} from "../_domain/product-route-policy";

export async function fetchOnboardingState(
	validationDate: string,
	dependencies: PrivateFetchDependencies,
): Promise<OnboardingProductState> {
	try {
		const response = await privateFetch(
			`/runner-profile/onboarding?validation_date=${encodeURIComponent(validationDate)}`,
			{ method: "GET", cache: "no-store" },
			dependencies,
			{ passthroughStatuses: [404] },
		);
		if (response.status === 404) {
			return "missing";
		}

		const body: unknown = await response.json();
		if (!isRecord(body) || !isRecord(body.snapshot)) {
			return "unavailable";
		}
		return body.snapshot.state === "completed" || body.snapshot.state === "incomplete"
			? body.snapshot.state
			: "unavailable";
	} catch {
		return "unavailable";
	}
}

export async function fetchActivePlanPresence(
	dependencies: PrivateFetchDependencies,
): Promise<ActivePlanPresence> {
	try {
		const response = await privateFetch(
			"/planning/active",
			{ method: "GET", cache: "no-store" },
			dependencies,
			{ passthroughStatuses: [404] },
		);
		return response.status === 404 ? "none" : "active";
	} catch {
		return "unavailable";
	}
}

export function productRouteValidationDate(now = new Date()): string {
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
