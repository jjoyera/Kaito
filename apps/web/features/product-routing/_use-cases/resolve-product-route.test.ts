import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveProductRoute } from "./resolve-product-route";

describe("resolveProductRoute", () => {
	it("short-circuits active-plan lookup for completed onboarding", async () => {
		let activePlanCalls = 0;
		const decision = await resolveProductRoute("onboarding", {
			loadOnboarding: async () => "completed",
			loadActivePlan: async () => {
				activePlanCalls += 1;
				return "none";
			},
		});
		assert.deepEqual(decision, { kind: "redirect", destination: "/plan" });
		assert.equal(activePlanCalls, 0);
	});

	it("never loads active-plan state for the plan route", async () => {
		let activePlanCalls = 0;
		const decision = await resolveProductRoute("plan", {
			loadOnboarding: async () => "completed",
			loadActivePlan: async () => {
				activePlanCalls += 1;
				return "unavailable";
			},
		});
		assert.deepEqual(decision, { kind: "allow" });
		assert.equal(activePlanCalls, 0);
	});
});
