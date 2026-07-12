import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { selectReturnDestination } from "./features/auth/_domain/return-destination";
import { refreshProxySession } from "./features/auth/_infrastructure/supabase/proxy";
import { reportSessionFailure } from "./features/auth/_infrastructure/supabase/session-telemetry";

const E2E_SESSION_COOKIE = "kaito-e2e-session";

export async function proxy(request: NextRequest) {
	const session =
		getE2ESession(request) ??
		(await refreshProxySession(request, (event) =>
			reportSessionFailure(Sentry.captureMessage, event),
		));
	const { pathname, search } = request.nextUrl;
	const returnTo = selectReturnDestination(`${pathname}${search}`);

	if (pathname === "/onboarding") {
		if (session.session.status === "authenticated") {
			return session.response;
		}
		return redirectToLogin(
			request,
			returnTo,
			session.session.status,
			session.response,
		);
	}

	if (pathname === "/login" && session.session.status === "authenticated") {
		const loginReturnTo = selectReturnDestination(
			request.nextUrl.searchParams.get("returnTo"),
		);
		return redirectWithSessionCookies(
			new URL(loginReturnTo, request.url),
			session.response,
		);
	}

	return session.response;
}

function redirectToLogin(
	request: NextRequest,
	returnTo: string,
	status: "anonymous" | "invalid" | "unavailable",
	sessionResponse: NextResponse,
) {
	const loginUrl = new URL("/login", request.url);
	loginUrl.searchParams.set("returnTo", returnTo);
	if (status === "invalid")
		loginUrl.searchParams.set("context", "session_expired");
	if (status === "unavailable")
		loginUrl.searchParams.set("context", "auth_unavailable");
	return redirectWithSessionCookies(loginUrl, sessionResponse);
}

export function redirectWithSessionCookies(
	url: URL,
	sessionResponse: NextResponse,
): NextResponse {
	const redirect = NextResponse.redirect(url);
	sessionResponse.cookies
		.getAll()
		.forEach((cookie) => redirect.cookies.set(cookie));
	return redirect;
}

function getE2ESession(request: NextRequest) {
	if (
		process.env.NODE_ENV === "production" ||
		process.env.KAITO_E2E_AUTH_ADAPTER !== "1" ||
		!process.env.KAITO_E2E_AUTH_SECRET ||
		request.headers.get("x-kaito-e2e-auth") !==
			process.env.KAITO_E2E_AUTH_SECRET
	) {
		return undefined;
	}
	const value = request.cookies.get(E2E_SESSION_COOKIE)?.value;
	if (!value) return undefined;
	const status =
		value === "authenticated"
			? "authenticated"
			: value === "anonymous"
				? "anonymous"
				: value === "unavailable"
					? "unavailable"
					: "invalid";
	return {
		response: NextResponse.next({ request }),
		session: { status },
	} as const;
}

export const config = { matcher: ["/login", "/onboarding"] };
