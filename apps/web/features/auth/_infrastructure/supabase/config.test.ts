import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSupabaseConfig } from "./config";

describe("getSupabaseConfig", () => {
	it("returns public Supabase configuration only when both values are present", () => {
		assert.deepEqual(
			getSupabaseConfig({
				NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
				NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
			}),
			{
				url: "https://project.supabase.co",
				publishableKey: "sb_publishable_test",
			},
		);
	});

	it("fails closed when either required public value is missing", () => {
		assert.equal(getSupabaseConfig({}), undefined);
		assert.equal(
			getSupabaseConfig({
				NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
			}),
			undefined,
		);
	});
});
