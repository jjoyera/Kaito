import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { PrivateFetchDependencies } from "../../../shared/adapters/private-fetch";
import {
	loadCurrentTrainingApproachEligibility,
	loadTrainingApproachEligibility,
} from "./load-training-approach-eligibility";
import { saveTrainingPlanDraft } from "./save-training-plan-draft";

function dependencies(fetcher: PrivateFetchDependencies["fetcher"]): PrivateFetchDependencies {
	return {
		apiBaseUrl: "https://api.kaito.test",
		getAccessToken: async () => "token",
		fetcher,
	};
}

describe("training planning use cases", () => {
	it("does not capture expected transport failures", async () => {
		const captured: unknown[] = [];
		const outcome = await loadTrainingApproachEligibility(
			"2026-07-01",
			dependencies(async () => new Response("private detail", { status: 500 })),
			(error) => captured.push(error),
		);
		assert.deepEqual(outcome, { status: "error", reason: "unavailable" });
		assert.equal(captured.length, 0);
	});

	it("maps draft conflicts without exposing backend details", async () => {
		const outcome = await saveTrainingPlanDraft(
			"kaio_path",
			dependencies(async () => new Response("private detail", { status: 409 })),
		);
		assert.deepEqual(outcome, { status: "error", reason: "conflict" });
	});

	it("captures malformed success without leaking its body", async () => {
		const captured: unknown[] = [];
		const eligibility = await loadTrainingApproachEligibility(
			"2026-07-01",
			dependencies(async () => new Response(JSON.stringify({ approaches: null, secret: "private-body" }), { status: 200 })),
			(error) => captured.push(error),
		);
		const draft = await saveTrainingPlanDraft(
			"kaio_path",
			dependencies(async () => new Response(JSON.stringify({ status: "draft" }), { status: 200 })),
			(error) => captured.push(error),
		);
		assert.deepEqual([eligibility, draft], [{ status: "error", reason: "unavailable" }, { status: "error", reason: "unavailable" }]);
		assert.equal(captured.length, 2);
		assert.equal(captured.some((error) => String(error).includes("private-body")), false);
	});

	it("computes a fresh UTC date for every eligibility attempt", async () => {
		const dates = ["2026-07-01T23:59:59Z", "2026-07-02T00:00:01Z"];
		const urls: string[] = [];
		const body = { recommended_approach: "mode_z", approaches: ["kaio_path", "mode_z", "kaioken"].map((approach) => ({ approach, available: true, blocking_reason_codes: [] })), safety_restriction_codes: [] };
		const deps = dependencies(async (input) => { urls.push(String(input)); return new Response(JSON.stringify(body), { status: 200 }); });
		for (const instant of dates) await loadCurrentTrainingApproachEligibility(deps, () => new Date(instant));
		assert.match(urls[0], /2026-07-01$/);
		assert.match(urls[1], /2026-07-02$/);
	});

	it("maps missing credentials to an auth outcome without calling fetch", async () => {
		let calls = 0;
		const outcome = await loadTrainingApproachEligibility("2026-07-01", {
			apiBaseUrl: "https://api.kaito.test",
			getAccessToken: async () => undefined,
			fetcher: async () => {
				calls += 1;
				return new Response();
			},
		});
		assert.deepEqual(outcome, { status: "error", reason: "auth" });
		assert.equal(calls, 0);
	});
});
