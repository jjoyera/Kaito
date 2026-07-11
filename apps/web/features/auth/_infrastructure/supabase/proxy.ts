import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
	normalizeSessionResult,
	type SessionResult,
} from "../../_domain/session-result";
import { getSupabaseConfig } from "./config";

type Cookie = { name: string; value: string; options?: object };
type ProxyCookieStore = {
	getRequestCookies(): Cookie[];
	setRequestCookie(name: string, value: string): void;
	setResponseCookie(name: string, value: string, options?: object): void;
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
			const { data, error } = await client.auth.getUser();
			if (
				error &&
				error.status !== 401 &&
				error.name !== "AuthSessionMissingError"
			) {
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

export async function refreshProxySession(request: NextRequest) {
	const config = getSupabaseConfig();
	if (!config)
		return {
			response: NextResponse.next({ request }),
			session: { status: "unavailable" } as const,
		};
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
	);
	const session = await refresh();
	// Create the continuation only after request cookies are refreshed so Next.js
	// forwards the current cookie header downstream as request overrides.
	const response = NextResponse.next({ request });
	responseCookies.forEach(({ name, value, options }) =>
		response.cookies.set(name, value, options),
	);
	return { response, session };
}
