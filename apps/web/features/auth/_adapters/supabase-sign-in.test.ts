import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSupabaseSignInAdapter } from "./supabase-sign-in";

describe("createSupabaseSignInAdapter", () => {
	it("maps a successful Supabase password sign-in without exposing its session", async () => {
		const adapter = createSupabaseSignInAdapter({
			auth: {
				signInWithPassword: async () => ({
					data: { session: { access_token: "must-not-leak" } },
					error: null,
				}),
			},
		});

		assert.deepEqual(
			await adapter({ email: "runner@kaito.app", password: "trail-pass" }),
			{ ok: true },
		);
	});

	it("maps provider rejection to only the generic provider error fields", async () => {
		const adapter = createSupabaseSignInAdapter({
			auth: {
				signInWithPassword: async () => ({
					data: { session: null },
					error: {
						code: "invalid_credentials",
						status: 400,
						message: "raw provider detail",
					},
				}),
			},
		});

		assert.deepEqual(
			await adapter({ email: "runner@kaito.app", password: "wrong" }),
			{ ok: false, error: { code: "invalid_credentials", status: 400 } },
		);
	});
});
