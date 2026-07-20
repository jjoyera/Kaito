import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	isE2EProductRouteAdapterAllowed,
	isSameOriginOnboardingReferer,
} from "./server-product-route-state";

describe("active-plan handoff safeguard", () => {
	it("accepts only the complete request origin and onboarding path", () => {
		assert.equal(
			isSameOriginOnboardingReferer(
				"http://127.0.0.1:3000/onboarding",
				"127.0.0.1:3000",
				"http",
			),
			true,
		);
		assert.equal(
			isSameOriginOnboardingReferer(
				"https://127.0.0.1:3000/onboarding",
				"127.0.0.1:3000",
				"http",
			),
			false,
		);
		assert.equal(
			isSameOriginOnboardingReferer(
				"https://attacker.example/onboarding",
				"127.0.0.1:3000",
				"https",
			),
			false,
		);
		assert.equal(
			isSameOriginOnboardingReferer(null, "127.0.0.1:3000", "http"),
			false,
		);
		for (const forwardedProtocol of [null, "", "http,https", "ftp", " https"]) {
			assert.equal(
				isSameOriginOnboardingReferer(
					"https://127.0.0.1:3000/onboarding",
					"127.0.0.1:3000",
					forwardedProtocol,
				),
				false,
			);
		}
	});
});

describe("E2E product-route adapter safeguard", () => {
	it("requires non-production, the exact secret, the flag, and loopback", () => {
		assert.equal(
			isE2EProductRouteAdapterAllowed(
				"127.0.0.1:3000",
				"run-secret",
				"development",
				"1",
				"run-secret",
			),
			true,
		);
		assert.equal(
			isE2EProductRouteAdapterAllowed(
				"kaito.example.com",
				"run-secret",
				"development",
				"1",
				"run-secret",
			),
			false,
		);
		assert.equal(
			isE2EProductRouteAdapterAllowed(
				"127.0.0.1:3000",
				"wrong",
				"development",
				"1",
				"run-secret",
			),
			false,
		);
		assert.equal(
			isE2EProductRouteAdapterAllowed(
				"127.0.0.1:3000",
				"run-secret",
				"production",
				"1",
				"run-secret",
			),
			false,
		);
	});
});
