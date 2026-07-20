import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	fetchActivePlanPresence,
	fetchOnboardingState,
	productRouteValidationDate,
} from "./product-route-api";

const baseDependencies = {
	apiBaseUrl: "https://api.kaito.test",
	getAccessToken: async () => "validated-token",
};

describe("product route API adapter", () => {
	it("maps exact onboarding states and missing snapshots", async () => {
		for (const state of ["incomplete", "completed"] as const) {
			assert.equal(
				await fetchOnboardingState("2026-07-20", {
					...baseDependencies,
					fetcher: async (input) => {
						assert.equal(
							String(input),
							"https://api.kaito.test/runner-profile/onboarding?validation_date=2026-07-20",
						);
						return Response.json({ snapshot: { state } });
					},
				}),
				state,
			);
		}
		assert.equal(
			await fetchOnboardingState("2026-07-20", {
				...baseDependencies,
				fetcher: async () => new Response(null, { status: 404 }),
			}),
			"missing",
		);
	});

	it("maps missing tokens, auth rejection, network, service, and malformed responses to unavailable", async () => {
		const cases = [
			{
				getAccessToken: async () => undefined,
				fetcher: async () => Response.json({ snapshot: { state: "completed" } }),
			},
			{
				getAccessToken: async () => "token",
				fetcher: async () => new Response(null, { status: 401 }),
			},
			{
				getAccessToken: async () => "token",
				fetcher: async () => {
					throw new Error("private network detail");
				},
			},
			{
				getAccessToken: async () => "token",
				fetcher: async () => new Response("private failure", { status: 500 }),
			},
			{
				getAccessToken: async () => "token",
				fetcher: async () => Response.json({ snapshot: { state: "unknown" } }),
			},
			{
				getAccessToken: async () => "token",
				fetcher: async () => Response.json({ state: "completed" }),
			},
		] as const;

		for (const dependencies of cases) {
			assert.equal(
				await fetchOnboardingState("2026-07-20", {
					apiBaseUrl: baseDependencies.apiBaseUrl,
					...dependencies,
				}),
				"unavailable",
			);
		}
	});

	it("maps active-plan existence without reading private response bodies", async () => {
		assert.equal(
			await fetchActivePlanPresence({
				...baseDependencies,
				fetcher: async () => new Response("ignored", { status: 200 }),
			}),
			"active",
		);
		assert.equal(
			await fetchActivePlanPresence({
				...baseDependencies,
				fetcher: async () => new Response("private detail", { status: 404 }),
			}),
			"none",
		);
		assert.equal(
			await fetchActivePlanPresence({
				...baseDependencies,
				fetcher: async () => new Response("private detail", { status: 503 }),
			}),
			"unavailable",
		);
	});

	it("uses the Europe/Madrid calendar date convention", () => {
		assert.equal(
			productRouteValidationDate(new Date("2026-07-19T22:30:00Z")),
			"2026-07-20",
		);
	});
});
