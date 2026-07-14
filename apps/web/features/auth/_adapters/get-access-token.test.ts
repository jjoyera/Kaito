import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGetAccessToken } from "./get-access-token";

describe("createGetAccessToken", () => {
	it("returns the session access token when one exists", async () => {
		const getAccessToken = createGetAccessToken(() => ({
			auth: {
				getSession: async () => ({
					data: { session: { access_token: "token-123" } },
				}),
			},
		}));

		assert.equal(await getAccessToken(), "token-123");
	});

	it("returns undefined when there is no active session", async () => {
		const getAccessToken = createGetAccessToken(() => ({
			auth: { getSession: async () => ({ data: { session: null } }) },
		}));

		assert.equal(await getAccessToken(), undefined);
	});

	it("returns undefined when no browser client is available", async () => {
		const getAccessToken = createGetAccessToken(() => undefined);
		assert.equal(await getAccessToken(), undefined);
	});
});
