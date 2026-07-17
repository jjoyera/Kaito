import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

import {
	AVAILABILITY_PRESETS,
	WEEKDAY_ORDER,
	hydrateAvailability,
	reduceAvailability,
	selectedAvailabilityDays,
	toAvailabilityDraft,
	validateAvailabilityInteraction,
	type AvailabilityInteractionState,
} from "./availability-model";

describe("availability interaction model", () => {
	test("exposes weekdays and approved preset mappings in canonical order", () => {
		assert.deepEqual(WEEKDAY_ORDER, [
			"monday",
			"tuesday",
			"wednesday",
			"thursday",
			"friday",
			"saturday",
			"sunday",
		]);
		assert.deepEqual(AVAILABILITY_PRESETS, [45, 60, 120]);
	});

	test("hydrates sparse maps without mutation or normalization", () => {
		const cases: ReadonlyArray<{
			minutesByDay: AvailabilityInteractionState["minutesByDay"];
			baseMode: AvailabilityInteractionState["baseMode"];
		}> = [
			{ minutesByDay: {}, baseMode: { kind: "unset" } },
			{
				minutesByDay: { monday: 45, wednesday: 45 },
				baseMode: { kind: "preset", minutes: 45 },
			},
			{
				minutesByDay: { monday: 75, wednesday: 75 },
				baseMode: { kind: "uniform-custom", minutes: 75 },
			},
			{
				minutesByDay: { monday: 45, wednesday: 75, saturday: 120 },
				baseMode: { kind: "mixed" },
			},
		];

		for (const { minutesByDay, baseMode } of cases) {
			const hydrated = hydrateAvailability(minutesByDay);
			assert.deepEqual(hydrated.minutesByDay, minutesByDay);
			assert.deepEqual(hydrated.baseMode, baseMode);
			assert.deepEqual(hydrated.pendingDays, []);
			assert.notEqual(hydrated.minutesByDay, minutesByDay);
		}
	});

	test("selects and deselects days according to the active base mode", () => {
		const preset = reduceAvailability(hydrateAvailability({}), {
			type: "choose-preset",
			minutes: 60,
		});
		const selectedWithPreset = reduceAvailability(preset, {
			type: "toggle-day",
			day: "monday",
		});
		assert.deepEqual(selectedWithPreset.minutesByDay, { monday: 60 });

		const custom = reduceAvailability(hydrateAvailability({ monday: 75 }), {
			type: "toggle-day",
			day: "wednesday",
		});
		assert.deepEqual(custom.minutesByDay, { monday: 75, wednesday: 75 });

		const mixed = reduceAvailability(
			hydrateAvailability({ monday: 45, wednesday: 75 }),
			{ type: "toggle-day", day: "saturday" },
		);
		assert.deepEqual(mixed.minutesByDay, { monday: 45, wednesday: 75 });
		assert.deepEqual(mixed.pendingDays, ["saturday"]);

		const deselected = reduceAvailability(mixed, {
			type: "toggle-day",
			day: "saturday",
		});
		assert.deepEqual(deselected.pendingDays, []);
		assert.deepEqual(deselected.minutesByDay, { monday: 45, wednesday: 75 });
	});

	test("initializes a reselected mapped day from the active preset", () => {
		const selected = hydrateAvailability({ monday: 45, wednesday: 45 });
		const deselected = reduceAvailability(selected, {
			type: "toggle-day",
			day: "monday",
		});
		assert.deepEqual(deselected.minutesByDay, { wednesday: 45 });

		const reselected = reduceAvailability(deselected, {
			type: "toggle-day",
			day: "monday",
		});

		assert.deepEqual(reselected.minutesByDay, { monday: 45, wednesday: 45 });
	});

	test("keeps exact edits isolated and uses presets as explicit bulk replacements", () => {
		const initial = hydrateAvailability({
			monday: 60,
			wednesday: 60,
			saturday: 60,
		});
		const overridden = reduceAvailability(initial, {
			type: "set-exact-minutes",
			day: "wednesday",
			minutes: 90,
		});
		assert.deepEqual(overridden.minutesByDay, {
			monday: 60,
			wednesday: 90,
			saturday: 60,
		});
		assert.deepEqual(overridden.baseMode, { kind: "mixed" });

		const bulkReplaced = reduceAvailability(overridden, {
			type: "choose-preset",
			minutes: 120,
		});
		assert.deepEqual(bulkReplaced.minutesByDay, {
			monday: 120,
			wednesday: 120,
			saturday: 120,
		});
		assert.deepEqual(bulkReplaced.baseMode, { kind: "preset", minutes: 120 });
	});

	test("retains pending and invalid transient edits outside the canonical projection", () => {
		const pending = reduceAvailability(hydrateAvailability({}), {
			type: "toggle-day",
			day: "monday",
		});
		assert.deepEqual(selectedAvailabilityDays(pending), ["monday"]);
		assert.deepEqual(toAvailabilityDraft(pending), { minutes_by_day: {} });
		assert.deepEqual(validateAvailabilityInteraction(pending), [
			"exact_value_required",
		]);

		const invalid = reduceAvailability(hydrateAvailability({ monday: 60 }), {
			type: "set-exact-minutes",
			day: "monday",
			minutes: 14.5,
		});
		assert.deepEqual(validateAvailabilityInteraction(invalid), [
			"invalid_day_value",
		]);
		assert.deepEqual(toAvailabilityDraft(invalid), {
			minutes_by_day: { monday: 14.5 },
		});

		const cleared = reduceAvailability(invalid, {
			type: "set-exact-minutes",
			day: "monday",
			minutes: undefined,
		});
		assert.deepEqual(cleared.minutesByDay, {});
		assert.deepEqual(cleared.pendingDays, ["monday"]);
	});

	test("applies every preset through reducer selection", () => {
		for (const minutes of AVAILABILITY_PRESETS) {
			const state = reduceAvailability(
				reduceAvailability(hydrateAvailability({}), {
					type: "choose-preset",
					minutes,
				}),
				{ type: "toggle-day", day: "monday" },
			);
			assert.deepEqual(state.minutesByDay, { monday: minutes });
		}
	});

	test("reports independent day and weekly thresholds after exact values are valid", () => {
		const cases: ReadonlyArray<{
			minutesByDay: AvailabilityInteractionState["minutesByDay"];
			issues: readonly string[];
		}> = [
			{
				minutesByDay: { monday: 120, wednesday: 120 },
				issues: ["insufficient_days"],
			},
			{
				minutesByDay: { monday: 45, wednesday: 45, saturday: 45 },
				issues: ["insufficient_weekly_minutes"],
			},
			{
				minutesByDay: { monday: 30, wednesday: 30 },
				issues: ["insufficient_days", "insufficient_weekly_minutes"],
			},
			{
				minutesByDay: { monday: 15, wednesday: 15, saturday: 120 },
				issues: [],
			},
			{
				minutesByDay: { monday: 300, wednesday: 15, saturday: 15 },
				issues: [],
			},
			{
				minutesByDay: { monday: 45, wednesday: 45, saturday: 60 },
				issues: [],
			},
			{
				minutesByDay: { monday: 301, wednesday: 60, saturday: 60 },
				issues: ["invalid_day_value"],
			},
			{
				minutesByDay: { monday: 45, wednesday: 75, saturday: 120 },
				issues: [],
			},
		];

		for (const { minutesByDay, issues } of cases) {
			assert.deepEqual(validateAvailabilityInteraction(hydrateAvailability(minutesByDay)), issues);
		}
	});
});
