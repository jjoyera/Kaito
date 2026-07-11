"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { SupabaseConfig } from "./config";
import { getSupabaseConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createBrowserSupabaseClient<T>(
	config: SupabaseConfig,
	createClient: (url: string, publishableKey: string) => T,
): T {
	return createClient(config.url, config.publishableKey);
}

export function getBrowserSupabaseClient() {
	const config = getSupabaseConfig();
	if (!config) return undefined;
	browserClient ??= createBrowserSupabaseClient(config, (url, publishableKey) =>
		createBrowserClient(url, publishableKey),
	);
	return browserClient;
}
