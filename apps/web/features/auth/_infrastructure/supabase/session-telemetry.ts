// A protected-route redirect can resolve in proxy, login proxy, and login page.
// Keep the complete degraded path below the ten-second fallback budget.
export const SESSION_RESOLUTION_TIMEOUT_MS = 3_000;

export async function withSessionTimeout<T>(
	operation: Promise<T>,
	timeoutMs = SESSION_RESOLUTION_TIMEOUT_MS,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error("session resolution timeout")),
			timeoutMs,
		);
	});
	try {
		return await Promise.race([operation, timeout]);
	} finally {
		clearTimeout(timer!);
	}
}

export type SessionTelemetryCapture = (
	message: string,
	context: { tags: Record<string, string> },
) => void;

export function reportSessionFailure(
	capture: SessionTelemetryCapture,
	event: "supabase_get_user_failed",
): void {
	try {
		capture("auth_session_resolution_failed", {
			tags: { area: "auth", event },
		});
	} catch {
		// Telemetry is best-effort and must not affect session resolution.
	}
}
