import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { isTestAuthAdapterEnabled } from "./test-auth-adapter";

describe("isTestAuthAdapterEnabled", () => {
	it("is enabled outside production, with the flag set, on a loopback hostname", () => {
		assert.equal(
			isTestAuthAdapterEnabled("localhost", "development", "1"),
			true,
		);
		assert.equal(
			isTestAuthAdapterEnabled("127.0.0.1", "development", "1"),
			true,
		);
		assert.equal(isTestAuthAdapterEnabled("::1", "development", "1"), true);
	});

	it("is disabled in production even with the flag set", () => {
		assert.equal(
			isTestAuthAdapterEnabled("localhost", "production", "1"),
			false,
		);
	});

	it("is disabled when the flag is not exactly '1'", () => {
		assert.equal(
			isTestAuthAdapterEnabled("localhost", "development", "true"),
			false,
		);
	});

	it("is disabled on a non-loopback hostname", () => {
		assert.equal(
			isTestAuthAdapterEnabled("kaito.example.com", "development", "1"),
			false,
		);
	});

	it("is disabled when there is no browser runtime (hostname undefined)", () => {
		assert.equal(
			isTestAuthAdapterEnabled(undefined, "development", "1"),
			false,
		);
	});
});
