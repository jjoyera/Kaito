import { spawn } from "node:child_process";

const port = process.env.KAITO_WEB_SMOKE_PORT ?? "3100";
const url = `http://127.0.0.1:${port}`;
const expectedText = "Project scaffold is running";
const timeoutMs = 30_000;

const server = spawn(
	"pnpm",
	["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", port],
	{
		cwd: new URL("..", import.meta.url),
		stdio: ["ignore", "pipe", "pipe"],
		env: {
			...process.env,
			PORT: port,
		},
	},
);

let logs = "";
server.stdout.on("data", (chunk) => {
	logs += chunk.toString();
});
server.stderr.on("data", (chunk) => {
	logs += chunk.toString();
});

function stopServer() {
	if (!server.killed) {
		server.kill("SIGTERM");
	}
}

async function waitForHomePage() {
	const startedAt = Date.now();
	let lastError;

	while (Date.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(url);
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
			await new Promise((resolve) => setTimeout(resolve, 1_000));
		}
	}

	throw new Error(
		`Web smoke check failed for ${url}: ${lastError?.message ?? "timeout"}`,
	);
}

try {
	await waitForHomePage();
	process.stdout.write(`Web smoke check passed: ${url}\n`);
} catch (error) {
	console.error(error.message);
	console.error("\nNext.js output:\n", logs.trim());
	process.exitCode = 1;
} finally {
	stopServer();
}
