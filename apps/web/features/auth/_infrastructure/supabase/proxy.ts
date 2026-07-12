import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
	isExpectedInvalidSessionError,
	normalizeSessionResult,
	type SessionResult,
} from "../../_domain/session-result";
import { getSupabaseConfig } from "./config";
import {
	SESSION_RESOLUTION_TIMEOUT_MS,
	withSessionTimeout,
} from "./session-telemetry";

type Cookie = {
	name: string;
	value: string;
	options?: Record<string, unknown>;
};
type ProxyCookieStore = {
	getRequestCookies(): Cookie[];
	setRequestCookie(name: string, value: string): void;
	setResponseCookie(
		name: string,
		value: string,
		options?: Record<string, unknown>,
	): void;
};
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

export function createProxySessionRefresher(
	cookieStore: ProxyCookieStore,
	createClient: (cookies: CookieAdapter) => SessionClient,
	reportFailure: SessionFailureReporter = () => {},
	timeoutMs = SESSION_RESOLUTION_TIMEOUT_MS,
): () => Promise<SessionResult> {
	const client = createClient({
		getAll: () => cookieStore.getRequestCookies(),
		setAll: (cookiesToSet) => {
			cookiesToSet.forEach(({ name, value, options }) => {
				cookieStore.setRequestCookie(name, value);
				cookieStore.setResponseCookie(name, value, options);
			});
		},
	});
	return async () => {
		try {
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

export async function refreshProxySession(
	request: NextRequest,
	reportFailure: SessionFailureReporter = () => {},
) {
	const config = getSupabaseConfig();
	if (!config) {
		reportSafely(reportFailure);
		return {
			response: NextResponse.next({ request }),
			session: { status: "unavailable" } as const,
		};
	}
	const responseCookies: Cookie[] = [];

	const refresh = createProxySessionRefresher(
		{
			getRequestCookies: () => request.cookies.getAll(),
			setRequestCookie: (name, value) => request.cookies.set(name, value),
			setResponseCookie: (name, value, options) =>
				responseCookies.push({ name, value, options }),
		},
		(cookieAdapter) =>
			createServerClient(config.url, config.publishableKey, {
				cookies: cookieAdapter,
			}),
		reportFailure,
	);
	const session = await refresh();
	// Create the continuation only after request cookies are refreshed so Next.js
	// forwards the current cookie header downstream as request overrides.
	const response = NextResponse.next({ request });
	responseCookies.forEach(({ name, value, options }) =>
		response.cookies.set(name, value, enforceSecureCookieOptions(options)),
	);
	return { response, session };
}

export function enforceSecureCookieOptions(
	options: Record<string, unknown> = {},
	environment = process.env.NODE_ENV,
): Record<string, unknown> {
	return environment === "production" ? { ...options, secure: true } : options;
}
