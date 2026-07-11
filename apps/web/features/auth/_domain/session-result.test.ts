import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeSessionResult } from "./session-result";

describe("normalizeSessionResult", () => {
	it("recognizes a verified user as authenticated", () => {
		assert.deepEqual(normalizeSessionResult({ user: { id: "runner-1" } }), {
			status: "authenticated",
		});
	});

	it("keeps anonymous, invalid, and unavailable outcomes distinct", () => {
		assert.deepEqual(normalizeSessionResult({ user: null }), {
			status: "anonymous",
		});
		assert.deepEqual(
			normalizeSessionResult({
				user: null,
				error: { name: "AuthSessionMissingError" },
			}),
			{ status: "anonymous" },
		);
		assert.deepEqual(
			normalizeSessionResult({
				user: null,
				error: { name: "AuthApiError", status: 401 },
			}),
			{ status: "invalid" },
		);
		assert.deepEqual(
			normalizeSessionResult({
				user: null,
				error: { name: "FetchError" },
			}),
			{ status: "unavailable" },
		);
	});
});
