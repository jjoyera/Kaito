import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import {
	fetchOnboardingSnapshot,
	saveOnboardingSnapshot,
} from "./onboarding-api";

const successBody = {
	snapshot: {
		contract_version: "1",
		state: "incomplete",
		profile: {},
		goal: {},
	},
	diagnostics: [],
};

function dependencies(
	fetcher: PrivateFetchDependencies["fetcher"],
): PrivateFetchDependencies {
	return {
		apiBaseUrl: "https://api.kaito.test",
		getAccessToken: async () => "token",
		fetcher,
	};
}

describe("fetchOnboardingSnapshot", () => {
	it("returns the parsed result on 200", async () => {
		const result = await fetchOnboardingSnapshot(
			"2026-07-13",
			dependencies(async (input) => {
				assert.equal(
					String(input),
					"https://api.kaito.test/runner-profile/onboarding?validation_date=2026-07-13",
				);
				return new Response(JSON.stringify(successBody), { status: 200 });
			}),
		);
		assert.deepEqual(result, successBody);
	});

	it("returns 'not_found' on a 404 without throwing", async () => {
		const result = await fetchOnboardingSnapshot(
			"2026-07-13",
			dependencies(
				async () => new Response("secret detail", { status: 404 }),
			),
		);
		assert.equal(result, "not_found");
	});

	it("throws for any other backend failure", async () => {
		await assert.rejects(() =>
			fetchOnboardingSnapshot(
				"2026-07-13",
				dependencies(
					async () => new Response("secret detail", { status: 500 }),
				),
			),
		);
	});
});

describe("saveOnboardingSnapshot", () => {
	it("sends the snapshot and validation date and returns the parsed result", async () => {
		let capturedBody: unknown;
		const result = await saveOnboardingSnapshot(
			{ contract_version: "1", state: "incomplete", profile: {}, goal: {} },
			"2026-07-13",
			dependencies(async (input, init) => {
				assert.equal(String(input), "https://api.kaito.test/runner-profile/onboarding");
				assert.equal(init?.method, "PUT");
				capturedBody = JSON.parse(String(init?.body));
				return new Response(JSON.stringify(successBody), { status: 200 });
			}),
		);
		assert.deepEqual(capturedBody, {
			snapshot: {
				contract_version: "1",
				state: "incomplete",
				profile: {},
				goal: {},
			},
			validation_date: "2026-07-13",
		});
		assert.deepEqual(result, successBody);
	});

	it("throws for a backend failure without leaking the response body", async () => {
		await assert.rejects(() =>
			saveOnboardingSnapshot(
				{ contract_version: "1", state: "incomplete", profile: {}, goal: {} },
				"2026-07-13",
				dependencies(
					async () => new Response("secret detail", { status: 503 }),
				),
			),
		);
	});
});
