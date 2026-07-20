import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideProductRoute } from "./product-route-policy";

describe("product route policy", () => {
	it("covers the approved onboarding and plan decision table", () => {
		const cases = [
			["onboarding", "completed", undefined, { kind: "redirect", destination: "/plan" }],
			["onboarding", "incomplete", "active", { kind: "redirect", destination: "/plan?handoff=active-plan" }],
			["onboarding", "missing", "active", { kind: "redirect", destination: "/plan?handoff=active-plan" }],
			["onboarding", "incomplete", "none", { kind: "allow" }],
			["onboarding", "missing", "none", { kind: "allow" }],
			["plan", "completed", undefined, { kind: "allow" }],
			["plan", "incomplete", undefined, { kind: "redirect", destination: "/onboarding" }],
			["plan", "missing", undefined, { kind: "redirect", destination: "/onboarding" }],
		] as const;

		for (const [route, onboarding, activePlan, expected] of cases) {
			assert.deepEqual(
				decideProductRoute({ route, onboarding, activePlan }),
				expected,
			);
		}
	});

	it("allows only the explicit active-plan handoff to break the route cycle", () => {
		assert.deepEqual(
			decideProductRoute({
				route: "plan",
				onboarding: "incomplete",
				activePlanHandoff: true,
			}),
			{ kind: "allow" },
		);
		assert.deepEqual(
			decideProductRoute({ route: "plan", onboarding: "incomplete" }),
			{ kind: "redirect", destination: "/onboarding" },
		);
	});

	it("fails closed without guessing a cross-route redirect", () => {
		assert.deepEqual(
			decideProductRoute({ route: "onboarding", onboarding: "unavailable" }),
			{ kind: "unavailable" },
		);
		assert.deepEqual(
			decideProductRoute({ route: "onboarding", onboarding: "incomplete", activePlan: "unavailable" }),
			{ kind: "unavailable" },
		);
		assert.deepEqual(
			decideProductRoute({ route: "plan", onboarding: "unavailable" }),
			{ kind: "unavailable" },
		);
	});
});
