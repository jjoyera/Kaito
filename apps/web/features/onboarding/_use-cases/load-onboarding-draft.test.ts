import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import { loadOnboardingDraft } from "./load-onboarding-draft";

const storedResult = {
	snapshot: {
		contract_version: "1",
		state: "incomplete" as const,
		profile: { restrictions: { has_restrictions: false } },
		goal: { modality: "trail" },
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

describe("loadOnboardingDraft", () => {
	it("hydrates from a stored snapshot", async () => {
		const outcome = await loadOnboardingDraft(
			"2026-07-13",
			dependencies(
				async () =>
					new Response(JSON.stringify(storedResult), { status: 200 }),
			),
		);
		assert.deepEqual(outcome, { status: "loaded", result: storedResult });
	});

	it("starts blank when there is no stored snapshot yet", async () => {
		const outcome = await loadOnboardingDraft(
			"2026-07-13",
			dependencies(async () => new Response(null, { status: 404 })),
		);
		assert.deepEqual(outcome, { status: "blank" });
	});

	it("reports a load error without throwing for backend failures", async () => {
		const outcome = await loadOnboardingDraft(
			"2026-07-13",
			dependencies(async () => new Response(null, { status: 503 })),
		);
		assert.deepEqual(outcome, { status: "error" });
	});

	it("reports a load error without throwing for network failures", async () => {
		const outcome = await loadOnboardingDraft(
			"2026-07-13",
			dependencies(async () => {
				throw new Error("network down");
			}),
		);
		assert.deepEqual(outcome, { status: "error" });
	});
});
