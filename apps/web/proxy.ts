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
		!isLoopbackRequest(request) ||
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

export function isLoopbackRequest(request: NextRequest): boolean {
	const hosts = [
		request.nextUrl.hostname,
		request.headers.get("host"),
		...(request.headers.get("x-forwarded-host")?.split(",") ?? []),
	]
		.filter((host): host is string => Boolean(host))
		.map((host) => hostnameFromHeader(host));

	return hosts.length > 0 && hosts.every(isLoopbackHostname);
}

function hostnameFromHeader(host: string): string {
	const value = host.trim().toLowerCase();
	if (value.startsWith("[")) {
		const closingBracket = value.indexOf("]");
		if (closingBracket < 0) return "";
		const suffix = value.slice(closingBracket + 1);
		if (suffix && !/^:\d{1,5}$/.test(suffix)) return "";
		if (suffix && Number(suffix.slice(1)) > 65535) return "";
		return value.slice(1, closingBracket);
	}
	return value.split(":", 1)[0];
}

function isLoopbackHostname(hostname: string): boolean {
	if (hostname === "localhost" || hostname === "::1") return true;

	const octets = hostname.split(".");
	return (
		octets.length === 4 &&
		octets[0] === "127" &&
		octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
	);
}

export const config = { matcher: ["/login", "/onboarding"] };
