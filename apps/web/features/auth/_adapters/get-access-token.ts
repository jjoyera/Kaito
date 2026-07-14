import { getBrowserSupabaseClient } from "../_infrastructure/supabase/browser";

type SessionClient = {
	auth: {
		getSession(): Promise<{
			data: { session: { access_token: string } | null };
		}>;
	};
};

export function createGetAccessToken(
	getClient: () => SessionClient | undefined,
): () => Promise<string | undefined> {
	return async () => {
		const client = getClient();
		if (!client) return undefined;
		const { data } = await client.auth.getSession();
		return data.session?.access_token;
	};
}

export const getAccessToken = createGetAccessToken(
	() => getBrowserSupabaseClient() as unknown as SessionClient | undefined,
);
