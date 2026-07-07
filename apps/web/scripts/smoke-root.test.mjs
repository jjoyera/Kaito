import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import { runSmoke, stopServer, waitForHomePage } from "./smoke-root.mjs";

test("stopServer terminates the process group on POSIX", () => {
	const calls = [];
	const server = { pid: 1234, killed: false };

	stopServer(server, {
		isWindows: false,
		killProcess: (...args) => calls.push(args),
	});

	assert.deepEqual(calls, [[-1234, "SIGTERM"]]);
});

test("stopServer terminates only the child process on Windows", () => {
	const calls = [];
	const server = {
		pid: 1234,
		killed: false,
		kill: (...args) => calls.push(args),
	};

	stopServer(server, { isWindows: true });

	assert.deepEqual(calls, [["SIGTERM"]]);
});

test("stopServer ignores an already exited process", () => {
	const error = new Error("missing process");
	error.code = "ESRCH";

	assert.doesNotThrow(() => {
		stopServer(
			{ pid: 1234, killed: false },
			{
				isWindows: false,
				killProcess: () => {
					throw error;
				},
			},
		);
	});
});

test("waitForHomePage fails fast on spawn errors", async () => {
	const spawnError = new Error("spawn ENOENT");

	await assert.rejects(
		waitForHomePage({
			url: "http://127.0.0.1:3100",
			expectedText: "Project scaffold is running",
			fetchPage: async () => assert.fail("fetch should not run"),
			getSpawnError: () => spawnError,
		}),
		/spawn ENOENT/,
	);
});

test("waitForHomePage fails fast when the server exits early", async () => {
	await assert.rejects(
		waitForHomePage({
			url: "http://127.0.0.1:3100",
			expectedText: "Project scaffold is running",
			fetchPage: async () => assert.fail("fetch should not run"),
			getExitState: () => ({ code: 1, signal: null }),
		}),
		/exited early with code 1/,
	);
});

test("waitForHomePage passes when the expected page text is present", async () => {
	let now = 0;

	await waitForHomePage({
		url: "http://127.0.0.1:3100",
		expectedText: "Project scaffold is running",
		now: () => now,
		sleep: async () => {
			now += 1;
		},
		fetchPage: async () => ({
			ok: true,
			status: 200,
			text: async () => "<h1>Project scaffold is running.</h1>",
		}),
	});
});

test("runSmoke starts the server, verifies the page, and cleans up", async () => {
	const calls = [];
	const server = new EventEmitter();
	server.pid = 1234;
	server.killed = false;
	server.stdout = new EventEmitter();
	server.stderr = new EventEmitter();

	await runSmoke({
		port: "3200",
		platform: "linux",
		spawnProcess: (...args) => {
			calls.push(["spawn", ...args]);
			return server;
		},
		fetchPage: async () => ({
			ok: true,
			status: 200,
			text: async () => "Project scaffold is running.",
		}),
		killProcess: (...args) => calls.push(["kill", ...args]),
		stdout: { write: (message) => calls.push(["stdout", message]) },
		stderr: { write: (message) => calls.push(["stderr", message]) },
	});

	assert.equal(server.listenerCount("error"), 1);
	assert.equal(server.listenerCount("exit"), 1);
	assert.deepEqual(calls.at(-1), ["kill", -1234, "SIGTERM"]);
	assert.match(
		calls.find(([type]) => type === "stdout")?.[1],
		/Web smoke check passed/,
	);
});

test("runSmoke propagates spawn errors and still cleans up", async () => {
	const calls = [];
	const server = new EventEmitter();
	server.pid = 1234;
	server.killed = false;
	server.stdout = new EventEmitter();
	server.stderr = new EventEmitter();

	await assert.rejects(
		runSmoke({
			port: "3200",
			platform: "linux",
			spawnProcess: () => {
				queueMicrotask(() => server.emit("error", new Error("spawn failed")));
				return server;
			},
			fetchPage: async () => {
				await Promise.resolve();
				throw new Error("not ready");
			},
			killProcess: (...args) => calls.push(["kill", ...args]),
			stdout: { write: (message) => calls.push(["stdout", message]) },
			stderr: { write: (message) => calls.push(["stderr", message]) },
		}),
		/spawn failed/,
	);

	assert.deepEqual(calls.at(-1), ["kill", -1234, "SIGTERM"]);
	assert.match(calls.find(([type]) => type === "stderr")?.[1], /spawn failed/);
});
