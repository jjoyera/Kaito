import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBrowserSupabaseClient } from "./browser";
import { createServerSessionResolver } from "./server";
import { createProxySessionRefresher } from "./proxy";

describe("browser session client", () => {
	it("creates a browser client only from the explicit public configuration", () => {
		const calls: Array<[string, string]> = [];
		const client = { auth: {} };
		assert.equal(
			createBrowserSupabaseClient(
				{
					url: "https://project.supabase.co",
					publishableKey: "sb_publishable_test",
				},
				(url, key) => {
					calls.push([url, key]);
					return client;
				},
			),
			client,
		);
		assert.deepEqual(calls, [
			["https://project.supabase.co", "sb_publishable_test"],
		]);
	});
});

describe("server session resolver", () => {
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
});

describe("proxy session refresher", () => {
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
});
