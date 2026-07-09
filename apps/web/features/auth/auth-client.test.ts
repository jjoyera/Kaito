import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	createSignInWithPassword,
	mapProviderSignInResult,
} from "./auth-client";

describe("mapProviderSignInResult", () => {
	it("maps an accepted provider result to a Kaito success outcome", () => {
		const outcome = mapProviderSignInResult({ ok: true });

		assert.deepEqual(outcome, { status: "success" });
	});

	it("maps explicit credential rejection codes to a generic invalid-credentials outcome", () => {
		const outcome = mapProviderSignInResult({
			ok: false,
			error: {
				code: "invalid_credentials",
				status: 401,
				message: "Provider says the password is wrong for runner@kaito.app",
			},
		});

		assert.deepEqual(outcome, { status: "invalid_credentials" });
		assert.equal("message" in outcome, false);
		assert.equal("error" in outcome, false);
	});

	it("maps status-only credential-shaped responses to system_error", () => {
		for (const status of [400, 401]) {
			const outcome = mapProviderSignInResult({
				ok: false,
				error: {
					status,
					message: `Provider returned bare ${status} with raw detail`,
				},
			});

			assert.deepEqual(outcome, { status: "system_error" });
			assert.equal("message" in outcome, false);
		}
	});

	it("maps unexpected provider errors to system_error without raw payloads", () => {
		const outcome = mapProviderSignInResult({
			ok: false,
			error: {
				code: "database_unavailable",
				message: "connection failed at secret.internal:5432",
				cause: { stack: "raw provider stack" },
			},
		});

		assert.deepEqual(outcome, { status: "system_error" });
		assert.equal("error" in outcome, false);
	});
});

describe("createSignInWithPassword", () => {
	it("passes provider-agnostic sign-in input to the adapter", async () => {
		const seenInputs: unknown[] = [];
		const signIn = createSignInWithPassword(async (input) => {
			seenInputs.push(input);
			return { ok: true };
		});

		const outcome = await signIn({
			email: "runner@kaito.app",
			password: "trail-pass",
		});

		assert.deepEqual(outcome, { status: "success" });
		assert.deepEqual(seenInputs, [
			{ email: "runner@kaito.app", password: "trail-pass" },
		]);
	});

	it("converts thrown provider failures to system_error", async () => {
		const signIn = createSignInWithPassword(async () => {
			throw new Error("provider network failure with raw detail");
		});

		const outcome = await signIn({
			email: "runner@kaito.app",
			password: "trail-pass",
		});

		assert.deepEqual(outcome, { status: "system_error" });
	});
});
