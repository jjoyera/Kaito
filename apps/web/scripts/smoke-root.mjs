import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const defaultPort = process.env.KAITO_WEB_SMOKE_PORT ?? "3100";
export const expectedText = "Project scaffold is running";
export const defaultTimeoutMs = 30_000;
export const defaultPollMs = 1_000;

export function stopServer(
	server,
	{ isWindows, killProcess = process.kill } = {},
) {
	if (!server.pid || server.killed) {
		return;
	}

	try {
		if (isWindows) {
			server.kill("SIGTERM");
		} else {
			killProcess(-server.pid, "SIGTERM");
		}
	} catch (error) {
		if (error.code !== "ESRCH") {
			throw error;
		}
	}
}

export async function waitForHomePage({
	url,
	expectedText,
	timeoutMs = defaultTimeoutMs,
	pollMs = defaultPollMs,
	fetchPage = fetch,
	sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	now = Date.now,
	getSpawnError = () => undefined,
	getExitState = () => undefined,
}) {
	const startedAt = now();
	let lastError;

	while (now() - startedAt < timeoutMs) {
		const spawnError = getSpawnError();
		if (spawnError) {
			throw spawnError;
		}

		const exitState = getExitState();
		if (exitState) {
			throw new Error(
				`Next.js dev server exited early with code ${exitState.code} and signal ${exitState.signal}`,
			);
		}

		try {
			const response = await fetchPage(url);
			const body = await response.text();

			if (!response.ok) {
				throw new Error(`Expected HTTP 2xx, received ${response.status}`);
			}

			if (!body.includes(expectedText)) {
				throw new Error(`Expected page to contain: ${expectedText}`);
			}

			return;
		} catch (error) {
			lastError = error;
			await sleep(pollMs);
		}
	}

	throw new Error(
		`Web smoke check failed for ${url}: ${lastError?.message ?? "timeout"}`,
	);
}

export async function runSmoke({
	port = defaultPort,
	spawnProcess = spawn,
	platform = process.platform,
	stdout = process.stdout,
	stderr = process.stderr,
	fetchPage = fetch,
	killProcess = process.kill,
} = {}) {
	const url = `http://127.0.0.1:${port}`;
	const isWindows = platform === "win32";
	const server = spawnProcess(
		"pnpm",
		["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", port],
		{
			cwd: new URL("..", import.meta.url),
			detached: !isWindows,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				PORT: port,
			},
		},
	);

	let logs = "";
	let spawnError;
	let exitState;
	server.stdout?.on("data", (chunk) => {
		logs += chunk.toString();
	});
	server.stderr?.on("data", (chunk) => {
		logs += chunk.toString();
	});
	server.on("error", (error) => {
		spawnError = error;
		logs += `\nFailed to start Next.js dev server: ${error.message}`;
	});
	server.on("exit", (code, signal) => {
		exitState = { code, signal };
	});

	try {
		await waitForHomePage({
			url,
			expectedText,
			fetchPage,
			getSpawnError: () => spawnError,
			getExitState: () => exitState,
		});
		stdout.write(`Web smoke check passed: ${url}\n`);
	} catch (error) {
		stderr.write(`${error.message}\n`);
		stderr.write(`\nNext.js output:\n${logs.trim()}\n`);
		throw error;
	} finally {
		stopServer(server, { isWindows, killProcess });
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	runSmoke().catch(() => {
		process.exitCode = 1;
	});
}
