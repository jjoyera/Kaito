import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	CONFIRMATION_RECORD_TTL_MS,
	confirmationStorageKey,
	consumePostSignupConfirmation,
	createPostSignupConfirmation,
	normalizeConfirmationNonceInput,
} from "./post-signup-confirmation";

const NONCE = "123e4567-e89b-42d3-a456-426614174000";

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		values,
		storage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key),
		},
	};
}

describe("post-signup confirmation bridge", () => {
	it("creates a nonce-specific minimal record without registration data", () => {
		const { values, storage } = memoryStorage();
		assert.equal(createPostSignupConfirmation(storage, () => 1_000, () => NONCE), NONCE);
		assert.equal(values.get(confirmationStorageKey(NONCE)), '{"version":1,"createdAt":1000}');
		assert.equal(JSON.stringify([...values]), JSON.stringify([...values]).replace(/runner@|password/gi, ""));
	});

	it("consumes matching records once at both TTL boundaries", () => {
		for (const age of [0, CONFIRMATION_RECORD_TTL_MS]) {
			const { values, storage } = memoryStorage();
			values.set(confirmationStorageKey(NONCE), JSON.stringify({ version: 1, createdAt: 2_000 }));
			assert.equal(consumePostSignupConfirmation(NONCE, storage, () => 2_000 + age), true);
			assert.equal(values.has(confirmationStorageKey(NONCE)), false);
			assert.equal(consumePostSignupConfirmation(NONCE, storage, () => 2_000 + age), false);
		}
	});

	it("rejects missing, expired, future, wrong-version, and malformed records", () => {
		for (const record of [
			null,
			JSON.stringify({ version: 1, createdAt: 1_999 - CONFIRMATION_RECORD_TTL_MS }),
			JSON.stringify({ version: 1, createdAt: 2_001 }),
			JSON.stringify({ version: 2, createdAt: 2_000 }),
			JSON.stringify({ version: 1, createdAt: "2000" }),
			"not-json",
		]) {
			const { values, storage } = memoryStorage();
			if (record !== null) values.set(confirmationStorageKey(NONCE), record);
			assert.equal(consumePostSignupConfirmation(NONCE, storage, () => 2_000), false);
			assert.equal(values.has(confirmationStorageKey(NONCE)), false);
		}
	});

	it("rejects malformed, oversized, and repeated URL input", () => {
		assert.equal(normalizeConfirmationNonceInput(NONCE), NONCE);
		for (const input of [undefined, "not-a-uuid", "x".repeat(500), [NONCE], [NONCE, NONCE]]) {
			assert.equal(normalizeConfirmationNonceInput(input), undefined);
		}
	});

	it("fails closed for inaccessible storage and removal failure", () => {
		assert.equal(
			createPostSignupConfirmation(
				{ setItem: () => { throw new Error("blocked"); } },
				() => 1,
				() => NONCE,
			),
			undefined,
		);
		assert.equal(
			consumePostSignupConfirmation(
				NONCE,
				{
					getItem: () => JSON.stringify({ version: 1, createdAt: 1 }),
					removeItem: () => { throw new Error("blocked"); },
				},
				() => 1,
			),
			false,
		);
	});

	it("a copied nonce has no eligibility without its tab-scoped record", () => {
		const source = memoryStorage();
		const destination = memoryStorage();
		createPostSignupConfirmation(source.storage, () => 1, () => NONCE);
		assert.equal(consumePostSignupConfirmation(NONCE, destination.storage, () => 2), false);
		assert.equal(consumePostSignupConfirmation(NONCE, source.storage, () => 2), true);
	});
});
