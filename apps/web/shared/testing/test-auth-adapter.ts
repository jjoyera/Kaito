const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function isTestAuthAdapterEnabled(
	hostname: string | undefined,
	environment = process.env.NODE_ENV,
	flag = process.env.NEXT_PUBLIC_KAITO_TEST_AUTH_ADAPTER,
): boolean {
	return (
		environment !== "production" &&
		flag === "1" &&
		hostname !== undefined &&
		LOOPBACK_HOSTNAMES.has(hostname)
	);
}

export function isTestAuthAdapterEnabledInBrowser(): boolean {
	return isTestAuthAdapterEnabled(
		typeof window === "undefined" ? undefined : window.location.hostname,
	);
}
