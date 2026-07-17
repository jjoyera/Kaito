import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import {
	clearHiddenGoalFields,
	clearRestrictionDetail,
} from "./conditional-clearing";

describe("clearHiddenGoalFields", () => {
	test("clears OCR-specific fields when modality changes to backyard", () => {
		const goal = {
			modality: "backyard" as const,
			target_date: "2026-12-01",
			target_distance_km: 100,
			obstacle_count: 20,
			target_loops: 12,
		};

		const cleared = clearHiddenGoalFields(goal);

		assert.equal(cleared.target_distance_km, undefined);
		assert.equal(cleared.obstacle_count, undefined);
		assert.equal(cleared.target_loops, 12);
		assert.equal(cleared.target_date, "2026-12-01");
	});

	test("keeps visible Trail fields and clears every hidden goal field", () => {
		const goal = {
			modality: "trail" as const,
			target_date: "2026-12-01",
			target_distance_km: 42,
			positive_elevation_m: 1500,
			obstacle_count: 20,
			target_loops: 12,
		};

		const cleared = clearHiddenGoalFields(goal);

		assert.equal(cleared.target_distance_km, 42);
		assert.equal(cleared.positive_elevation_m, 1500);
		assert.equal(cleared.obstacle_count, undefined);
		assert.equal(cleared.target_loops, undefined);
	});

	test("clears elevation/max_altitude/target_loops for OCR", () => {
		const goal = {
			modality: "ocr" as const,
			target_date: "2026-12-01",
			target_distance_km: 15,
			obstacle_count: 20,
			positive_elevation_m: 500,
			max_altitude_m: 300,
			target_loops: 5,
		};

		const cleared = clearHiddenGoalFields(goal);

		assert.equal(cleared.target_distance_km, 15);
		assert.equal(cleared.obstacle_count, 20);
		assert.equal(cleared.positive_elevation_m, undefined);
		assert.equal(cleared.max_altitude_m, undefined);
		assert.equal(cleared.target_loops, undefined);
	});

	test("does not mutate the original goal object", () => {
		const goal = { modality: "backyard" as const, obstacle_count: 20 };
		const original = { ...goal };

		clearHiddenGoalFields(goal);

		assert.deepEqual(goal, original);
	});

	test("returns the goal unchanged when modality is not yet set", () => {
		const goal = { target_distance_km: 42 };
		assert.deepEqual(clearHiddenGoalFields(goal), goal);
	});
});

describe("clearRestrictionDetail", () => {
	test("clears detail when has_restrictions becomes false", () => {
		const restrictions = {
			has_restrictions: false as const,
			detail: "This answer must not be retained",
		};

		const cleared = clearRestrictionDetail(restrictions);

		assert.equal(cleared.detail, undefined);
		assert.equal(cleared.has_restrictions, false);
	});

	test("keeps detail when has_restrictions is true", () => {
		const restrictions = { has_restrictions: true as const, detail: "Knee" };
		assert.deepEqual(clearRestrictionDetail(restrictions), restrictions);
	});

	test("does not mutate the original restrictions object", () => {
		const restrictions = {
			has_restrictions: false as const,
			detail: "keep this off the wire",
		};
		const original = { ...restrictions };

		clearRestrictionDetail(restrictions);

		assert.deepEqual(restrictions, original);
	});
});
