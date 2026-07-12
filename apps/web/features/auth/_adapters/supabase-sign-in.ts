import type {
	ProviderSignInAdapter,
	ProviderSignInResult,
	SignInInput,
} from "../_use-cases/auth-client";

type SupabasePasswordClient = {
	auth: {
		signInWithPassword(input: SignInInput): Promise<{
			error: { code?: string; status?: number } | null;
		}>;
	};
};

export function createSupabaseSignInAdapter(
	client: SupabasePasswordClient,
): ProviderSignInAdapter {
	return async (input): Promise<ProviderSignInResult> => {
		const { error } = await client.auth.signInWithPassword(input);
		if (!error) {
			return { ok: true };
		}

		return {
			ok: false,
			error: { code: error.code, status: error.status },
		};
	};
}
