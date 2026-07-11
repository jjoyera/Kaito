export const DEFAULT_AUTHENTICATED_DESTINATION = "/onboarding";

const MAX_RETURN_TO_LENGTH = 2_048;
const APP_ORIGIN = "https://kaito.invalid";

export function selectReturnDestination(value: unknown): string {
	if (
		typeof value !== "string" ||
		value.length > MAX_RETURN_TO_LENGTH ||
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\") ||
		containsControlCharacter(value) ||
		containsEncodedSeparator(value)
	) {
		return DEFAULT_AUTHENTICATED_DESTINATION;
	}

	try {
		const destination = new URL(value, APP_ORIGIN);
		if (
			destination.origin !== APP_ORIGIN ||
			destination.pathname.startsWith("//") ||
			isLoginDestination(destination.pathname)
		) {
			return DEFAULT_AUTHENTICATED_DESTINATION;
		}

		return `${destination.pathname}${destination.search}${destination.hash}`;
	} catch {
		return DEFAULT_AUTHENTICATED_DESTINATION;
	}
}

export function getLoginContextMessage(value: unknown): string | undefined {
	if (value === "session_expired") {
		return "Your session expired. Sign in again.";
	}

	if (value === "auth_unavailable") {
		return "Sign-in is temporarily unavailable. Please try again later.";
	}
}

function isLoginDestination(pathname: string): boolean {
	return /^\/login\/?$/u.test(pathname);
}

function containsControlCharacter(value: string): boolean {
	return /[\u0000-\u001F\u007F]/.test(value);
}

function containsEncodedSeparator(value: string): boolean {
	return /%(?:25)?(?:2f|5c)/i.test(value);
}
