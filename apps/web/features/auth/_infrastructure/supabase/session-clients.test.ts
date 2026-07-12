import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBrowserSupabaseClient } from "./browser";
import { NextResponse } from "next/server";

import { redirectWithSessionCookies } from "../../../../proxy";
import { createServerSessionResolver, isE2EAuthAdapterAllowed } from "./server";
import { reportSessionFailure } from "./session-telemetry";
import {
	createProxySessionRefresher,
	enforceSecureCookieOptions,
} from "./proxy";

describe("browser session client", () => {
	it("creates a production browser client with Secure session cookies", () => {
		const calls: Array<
			[string, string, { cookieOptions: { secure: boolean } }]
		> = [];
		const client = { auth: {} };
		assert.equal(
			createBrowserSupabaseClient(
				{
					url: "https://project.supabase.co",
					publishableKey: "sb_publishable_test",
				},
				(url, key, options) => {
					calls.push([url, key, options]);
					return client;
				},
				"production",
			),
			client,
		);
		assert.deepEqual(calls, [
			[
				"https://project.supabase.co",
				"sb_publishable_test",
				{ cookieOptions: { secure: true } },
			],
		]);
	});
});

describe("server session wiring", () => {
	it("requires the per-run secret regardless of a spoofed Host", () => {
		assert.equal(isE2EAuthAdapterAllowed("run-secret", "test", "1", "run-secret"), true);
		assert.equal(isE2EAuthAdapterAllowed("wrong", "test", "1", "run-secret"), false);
		assert.equal(isE2EAuthAdapterAllowed(null, "test", "1", "run-secret"), false);
		assert.equal(
			isE2EAuthAdapterAllowed("run-secret", "production", "1", "run-secret"),
			false,
		);
	});
});

describe("server session resolver", () => {
	it("times out a never-settling provider and safely observes a late rejection", async () => {
		const reports: string[] = [];
		let rejectProvider!: (reason: Error) => void;
		const provider = new Promise<never>((_, reject) => {
			rejectProvider = reject;
		});
		const resolve = createServerSessionResolver(
			{ getAll: () => [], setAll: () => {} },
			() => ({ auth: { getUser: () => provider } }),
			(event) => reports.push(event),
			0,
		);
		assert.deepEqual(await resolve(), { status: "unavailable" });
		rejectProvider(new Error("late secret"));
		await new Promise((resolve) => setImmediate(resolve));
		assert.deepEqual(reports, ["supabase_get_user_failed"]);
	});

	it("uses the sanitized telemetry contract and swallows a throwing reporter", async () => {
		const events: unknown[] = [];
		const resolve = createServerSessionResolver(
			{ getAll: () => [], setAll: () => {} },
			() => {
				throw new Error("missing config");
			},
			(event) =>
				reportSessionFailure(
					(message, context) => events.push({ message, ...context }),
					event,
				),
		);
		assert.deepEqual(await resolve(), { status: "unavailable" });
		assert.deepEqual(events, [
			{
				message: "auth_session_resolution_failed",
				tags: { area: "auth", event: "supabase_get_user_failed" },
			},
		]);
	});
	it("uses getUser and normalizes a verified user without writing server-component cookies", async () => {
		const cookieWrites: unknown[] = [];
		let getUserCalls = 0;
		const resolve = createServerSessionResolver(
			{
				getAll: () => [{ name: "sb-session", value: "cookie" }],
				setAll: (values: unknown) => cookieWrites.push(values),
			},
			(cookies) => {
				assert.deepEqual(cookies.getAll(), [
					{ name: "sb-session", value: "cookie" },
				]);
				return {
					auth: {
						getUser: async () => {
							getUserCalls += 1;
							return { data: { user: { id: "runner-1" } }, error: null };
						},
					},
				};
			},
		);

		assert.deepEqual(await resolve(), { status: "authenticated" });
		assert.equal(getUserCalls, 1);
		assert.deepEqual(cookieWrites, []);
	});

	it("reports thrown getUser failures without exposing details and returns unavailable", async () => {
		const reports: string[] = [];
		const resolve = createServerSessionResolver(
			{ getAll: () => [], setAll: () => {} },
			() => ({
				auth: {
					getUser: async () => {
						throw new Error("secret provider detail");
					},
				},
			}),
			(event) => reports.push(event),
		);
		assert.deepEqual(await resolve(), { status: "unavailable" });
		assert.deepEqual(reports, ["supabase_get_user_failed"]);
	});

	it("keeps unavailable when the server failure reporter throws", async () => {
		const resolve = createServerSessionResolver(
			{ getAll: () => [], setAll: () => {} },
			() => ({
				auth: {
					getUser: async () => {
						throw new Error("provider");
					},
				},
			}),
			() => {
				throw new Error("reporter");
			},
		);
		assert.deepEqual(await resolve(), { status: "unavailable" });
	});

	it("normalizes a validation rejection as invalid", async () => {
		const resolve = createServerSessionResolver(
			{ getAll: () => [], setAll: () => {} },
			() => ({
				auth: {
					getUser: async () => ({
						data: { user: null },
						error: { status: 401 },
					}),
				},
			}),
		);
		assert.deepEqual(await resolve(), { status: "invalid" });
	});

	it("does not report expected 400 and 403 invalid-session responses", async () => {
		for (const status of [400, 403]) {
			const reports: string[] = [];
			const resolve = createServerSessionResolver(
				{ getAll: () => [], setAll: () => {} },
				() => ({
					auth: {
						getUser: async () => ({ data: { user: null }, error: { status } }),
					},
				}),
				(event) => reports.push(event),
			);
			assert.deepEqual(await resolve(), { status: "invalid" });
			assert.deepEqual(reports, []);
		}
	});
});

describe("redirect cookie propagation", () => {
	it("copies refreshed and cleared cookies onto redirects", () => {
		const response = NextResponse.next();
		response.cookies.set("sb-access-token", "refreshed", { httpOnly: true });
		response.cookies.set("sb-refresh-token", "", { maxAge: 0 });
		const cookies = redirectWithSessionCookies(
			new URL("http://localhost/login"),
			response,
		)
			.headers.getSetCookie()
			.join("\n");
		assert.match(cookies, /sb-access-token=refreshed/);
		assert.match(cookies, /sb-refresh-token=;.*Max-Age=0/);
	});
});

describe("production cookie policy", () => {
	it("requires Secure on production session cookies without changing development options", () => {
		assert.deepEqual(
			enforceSecureCookieOptions({ sameSite: "lax" }, "production"),
			{ sameSite: "lax", secure: true },
		);
		assert.deepEqual(
			enforceSecureCookieOptions({ sameSite: "lax" }, "development"),
			{ sameSite: "lax" },
		);
	});
});

describe("proxy session refresher", () => {
	it("times out a never-settling provider", async () => {
		const reports: string[] = [];
		const refresh = createProxySessionRefresher(
			{
				getRequestCookies: () => [],
				setRequestCookie: () => {},
				setResponseCookie: () => {},
			},
			() => ({ auth: { getUser: () => new Promise<never>(() => {}) } }),
			(event) => reports.push(event),
			0,
		);
		assert.deepEqual(await refresh(), { status: "unavailable" });
		assert.deepEqual(reports, ["supabase_get_user_failed"]);
	});
	it("uses getUser once and propagates refreshed cookies to request and response", async () => {
		const requestCookies: Array<{ name: string; value: string }> = [];
		const responseCookies: Array<{
			name: string;
			value: string;
			options?: object;
		}> = [];
		let getUserCalls = 0;
		const refresh = createProxySessionRefresher(
			{
				getRequestCookies: () => [{ name: "old", value: "cookie" }],
				setRequestCookie: (name: string, value: string) =>
					requestCookies.push({ name, value }),
				setResponseCookie: (name: string, value: string, options?: object) =>
					responseCookies.push({ name, value, options }),
			},
			(cookies) => {
				assert.deepEqual(cookies.getAll(), [{ name: "old", value: "cookie" }]);
				cookies.setAll([
					{ name: "sb-session", value: "fresh", options: { httpOnly: true } },
				]);
				return {
					auth: {
						getUser: async () => {
							getUserCalls += 1;
							return {
								data: { user: null },
								error: { name: "AuthSessionMissingError" },
							};
						},
					},
				};
			},
		);

		assert.deepEqual(await refresh(), { status: "anonymous" });
		assert.equal(getUserCalls, 1);
		assert.deepEqual(requestCookies, [{ name: "sb-session", value: "fresh" }]);
		assert.deepEqual(responseCookies, [
			{ name: "sb-session", value: "fresh", options: { httpOnly: true } },
		]);
	});

	it("reports provider outages using a stable event without provider details", async () => {
		const reports: string[] = [];
		const refresh = createProxySessionRefresher(
			{
				getRequestCookies: () => [],
				setRequestCookie: () => {},
				setResponseCookie: () => {},
			},
			() => ({
				auth: {
					getUser: async () => {
						throw new Error("secret provider detail");
					},
				},
			}),
			(event) => reports.push(event),
		);
		assert.deepEqual(await refresh(), { status: "unavailable" });
		assert.deepEqual(reports, ["supabase_get_user_failed"]);
	});

	it("keeps unavailable when the proxy failure reporter throws", async () => {
		const refresh = createProxySessionRefresher(
			{
				getRequestCookies: () => [],
				setRequestCookie: () => {},
				setResponseCookie: () => {},
			},
			() => ({
				auth: {
					getUser: async () => {
						throw new Error("provider");
					},
				},
			}),
			() => {
				throw new Error("reporter");
			},
		);
		assert.deepEqual(await refresh(), { status: "unavailable" });
	});

	it("keeps provider outages distinct from invalid sessions", async () => {
		const refresh = createProxySessionRefresher(
			{
				getRequestCookies: () => [],
				setRequestCookie: () => {},
				setResponseCookie: () => {},
			},
			() => ({
				auth: {
					getUser: async () => ({
						data: { user: null },
						error: { name: "FetchError" },
					}),
				},
			}),
		);
		assert.deepEqual(await refresh(), { status: "unavailable" });
	});

	it("does not report expected 400 and 403 invalid-session responses", async () => {
		for (const status of [400, 403]) {
			const reports: string[] = [];
			const refresh = createProxySessionRefresher(
				{
					getRequestCookies: () => [],
					setRequestCookie: () => {},
					setResponseCookie: () => {},
				},
				() => ({
					auth: {
						getUser: async () => ({ data: { user: null }, error: { status } }),
					},
				}),
				(event) => reports.push(event),
			);
			assert.deepEqual(await refresh(), { status: "invalid" });
			assert.deepEqual(reports, []);
		}
	});
});
