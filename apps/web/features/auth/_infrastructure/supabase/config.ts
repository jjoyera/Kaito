export type SupabaseConfig = {
	url: string;
	publishableKey: string;
};

const browserEnvironment = {
	NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

export function getSupabaseConfig(
	environment: Record<string, string | undefined> = browserEnvironment,
): SupabaseConfig | undefined {
	const url = environment.NEXT_PUBLIC_SUPABASE_URL;
	const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !publishableKey) {
		return undefined;
	}

	return { url, publishableKey };
}
