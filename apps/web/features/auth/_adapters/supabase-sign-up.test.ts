import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSupabaseSignUpAdapter } from "./supabase-sign-up";

function adapterResult(result: unknown) {
	const adapter = createSupabaseSignUpAdapter({
		auth: { signUp: async () => result as never },
	});
	return adapter({ email: "runner@kaito.app", password: "Trail#42" });
}

describe("createSupabaseSignUpAdapter", () => {
	it("distinguishes session and no-session success without leaking session data", async () => {
		assert.deepEqual(await adapterResult({ data: { session: null }, error: null }), {
			ok: true,
			hasSession: false,
		});
		assert.deepEqual(
			await adapterResult({
				data: { session: { access_token: "must-not-leak", user: { email: "secret" } } },
				error: null,
			}),
			{ ok: true, hasSession: true },
		);
	});

	it("redacts every provider rejection except the approved structured fields", async () => {
		assert.deepEqual(
			await adapterResult({
				data: { session: null, user: { email: "secret@example.com" } },
				error: {
					code: "signup_disabled",
					status: 422,
					retryAfterSeconds: 2.25,
					message: "raw provider detail",
					body: { email: "secret@example.com" },
				},
			}),
			{
				ok: false,
				error: { code: "signup_disabled", status: 422, retryAfterSeconds: 2.25 },
			},
		);
	});

	it("preserves allow-listed observations for downstream classification", async () => {
		for (const [code, status] of [
			["user_already_exists", 422],
			["email_exists", 400],
			["over_email_send_rate_limit", 422],
			["unknown", 429],
		] as const) {
			assert.deepEqual(
				await adapterResult({ data: { session: null }, error: { code, status } }),
				{ ok: false, error: { code, status, retryAfterSeconds: undefined } },
			);
		}
	});

	it("does not infer behavior from provider message text", async () => {
		assert.deepEqual(
			await adapterResult({
				data: { session: null },
				error: { code: "unknown", status: 400, message: "user already exists rate limit" },
			}),
			{
				ok: false,
				error: { code: "unknown", status: 400, retryAfterSeconds: undefined },
			},
		);
	});
});
