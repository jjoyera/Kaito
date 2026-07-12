import assert from "node:assert/strict";
import { test } from "node:test";

import { NextResponse } from "next/server";

import { redirectWithSessionCookies } from "./proxy";

test("copies refreshed and cleared session cookies onto redirect responses", () => {
	const sessionResponse = NextResponse.next();
	sessionResponse.cookies.set("sb-access-token", "refreshed", {
		httpOnly: true,
	});
	sessionResponse.cookies.set("sb-refresh-token", "", { maxAge: 0 });

	const redirect = redirectWithSessionCookies(
		new URL("http://127.0.0.1:3000/login"),
		sessionResponse,
	);
	const cookies = redirect.headers.getSetCookie().join("\n");

	assert.match(cookies, /sb-access-token=refreshed/);
	assert.match(cookies, /sb-refresh-token=;.*Max-Age=0/);
});
