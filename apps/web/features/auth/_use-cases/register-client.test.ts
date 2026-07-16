import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	MAX_SAFE_COOLDOWN_SECONDS,
	createRegisterWithPassword,
	mapProviderRegisterResult,
	normalizeRetryAfterSeconds,
	selectCooldownSeconds,
} from "./register-client";

describe("mapProviderRegisterResult", () => {
	it("maps both successful provider results", () => {
		assert.deepEqual(mapProviderRegisterResult({ ok: true, hasSession: true }), {
			status: "authenticated",
		});
		assert.deepEqual(mapProviderRegisterResult({ ok: true, hasSession: false }), {
			status: "confirmation_required",
		});
	});

	it("allow-lists duplicate errors and never includes retry metadata", () => {
		for (const code of ["user_already_exists", "email_exists"]) {
			assert.deepEqual(
				mapProviderRegisterResult({
					ok: false,
					error: { code, status: 422, retryAfterSeconds: 5 },
				}),
				{ status: "duplicate_account" },
			);
		}
	});

	it("maps code and status rate limits with only normalized retry metadata", () => {
		assert.deepEqual(
			mapProviderRegisterResult({
				ok: false,
				error: { code: "over_email_send_rate_limit", retryAfterSeconds: 2.1 },
			}),
			{ status: "rate_limited", retryAfterSeconds: 3 },
		);
		assert.deepEqual(
			mapProviderRegisterResult({
				ok: false,
				error: { status: 429, retryAfterSeconds: 7 },
			}),
			{ status: "rate_limited", retryAfterSeconds: 7 },
		);
	});

	it("maps unknown, missing, and status-only non-rate errors to system_error", () => {
		for (const error of [undefined, { status: 422 }, { code: "unknown", status: 400 }]) {
			assert.deepEqual(mapProviderRegisterResult({ ok: false, error }), {
				status: "system_error",
			});
		}
	});
});

describe("retry normalization", () => {
	it("accepts finite positive values through the safe deadline boundary", () => {
		assert.equal(normalizeRetryAfterSeconds(1), 1);
		assert.equal(normalizeRetryAfterSeconds(2.01), 3);
		assert.equal(normalizeRetryAfterSeconds(MAX_SAFE_COOLDOWN_SECONDS), MAX_SAFE_COOLDOWN_SECONDS);
		assert.equal(normalizeRetryAfterSeconds(MAX_SAFE_COOLDOWN_SECONDS + 1), undefined);
	});

	it("rejects missing, non-numeric, non-finite, non-positive, and unsafe values", () => {
		for (const value of [undefined, "4", Number.NaN, Infinity, 0, -1, Number.MAX_SAFE_INTEGER]) {
			assert.equal(normalizeRetryAfterSeconds(value), undefined);
		}
	});

	it("selects the exact 60-second fallback", () => {
		assert.equal(selectCooldownSeconds(undefined), 60);
		assert.equal(selectCooldownSeconds(-2), 60);
		assert.equal(selectCooldownSeconds(4.2), 5);
	});
});

describe("createRegisterWithPassword", () => {
	it("passes only provider-agnostic input and returns its closed outcome", async () => {
		const seen: unknown[] = [];
		const register = createRegisterWithPassword(async (input) => {
			seen.push(input);
			return { ok: true, hasSession: false };
		});
		assert.deepEqual(await register({ email: "runner@kaito.app", password: "Trail#42" }), {
			status: "confirmation_required",
		});
		assert.deepEqual(seen, [{ email: "runner@kaito.app", password: "Trail#42" }]);
	});

	it("bounds an adapter that never settles and reports a generic failure path", async () => {
		const reports: unknown[] = [];
		const register = createRegisterWithPassword(
			() => new Promise(() => {}),
			(error) => reports.push(error),
			5,
		);

		assert.deepEqual(await register({ email: "x@y.dev", password: "secret" }), {
			status: "system_error",
		});
		assert.equal(reports.length, 1);
		assert.match(String(reports[0]), /registration provider timeout/);
	});

	it("converts adapter and reporter throws to system_error", async () => {
		const reports: unknown[] = [];
		const failure = new Error("provider secret");
		const register = createRegisterWithPassword(
			async () => {
				throw failure;
			},
			(error) => {
				reports.push(error);
				throw new Error("reporter unavailable");
			},
		);
		assert.deepEqual(await register({ email: "x@y.dev", password: "secret" }), {
			status: "system_error",
		});
		assert.deepEqual(reports, [failure]);
	});
});
