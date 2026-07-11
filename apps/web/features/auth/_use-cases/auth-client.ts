export type SignInInput = {
	email: string;
	password: string;
};

export type SignInOutcome =
	| { status: "success" }
	| { status: "invalid_credentials" }
	| { status: "system_error" };

export type SignInWithPassword = (input: SignInInput) => Promise<SignInOutcome>;

export type ProviderSignInError = {
	code?: string;
	status?: number;
	message?: string;
	cause?: unknown;
};

export type ProviderSignInResult =
	| { ok: true }
	| {
			ok: false;
			error?: ProviderSignInError;
	  };

export type ProviderSignInAdapter = (
	input: SignInInput,
) => Promise<ProviderSignInResult>;

export type SignInSystemErrorReporter = (error: unknown) => void;

export type SignInWithPasswordOptions = {
	onSystemError?: SignInSystemErrorReporter;
};

const INVALID_CREDENTIAL_CODES = new Set([
	"invalid_credentials",
	"invalid_login_credentials",
]);

export function mapProviderSignInResult(
	result: ProviderSignInResult,
): SignInOutcome {
	if (result.ok) {
		return { status: "success" };
	}

	if (isInvalidCredentialError(result.error)) {
		return { status: "invalid_credentials" };
	}

	return { status: "system_error" };
}

export function createSignInWithPassword(
	adapter: ProviderSignInAdapter,
	options: SignInWithPasswordOptions = {},
): SignInWithPassword {
	return async (input) => {
		try {
			return mapProviderSignInResult(await adapter(input));
		} catch (error) {
			try {
				options.onSystemError?.(error);
			} catch {
				// Reporting is best-effort and must not change the normalized outcome.
			}
			return { status: "system_error" };
		}
	};
}

function isInvalidCredentialError(
	error: ProviderSignInError | undefined,
): boolean {
	if (!error) {
		return false;
	}

	if (error.code && INVALID_CREDENTIAL_CODES.has(error.code)) {
		return true;
	}

	return false;
}
