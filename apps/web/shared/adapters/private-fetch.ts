export type PrivateApiErrorKind =
	| "auth_required"
	| "auth_rejected"
	| "auth_unavailable"
	| "request_failed";

export class PrivateApiError extends Error {
	constructor(readonly kind: PrivateApiErrorKind) {
		super(kind);
		this.name = "PrivateApiError";
	}
}

type PrivateFetchDependencies = {
	apiBaseUrl: string;
	getAccessToken(): Promise<string | undefined>;
	fetcher(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export async function privateFetch(
	path: string,
	init: RequestInit,
	{ apiBaseUrl, getAccessToken, fetcher }: PrivateFetchDependencies,
): Promise<Response> {
	let target: URL;
	try {
		const base = new URL(apiBaseUrl);
		target = new URL(path, base);
		if (
			!isRelativeApiPath(path) ||
			target.origin !== base.origin ||
			target.pathname.startsWith("//") ||
			hasAuthorizationHeader(init.headers)
		) {
			throw new Error("unsafe request");
		}
	} catch {
		throw new PrivateApiError("request_failed");
	}

	let token: string | undefined;
	try {
		token = await getAccessToken();
	} catch {
		throw new PrivateApiError("request_failed");
	}
	if (!token) {
		throw new PrivateApiError("auth_required");
	}

	let response: Response;
	try {
		response = await fetcher(target, {
			...init,
			headers: {
				...Object.fromEntries(new Headers(init.headers)),
				authorization: `Bearer ${token}`,
			},
		});
	} catch {
		throw new PrivateApiError("request_failed");
	}
	if (response.status === 401) {
		throw new PrivateApiError("auth_rejected");
	}
	if (response.status === 503) {
		throw new PrivateApiError("auth_unavailable");
	}
	if (!response.ok) {
		throw new PrivateApiError("request_failed");
	}
	return response;
}

function isRelativeApiPath(path: string): boolean {
	return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

function hasAuthorizationHeader(headers: HeadersInit | undefined): boolean {
	return new Headers(headers).has("authorization");
}
