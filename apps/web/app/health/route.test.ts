import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET } from "./route";

describe("web health route", () => {
	it("returns an independent HTTP 200 response", async () => {
		const response = GET();

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { status: "ok" });
	});
});
