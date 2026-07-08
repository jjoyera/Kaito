import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Event } from "@sentry/nextjs";
import {
	beforeSend,
	beforeSendTransaction,
	getTracesSampleRate,
} from "./sentry-scrubbing";

const serialized = (value: unknown) => JSON.stringify(value);

describe("Sentry privacy scrubber", () => {
	it("redacts sensitive event fields and preserves allowlisted technical context", () => {
		const event = beforeSend({
			type: undefined,
			message:
				"Failed for user coach@example.com bearer abc.def.ghi at https://kaito.example/run?access_token=secret near 40.4168,-3.7038",
			transaction:
				"/athletes/123456789/activities/987654321?email=coach@example.com",
			user: {
				id: "athlete-123456789",
				email: "coach@example.com",
				username: "coach",
			},
			request: {
				url: "https://kaito.example/api/strava/callback?code=secret&email=coach@example.com",
				query_string: "code=secret",
				cookies: { session: "secret" },
				headers: {
					Authorization: "Bearer secret",
					cookie: "session=secret",
					referer:
						"https://kaito.example/private?email=coach@example.com&token=secret",
					"x-forwarded-for": "203.0.113.10",
					"x-custom-athlete-note": "coach@example.com private training note",
					"x-runtime": "node",
				},
				data: {
					runtime: "node",
					component: "callback",
					supabaseToken: "secret",
					trainingPayload: { workout: "private" },
				},
			},
			extra: {
				runtime: "browser",
				component: "dashboard",
				operation: "render",
				statusCode: 500,
				errorName: "TypeError",
				release: "web@1",
				environment: "test",
				email: "coach@example.com",
				activity: "long run",
				freeForm: "athlete gps 40.4168,-3.7038",
			},
			breadcrumbs: [
				{
					message:
						"Opened /athletes/123456789?token=secret as coach@example.com",
					data: {
						operation: "click",
						stravaAccessToken: "secret",
						athlete: "private",
					},
				},
			],
			exception: {
				values: [
					{
						type: "Error",
						value:
							"JWT abc.def.ghi for athlete 123456789 and email coach@example.com",
					},
				],
			},
			tags: { runtime: "browser", access_token: "secret" },
			contexts: {
				runtime: "browser",
				device: { model: "private wearable", latitude: 40.4168 },
				notes: { text: "non-denylisted private coach note" },
			} as unknown as Event["contexts"],
		} satisfies Event);

		const body = serialized(event);
		assert.equal(event.extra?.runtime, "browser");
		assert.equal(event.extra?.component, "dashboard");
		assert.equal(event.extra?.statusCode, 500);
		assert.equal(event.user, undefined);
		assert.equal(event.request?.query_string, undefined);
		assert.equal(event.request?.cookies, undefined);
		assert.equal(event.request?.headers, undefined);
		assert.equal(event.contexts?.runtime, "browser");
		assert.equal(event.contexts?.device, undefined);
		const requestData = event.request?.data as
			| Record<string, unknown>
			| undefined;
		assert.equal(requestData?.runtime, "node");
		assert.equal(requestData?.component, "callback");
		assert.equal(event.breadcrumbs?.[0]?.data?.operation, "click");
		assert.match(event.transaction ?? "", /\[redacted-path\]/);
		assert.doesNotMatch(
			body,
			/coach@example\.com|Bearer secret|access_token=secret|session=secret|long run|40\.4168|987654321/,
		);
		assert.doesNotMatch(
			body,
			/private training note|203\.0\.113\.10|non-denylisted private coach note|private wearable|athlete-123456789/,
		);
		assert.match(body, /\[redacted\]/);
	});

	it("scrubs transaction names, span descriptions, and span data", () => {
		const transaction = beforeSendTransaction({
			type: "transaction",
			transaction: "/training/plan/123456789?jwt=secret",
			spans: [
				{
					span_id: "abcdefabcdefabcd",
					trace_id: "abcdefabcdefabcdabcdefabcdefabcd",
					start_timestamp: 1,
					description: "/api/activities/123456789?token=secret",
					data: {
						operation: "fetch",
						stravaToken: "secret",
						gps: "40.4168,-3.7038",
					},
				},
			],
		} satisfies Event);

		const body = serialized(transaction);
		assert.match(transaction.transaction ?? "", /\[redacted-path\]/);
		assert.doesNotMatch(body, /123456789|token=secret|40\.4168/);
		// Denied key kept but value is redacted.
		assert.equal(transaction.spans?.[0]?.data?.stravaToken, "[redacted]");
		// Safe key preserved.
		assert.equal(transaction.spans?.[0]?.data?.operation, "fetch");
		assert.match(body, /\[redacted\]/);
	});

	it("drops non-safe-key free-form span data and tags so PII under innocuous keys cannot leak", () => {
		// This test exercises the safe-key allowlist on span data and tags.
		// A non-denied key carrying a free-form private value (name, training note,
		// GPS-like numeric) must be dropped entirely rather than forwarded.
		const transaction = beforeSendTransaction({
			type: "transaction",
			transaction: "/training/overview",
			spans: [
				{
					span_id: "abcdefabcdef0001",
					trace_id: "abcdefabcdefabcdabcdefabcdefabcd",
					start_timestamp: 1,
					description: "/api/activities/overview",
					data: {
						// SAFE_KEY — must pass through.
						operation: "fetch",
						statusCode: 200,
						// Non-denied, non-safe keys carrying private/PII values.
						trainingNote: "Jane Doe private training note",
						internalRef: "user-jane-doe-12345",
						// Numeric GPS-like value under an innocuous key.
						score: 40.4168,
					},
				},
			],
			tags: {
				// SAFE_KEY — must pass through.
				environment: "test",
				// Non-denied, non-safe keys carrying private/PII values.
				trainingNote: "private Strava workout note",
				internalRef: "user-jane-doe",
				// GPS-like string value under a non-denied key.
				waypoint: "40.4168,-3.7038",
			},
		} satisfies Event);

		const body = serialized(transaction);
		const spanData = transaction.spans?.[0]?.data as
			| Record<string, unknown>
			| undefined;
		const tags = transaction.tags as Record<string, string> | undefined;

		// Safe keys are preserved.
		assert.equal(spanData?.operation, "fetch");
		assert.equal(spanData?.statusCode, 200);
		assert.equal(tags?.environment, "test");

		// Non-safe, non-denied keys are dropped — values never reach the payload.
		assert.equal(spanData?.trainingNote, undefined);
		assert.equal(spanData?.internalRef, undefined);
		assert.equal(spanData?.score, undefined);
		assert.equal(tags?.trainingNote, undefined);
		assert.equal(tags?.internalRef, undefined);
		assert.equal(tags?.waypoint, undefined);

		// No free-form private strings or GPS-like values in the serialized event.
		assert.doesNotMatch(
			body,
			/Jane Doe|private training note|private Strava workout note|user-jane-doe|40\.4168/,
		);
	});

	it("redacts consecutive dynamic path segments deterministically", () => {
		const event = beforeSend({
			type: undefined,
			transaction: "/athletes/123456789/activities/987654321",
			request: {
				url: "https://kaito.example/athletes/123456789/activities/987654321?token=secret",
			},
		} satisfies Event);

		assert.equal(
			event.transaction,
			"/athletes/[redacted-path]/activities/[redacted-path]",
		);
		assert.equal(
			event.request?.url,
			"https://kaito.example/athletes/[redacted-path]/activities/[redacted-path]",
		);
	});

	it("defaults performance sampling to disabled outside production", () => {
		const previous = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
		delete process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
		assert.equal(getTracesSampleRate(), 0);
		process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = previous;
	});
});
