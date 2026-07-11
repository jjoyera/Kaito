import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PrivateApiError, privateFetch } from "./private-fetch";

const response = (status: number) => new Response(null, { status });

describe("privateFetch", () => {
	it("gets a fresh token for each relative request and attaches it once", async () => {
		const requests: Request[] = [];
		let tokenCalls = 0;
		const getAccessToken = async () => `token-${++tokenCalls}`;
		const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
			requests.push(new Request(input, init));
			return response(200);
		};

		await privateFetch(
			"/auth/me",
			{},
			{ getAccessToken, fetcher, apiBaseUrl: "https://api.kaito.test" },
		);
		await privateFetch(
			"/auth/me",
			{},
			{ getAccessToken, fetcher, apiBaseUrl: "https://api.kaito.test" },
		);

		assert.equal(tokenCalls, 2);
		assert.equal(requests.length, 2);
		assert.equal(requests[0]?.headers.get("authorization"), "Bearer token-1");
		assert.equal(requests[1]?.headers.get("authorization"), "Bearer token-2");
	});

	it("rejects unsafe caller inputs without a request or token leakage", async () => {
		let fetchCalls = 0;
		const dependencies = {
			getAccessToken: async () => "secret-token",
			fetcher: async () => {
				fetchCalls += 1;
				return response(200);
			},
		};

		await assert.rejects(
			() =>
				privateFetch(
					"https://attacker.example",
					{},
					{ ...dependencies, apiBaseUrl: "https://api.kaito.test" },
				),
			(error: unknown) =>
				error instanceof PrivateApiError && error.kind === "request_failed",
		);
		await assert.rejects(
			() =>
				privateFetch(
					"/auth/me",
					{ headers: { authorization: "Bearer override" } },
					{ ...dependencies, apiBaseUrl: "https://api.kaito.test" },
				),
			(error: unknown) =>
				error instanceof PrivateApiError && error.kind === "request_failed",
		);
		assert.equal(fetchCalls, 0);
	});

	it("normalizes token, URL, and network exceptions without provider details", async () => {
		const providerMessage = "provider secret detail";
		for (const invoke of [
			() =>
				privateFetch(
					"/auth/me",
					{},
					{
						getAccessToken: async () => {
							throw new Error(providerMessage);
						},
						fetcher: async () => response(200),
						apiBaseUrl: "https://api.kaito.test",
					},
				),
			() =>
				privateFetch(
					"/auth/me",
					{},
					{
						getAccessToken: async () => "token",
						fetcher: async () => response(200),
						apiBaseUrl: "not a url",
					},
				),
			() =>
				privateFetch(
					"/auth/me",
					{},
					{
						getAccessToken: async () => "token",
						fetcher: async () => {
							throw new Error(providerMessage);
						},
						apiBaseUrl: "https://api.kaito.test",
					},
				),
		]) {
			await assert.rejects(
				invoke,
				(error: unknown) =>
					error instanceof PrivateApiError &&
					error.kind === "request_failed" &&
					!error.message.includes(providerMessage),
			);
		}
	});

	it("sanitizes every other non-success response without backend detail leakage", async () => {
		const backendDetail = "secret backend failure detail";
		for (const status of [403, 404, 500, 502]) {
			await assert.rejects(
				() =>
					privateFetch(
						"/auth/me",
						{},
						{
							getAccessToken: async () => "token",
							fetcher: async () => new Response(backendDetail, { status }),
							apiBaseUrl: "https://api.kaito.test",
						},
					),
				(error: unknown) =>
					error instanceof PrivateApiError &&
					error.kind === "request_failed" &&
					!error.message.includes(backendDetail),
			);
		}
	});

	it("does not issue a request without a token and maps 401 and 503 distinctly", async () => {
		let fetchCalls = 0;
		await assert.rejects(
			() =>
				privateFetch(
					"/auth/me",
					{},
					{
						getAccessToken: async () => undefined,
						fetcher: async () => {
							fetchCalls += 1;
							return response(200);
						},
						apiBaseUrl: "https://api.kaito.test",
					},
				),
			(error: unknown) =>
				error instanceof PrivateApiError && error.kind === "auth_required",
		);
		assert.equal(fetchCalls, 0);

		for (const [status, kind] of [
			[401, "auth_rejected"],
			[503, "auth_unavailable"],
		] as const) {
			await assert.rejects(
				() =>
					privateFetch(
						"/auth/me",
						{},
						{
							getAccessToken: async () => "token",
							fetcher: async () => response(status),
							apiBaseUrl: "https://api.kaito.test",
						},
					),
				(error: unknown) =>
					error instanceof PrivateApiError && error.kind === kind,
			);
		}
	});
});
