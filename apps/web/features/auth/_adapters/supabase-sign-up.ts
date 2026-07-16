import type {
	ProviderRegisterAdapter,
	ProviderRegisterResult,
	RegisterInput,
} from "../_use-cases/register-client";

type SupabaseSignUpError = {
	code?: string;
	status?: number;
	/** Reserved for a future documented structured provider value. */
	retryAfterSeconds?: unknown;
};

type SupabaseSignUpClient = {
	auth: {
		signUp(input: RegisterInput): Promise<{
			data: { session: unknown | null };
			error: SupabaseSignUpError | null;
		}>;
	};
};

export function createSupabaseSignUpAdapter(client: SupabaseSignUpClient): ProviderRegisterAdapter {
	return async (input): Promise<ProviderRegisterResult> => {
		const { data, error } = await client.auth.signUp(input);
		if (error) {
			return {
				ok: false,
				error: {
					code: error.code,
					status: error.status,
					retryAfterSeconds: error.retryAfterSeconds,
				},
			};
		}
		return { ok: true, hasSession: data.session !== null };
	};
}
