import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	getLoginContextMessage,
	selectReturnDestination,
} from "./return-destination";

describe("selectReturnDestination", () => {
	it("keeps a local path with query and fragment", () => {
		assert.equal(
			selectReturnDestination("/training?week=2#today"),
			"/training?week=2#today",
		);
	});

	it("falls back for external, malformed, unsafe, and login-loop values", () => {
		for (const candidate of [
			"https://attacker.example/steal",
			"//attacker.example/steal",
			"/\\attacker.example",
			"/onboarding\nalert",
			"%2F%2Fattacker.example",
			"/%252F%252Fattacker.example",
			"/safe/..//attacker.example/steal",
			"/safe/%2e%2e//attacker.example/steal",
			"/login?returnTo=/onboarding",
			"/login/",
			"/".repeat(2_049),
		]) {
			assert.equal(selectReturnDestination(candidate), "/onboarding");
		}
	});
});

describe("getLoginContextMessage", () => {
	it("maps only trusted session context values to fixed copy", () => {
		assert.equal(
			getLoginContextMessage("session_expired"),
			"Your session expired. Sign in again.",
		);
		assert.equal(
			getLoginContextMessage("auth_unavailable"),
			"Sign-in is temporarily unavailable. Please try again later.",
		);
	});

	it("does not reflect arbitrary or repeated context values", () => {
		assert.equal(
			getLoginContextMessage("provider error: secret token"),
			undefined,
		);
		assert.equal(getLoginContextMessage(["session_expired"]), undefined);
	});
});
