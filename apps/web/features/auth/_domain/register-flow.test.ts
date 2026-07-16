import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_SAFE_COOLDOWN_SECONDS } from "../_use-cases/register-client";
import {
	REGISTER_COOLDOWN_STORAGE_KEY,
	createCooldownDeadline,
	hydrateCooldownDeadline,
	registerFlowReducer,
	remainingCooldownSeconds,
} from "./register-flow";

describe("registerFlowReducer", () => {
	it("starts one request and only settles a matching request", () => {
		const submitting = registerFlowReducer({ kind: "idle" }, { type: "submit", requestId: 4 });
		assert.deepEqual(submitting, { kind: "submitting", requestId: 4 });
		assert.equal(registerFlowReducer(submitting, { type: "submit", requestId: 5 }), submitting);
		assert.equal(
			registerFlowReducer(submitting, { type: "settle", requestId: 3, outcome: "system_error" }),
			submitting,
		);
	});

	it("settles success into explicit navigation states", () => {
		const state = { kind: "submitting", requestId: 1 } as const;
		assert.deepEqual(
			registerFlowReducer(state, { type: "settle", requestId: 1, outcome: "authenticated" }),
			{ kind: "navigating", destination: "onboarding" },
		);
		assert.deepEqual(
			registerFlowReducer(state, {
				type: "settle",
				requestId: 1,
				outcome: "confirmation_required",
			}),
			{ kind: "navigating", destination: "login" },
		);
	});

	it("recovers system feedback on field edits", () => {
		assert.deepEqual(registerFlowReducer({ kind: "system_error" }, { type: "edit" }), {
			kind: "idle",
		});
	});

	it("does not clear an active cooldown on edit and expires by absolute time", () => {
		const limited = { kind: "rate_limited", retryAt: 70_000, now: 10_000 } as const;
		assert.equal(registerFlowReducer(limited, { type: "edit" }), limited);
		assert.deepEqual(registerFlowReducer(limited, { type: "tick", now: 69_999 }), {
			...limited,
			now: 69_999,
		});
		assert.deepEqual(registerFlowReducer(limited, { type: "tick", now: 70_000 }), {
			kind: "idle",
		});
	});
});

describe("cooldown rules", () => {
	it("creates provider and exact fallback absolute deadlines", () => {
		assert.equal(createCooldownDeadline(1_000, 2.2), 4_000);
		assert.equal(createCooldownDeadline(1_000, undefined), 61_000);
		assert.equal(remainingCooldownSeconds(2_001, 1_000), 2);
		assert.equal(remainingCooldownSeconds(2_000, 2_000), 0);
	});

	it("keeps the largest normalized retry safe at the maximum Date epoch", () => {
		const maximumDateEpoch = 8_640_000_000_000_000;
		const deadline = createCooldownDeadline(maximumDateEpoch, MAX_SAFE_COOLDOWN_SECONDS);
		assert.equal(Number.isSafeInteger(deadline), true);
		assert.equal(deadline <= Number.MAX_SAFE_INTEGER, true);
	});

	it("hydrates only a finite future deadline and clears malformed/expired storage", () => {
		for (const value of ["garbage", "NaN", "1000", String(Number.MAX_SAFE_INTEGER + 1)]) {
			let removed = false;
			const storage = {
				getItem: () => value,
				removeItem: (key: string) => {
					assert.equal(key, REGISTER_COOLDOWN_STORAGE_KEY);
					removed = true;
				},
			};
			assert.equal(hydrateCooldownDeadline(storage, 1_000), undefined);
			assert.equal(removed, true);
		}
		assert.equal(
			hydrateCooldownDeadline({ getItem: () => "61000", removeItem: () => {} }, 1_000),
			61_000,
		);
	});

	it("tolerates inaccessible storage", () => {
		assert.equal(
			hydrateCooldownDeadline(
				{ getItem: () => { throw new Error("blocked"); }, removeItem: () => {} },
				1_000,
			),
			undefined,
		);
	});
});
