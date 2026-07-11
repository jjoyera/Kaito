import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import {
	normalizeSessionResult,
	type SessionResult,
} from "../../_domain/session-result";
import { getSupabaseConfig } from "./config";

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
): () => Promise<SessionResult> {
	const readOnlyCookies: CookieAdapter = {
		getAll: () => cookieStore.getAll(),
		setAll: () => {},
	};
	const client = createClient(readOnlyCookies);
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

export async function getServerSupabaseClient() {
	const config = getSupabaseConfig();
	if (!config) return undefined;
	const cookieStore = await cookies();
	return createServerClient(config.url, config.publishableKey, {
		cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
	});
}
