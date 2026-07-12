import assert from "node:assert/strict";
import { test } from "node:test";

import { NextRequest, NextResponse } from "next/server";

import { isLoopbackRequest, redirectWithSessionCookies } from "./proxy";

function loopbackRequest(
	url: string,
	headers: Record<string, string> = {},
): NextRequest {
	return new NextRequest(url, { headers });
}

test("rejects hostile and invalid host values for the E2E bypass", () => {
	assert.equal(
		isLoopbackRequest(
			loopbackRequest("http://127.0.0.1/login", {
				host: "127.999.999.999",
			}),
		),
		false,
	);
	assert.equal(
		isLoopbackRequest(
			loopbackRequest("http://127.0.0.1/login", {
				host: "127.0.0.1",
				"x-forwarded-host": "attacker.example",
			}),
		),
		false,
	);
	assert.equal(
		isLoopbackRequest(
			loopbackRequest("http://127.0.0.1/login", {
				host: "127.0.0.1",
				"x-forwarded-host": "127.999.999.999",
			}),
		),
		false,
	);
	assert.equal(
		isLoopbackRequest(
			loopbackRequest("http://[::1]/login", { host: "[::1]attacker.example" }),
		),
		false,
	);
});

test("accepts valid IPv4 and IPv6 loopback hosts for the E2E bypass", () => {
	assert.equal(
		isLoopbackRequest(loopbackRequest("http://[::1]/login", { host: "[::1]" })),
		true,
	);
	assert.equal(
		isLoopbackRequest(
			loopbackRequest("http://127.0.0.1/login", { host: "127.255.255.255" }),
		),
		true,
	);
	assert.equal(
		isLoopbackRequest(
			loopbackRequest("http://[::1]/login", {
				host: "[::1]:3000",
				"x-forwarded-host": "[::1]:3000",
			}),
		),
		true,
	);
});

test("copies refreshed and cleared session cookies onto redirect responses", () => {
	const sessionResponse = NextResponse.next();
	sessionResponse.cookies.set("sb-access-token", "refreshed", {
		httpOnly: true,
	});
	sessionResponse.cookies.set("sb-refresh-token", "", { maxAge: 0 });

	const loginUrl = URL.parse("http://127.0.0.1:3000/login");
	assert.ok(loginUrl);

	const redirect = redirectWithSessionCookies(loginUrl, sessionResponse);
	const cookies = redirect.headers.getSetCookie().join("\n");

	assert.match(cookies, /sb-access-token=refreshed/);
	assert.match(cookies, /sb-refresh-token=;.*Max-Age=0/);
});
