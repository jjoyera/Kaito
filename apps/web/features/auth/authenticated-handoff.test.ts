import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	AUTHENTICATED_FLOW_DESTINATION,
	continueToAuthenticatedFlow,
} from "./authenticated-handoff";

describe("continueToAuthenticatedFlow", () => {
	it("delegates successful login to the centralized authenticated-flow destination", () => {
		const destinations: string[] = [];

		continueToAuthenticatedFlow({
			replace: (destination) => destinations.push(destination),
		});

		assert.deepEqual(destinations, [AUTHENTICATED_FLOW_DESTINATION]);
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

		continueToAuthenticatedFlow(
			{ replace: (destination) => destinations.push(destination) },
			stateThatMustNotBeRead,
		);

		assert.deepEqual(destinations, [AUTHENTICATED_FLOW_DESTINATION]);
	});
});
