import { createServerClient } from "@supabase/ssr";
import * as Sentry from "@sentry/nextjs";
import { cookies, headers } from "next/headers";

import {
	isExpectedInvalidSessionError,
	normalizeSessionResult,
	type SessionResult,
} from "../../_domain/session-result";
import { getSupabaseConfig } from "./config";
import {
	reportSessionFailure,
	SESSION_RESOLUTION_TIMEOUT_MS,
	withSessionTimeout,
} from "./session-telemetry";

type Cookie = { name: string; value: string; options?: object };
type CookieAdapter = { getAll(): Cookie[]; setAll(cookies: Cookie[]): void };
type SessionFailureReporter = (event: "supabase_get_user_failed") => void;
type SessionClient = {
	auth: {
		getUser(): Promise<{
			data: { user: { id: string } | null };
			error: { name?: string; status?: number } | null;
		}>;
	};
};

export function createServerSessionResolver(
	cookieStore: CookieAdapter,
	createClient: (cookies: CookieAdapter) => SessionClient,
	reportFailure: SessionFailureReporter = () => {},
	timeoutMs = SESSION_RESOLUTION_TIMEOUT_MS,
): () => Promise<SessionResult> {
	return async () => {
		try {
			const client = createClient({
				getAll: () => cookieStore.getAll(),
				setAll: () => {},
			});
			const { data, error } = await withSessionTimeout(
				client.auth.getUser(),
				timeoutMs,
			);
			if (error && !isExpectedInvalidSessionError(error)) {
				reportSafely(reportFailure);
			}
			return normalizeSessionResult({ user: data.user, error });
		} catch {
			reportSafely(reportFailure);
			return { status: "unavailable" };
		}
	};
}

function reportSafely(reportFailure: SessionFailureReporter): void {
	try {
		reportFailure("supabase_get_user_failed");
	} catch {
		// Reporting is best-effort and must not change session normalization.
	}
}

export async function getServerSessionResult(
	reportFailure: SessionFailureReporter = (event) =>
		reportSessionFailure(Sentry.captureMessage, event),
): Promise<SessionResult> {
	const cookieStore = await cookies();
	const requestHeaders = await headers();
	const e2eSession = getE2ESession(
		cookieStore.get("kaito-e2e-session")?.value,
		requestHeaders.get("x-kaito-e2e-auth"),
	);
	if (e2eSession) {
		if (cookieStore.get("kaito-e2e-delay-session")?.value === "1") {
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		return e2eSession;
	}

	const config = getSupabaseConfig();
	if (!config) {
		reportSafely(reportFailure);
		return { status: "unavailable" };
	}
	const resolve = createServerSessionResolver(
		{ getAll: () => cookieStore.getAll(), setAll: () => {} },
		(cookieAdapter) =>
			createServerClient(config.url, config.publishableKey, {
				cookies: cookieAdapter,
			}),
		reportFailure,
	);
	return resolve();
}

export async function getServerSupabaseClient() {
	const config = getSupabaseConfig();
	if (!config) return undefined;
	const cookieStore = await cookies();
	return createServerClient(config.url, config.publishableKey, {
		cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
	});
}

function getE2ESession(
	value: string | undefined,
	secret: string | null,
): SessionResult | undefined {
	if (!isE2EAuthAdapterAllowed(secret) || !value) {
		return undefined;
	}
	return {
		status:
			value === "authenticated"
				? "authenticated"
				: value === "anonymous"
					? "anonymous"
					: value === "unavailable"
						? "unavailable"
						: "invalid",
	};
}

export function isE2EAuthAdapterAllowed(
	providedSecret: string | null,
	environment = process.env.NODE_ENV,
	adapterEnabled = process.env.KAITO_E2E_AUTH_ADAPTER,
	expectedSecret = process.env.KAITO_E2E_AUTH_SECRET,
): boolean {
	return (
		environment !== "production" &&
		adapterEnabled === "1" &&
		Boolean(expectedSecret) &&
		providedSecret === expectedSecret
	);
}
