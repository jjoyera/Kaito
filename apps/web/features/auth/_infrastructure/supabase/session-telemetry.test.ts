import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	reportSessionFailure,
	SESSION_RESOLUTION_TIMEOUT_MS,
} from "./session-telemetry";

describe("session telemetry", () => {
	it("bounds three sequential degraded resolutions below ten seconds", () => {
		assert.ok(SESSION_RESOLUTION_TIMEOUT_MS * 3 < 10_000);
	});

	it("reports only the stable session-resolution event without provider details", () => {
		const events: Array<{ message: string; tags: Record<string, string> }> = [];
		reportSessionFailure(
			(message, context) => events.push({ message, tags: context.tags }),
			"supabase_get_user_failed",
		);

		assert.deepEqual(events, [
			{
				message: "auth_session_resolution_failed",
				tags: { area: "auth", event: "supabase_get_user_failed" },
			},
		]);
	});

	it("swallows capture failures", () => {
		assert.doesNotThrow(() =>
			reportSessionFailure(() => {
				throw new Error("reporter unavailable");
			}, "supabase_get_user_failed"),
		);
	});
});
