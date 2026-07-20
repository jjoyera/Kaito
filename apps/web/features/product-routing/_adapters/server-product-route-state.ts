import { cookies, headers } from "next/headers";

import { getServerSupabaseClient } from "../../auth/_infrastructure/supabase/server";
import {
	fetchActivePlanPresence,
	fetchOnboardingState,
	productRouteValidationDate,
} from "./product-route-api";
import type {
	OnboardingProductState,
	ProductRoute,
	ProductRouteDecision,
} from "../_domain/product-route-policy";
import { resolveProductRoute } from "../_use-cases/resolve-product-route";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

type E2EProductState =
	| "completed"
	| "incomplete-active"
	| "incomplete-none"
	| "missing-active"
	| "missing-none"
	| "unavailable";

export async function getServerProductRouteDecision(
	route: ProductRoute,
	options: { activePlanHandoff?: boolean } = {},
): Promise<ProductRouteDecision> {
	const requestHeaders = await headers();
	const cookieStore = await cookies();
	const effectiveOptions = {
		activePlanHandoff:
			options.activePlanHandoff === true &&
			isSameOriginOnboardingReferer(
				requestHeaders.get("referer"),
				requestHeaders.get("host"),
				requestHeaders.get("x-forwarded-proto"),
			),
	};
	const e2eDecision = await resolveE2EProductRoute(
		route,
		effectiveOptions,
		requestHeaders.get("host"),
		requestHeaders.get("x-kaito-e2e-auth"),
		cookieStore.get("kaito-e2e-product-state")?.value,
	);
	if (e2eDecision) {
		return e2eDecision;
	}

	const token = await getValidatedServerAccessToken();
	const dependencies = {
		apiBaseUrl: (process.env.NEXT_PUBLIC_KAITO_API_URL ?? "").trim(),
		getAccessToken: async () => token,
		fetcher: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
	};
	return resolveProductRoute(
		route,
		{
			loadOnboarding: () =>
				fetchOnboardingState(productRouteValidationDate(), dependencies),
			loadActivePlan: () => fetchActivePlanPresence(dependencies),
		},
		effectiveOptions,
	);
}

export function isSameOriginOnboardingReferer(
	referer: string | null,
	host: string | null,
	forwardedProtocol: string | null,
): boolean {
	if (
		!referer ||
		!host ||
		(forwardedProtocol !== "http" && forwardedProtocol !== "https")
	) {
		return false;
	}
	try {
		const requestOrigin = new URL(`${forwardedProtocol}://${host}`);
		const refererUrl = new URL(referer);
		return (
			requestOrigin.host === host &&
			!requestOrigin.username &&
			!requestOrigin.password &&
			!refererUrl.username &&
			!refererUrl.password &&
			refererUrl.origin === requestOrigin.origin &&
			refererUrl.pathname === "/onboarding"
		);
	} catch {
		return false;
	}
}

async function getValidatedServerAccessToken(): Promise<string | undefined> {
	try {
		const client = await getServerSupabaseClient();
		if (!client) return undefined;
		const { data, error } = await client.auth.getSession();
		if (error) return undefined;
		return data.session?.access_token;
	} catch {
		return undefined;
	}
}

async function resolveE2EProductRoute(
	route: ProductRoute,
	options: { activePlanHandoff?: boolean },
	host: string | null,
	providedSecret: string | null,
	stateValue: string | undefined,
): Promise<ProductRouteDecision | undefined> {
	if (!isE2EProductRouteAdapterAllowed(host, providedSecret)) {
		return undefined;
	}
	const state = parseE2EProductState(stateValue) ?? "incomplete-none";
	const onboarding: OnboardingProductState =
		state === "completed" || state === "unavailable"
			? state
			: state.startsWith("incomplete")
				? "incomplete"
				: "missing";
	return resolveProductRoute(
		route,
		{
			loadOnboarding: async () => onboarding,
			loadActivePlan: async () =>
				state.endsWith("active") ? "active" : "none",
		},
		options,
	);
}

export function isE2EProductRouteAdapterAllowed(
	host: string | null,
	providedSecret: string | null,
	environment = process.env.NODE_ENV,
	adapterEnabled = process.env.KAITO_E2E_AUTH_ADAPTER,
	expectedSecret = process.env.KAITO_E2E_AUTH_SECRET,
): boolean {
	const hostname = host?.startsWith("[")
		? host.slice(1, host.indexOf("]"))
		: host?.split(":")[0];
	return (
		environment !== "production" &&
		adapterEnabled === "1" &&
		Boolean(expectedSecret) &&
		providedSecret === expectedSecret &&
		hostname !== undefined &&
		LOOPBACK_HOSTNAMES.has(hostname)
	);
}

function parseE2EProductState(value: string | undefined): E2EProductState | undefined {
	return value === "completed" ||
		value === "incomplete-active" ||
		value === "incomplete-none" ||
		value === "missing-active" ||
		value === "missing-none" ||
		value === "unavailable"
		? value
		: undefined;
}
