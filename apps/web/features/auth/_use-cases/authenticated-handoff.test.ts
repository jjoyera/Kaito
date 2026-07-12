import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	AUTHENTICATED_FLOW_DESTINATION,
	continueToAuthenticatedFlow,
	type AuthenticatedFlowNavigator,
} from "./authenticated-handoff";

describe("continueToAuthenticatedFlow", () => {
	it("keeps the live successful-login destination at the existing root route", () => {
		const destinations: string[] = [];

		continueToAuthenticatedFlow({
			replace: (destination) => destinations.push(destination),
		});

		assert.equal(AUTHENTICATED_FLOW_DESTINATION, "/");
		assert.deepEqual(destinations, ["/"]);
	});

	it("prefers a validated local return destination", () => {
		const destinations: string[] = [];

		continueToAuthenticatedFlow(
			{ replace: (destination) => destinations.push(destination) },
			"/training?week=2",
		);

		assert.deepEqual(destinations, ["/training?week=2"]);
	});

	it("does not inspect onboarding or dashboard state while handing off", () => {
		const destinations: string[] = [];
		const stateThatMustNotBeRead = new Proxy(
			{},
			{
				get() {
					throw new Error(
						"post-login state should not be inspected by this boundary",
					);
				},
			},
		);

		const handoffWithIgnoredState: (
			navigator: AuthenticatedFlowNavigator,
			state?: unknown,
		) => void = continueToAuthenticatedFlow;

		handoffWithIgnoredState(
			{ replace: (destination) => destinations.push(destination) },
			stateThatMustNotBeRead,
		);

		assert.deepEqual(destinations, [AUTHENTICATED_FLOW_DESTINATION]);
	});
});
