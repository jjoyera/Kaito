"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { SupabaseConfig } from "./config";
import { getSupabaseConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createBrowserSupabaseClient<T>(
	config: SupabaseConfig,
	createClient: (
		url: string,
		publishableKey: string,
		options: { cookieOptions: { secure: boolean } },
	) => T,
	environment = process.env.NODE_ENV,
): T {
	return createClient(config.url, config.publishableKey, {
		cookieOptions: { secure: environment === "production" },
	});
}

export function getBrowserSupabaseClient() {
	const config = getSupabaseConfig();
	if (!config) return undefined;
	browserClient ??= createBrowserSupabaseClient(
		config,
		(url, publishableKey, options) =>
			createBrowserClient(url, publishableKey, options),
	);
	return browserClient;
}
