export type SessionResult =
	| { status: "authenticated" }
	| { status: "anonymous" }
	| { status: "invalid" }
	| { status: "unavailable" };

type UserResult = {
	user: { id: string } | null;
	error?: { name?: string; status?: number } | null;
};

export function normalizeSessionResult({
	user,
	error,
}: UserResult): SessionResult {
	if (user) {
		return { status: "authenticated" };
	}

	if (!error || error.name === "AuthSessionMissingError") {
		return { status: "anonymous" };
	}

	if (error.status === 400 || error.status === 401 || error.status === 403) {
		return { status: "invalid" };
	}

	return { status: "unavailable" };
}
