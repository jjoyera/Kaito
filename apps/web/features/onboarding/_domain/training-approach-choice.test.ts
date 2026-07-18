import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
	buildApproachChoices,
	canSelectApproach,
	formatUtcCalendarDate,
	previewBlockingReasons,
} from "./training-approach-choice";

const assessment = {
	recommended_approach: "mode_z" as const,
	approaches: [
		{ approach: "kaio_path" as const, available: true, blocking_reason_codes: [] },
		{
			approach: "mode_z" as const,
			available: false,
			blocking_reason_codes: ["recovering", "unknown_future_code"],
		},
		{ approach: "kaioken" as const, available: true, blocking_reason_codes: [] },
	],
	safety_restriction_codes: ["no_load_increase"],
};

describe("training approach choice", () => {
	it("always presents all approaches low-to-high without recommendation decoration", () => {
		const choices = buildApproachChoices(assessment);
		assert.deepEqual(choices.map((choice) => choice.approach), [
			"kaio_path",
			"mode_z",
			"kaioken",
		]);
		assert.equal(choices.some((choice) => "recommended" in choice), false);
	});

	it("preserves blocking reason order and safely localizes unknown codes", () => {
		const modeZ = buildApproachChoices(assessment)[1];
		assert.deepEqual(modeZ.blockingReasons, [
			"Estás en recuperación; este enfoque no está disponible ahora.",
			"Este enfoque no está disponible con tu situación actual.",
		]);
		assert.equal(canSelectApproach(modeZ), false);
	});

	it("previews three blocking reasons and supports expand and collapse", () => {
		const reasons = ["one", "two", "three", "four", "five"];
		assert.deepEqual(previewBlockingReasons(reasons, false), {
			visible: ["one", "two", "three"],
			hiddenCount: 2,
		});
		assert.deepEqual(previewBlockingReasons(reasons, true), {
			visible: reasons,
			hiddenCount: 0,
		});
	});

	it("uses the UTC calendar date rather than the browser local calendar", () => {
		assert.equal(
			formatUtcCalendarDate(new Date("2026-07-02T00:30:00+02:00")),
			"2026-07-01",
		);
	});
});
