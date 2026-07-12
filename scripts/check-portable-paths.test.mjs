import assert from "node:assert/strict";
import test from "node:test";

import {
	findPortablePathMatches,
	resolveTrustedGit,
	runGitScan,
	scanBuffer,
	scanPathname,
	scanText,
} from "./check-portable-paths.mjs";

const linuxPath = ["", "home", "developer", "work", "project"].join("/");
const macPath = ["", "Users", "developer", "work", "project"].join("/");
const windowsPath = ["C:", "Users", "developer", "work", "project"].join("\\");
const windowsSlashPath = ["C:", "Users", "developer", "work", "project"].join(
	"/",
);

test("findPortablePathMatches detects developer profile paths", () => {
	for (const sample of [linuxPath, macPath, windowsPath, windowsSlashPath]) {
		assert.deepEqual(findPortablePathMatches(`path: ${sample}`), [sample]);
	}
});

test("findPortablePathMatches ignores portable and unrelated paths", () => {
	const safe = [
		"<repo-root>/apps/web",
		"$HOME/.pi/agent/support.md",
		"apps/web/src/index.ts",
		"https://example.com/Users/developer/docs",
		".git/refs/heads/main",
	];

	for (const sample of safe) {
		assert.deepEqual(findPortablePathMatches(sample), []);
	}
});

test("findPortablePathMatches detects file URIs without flagging web URLs", () => {
	const fileUris = [
		`file:${linuxPath}`,
		`file://${linuxPath}`,
		`file://localhost${linuxPath}`,
		`file://${macPath}`,
		`file://localhost${macPath}`,
		`file:///${windowsSlashPath}`,
		`file://localhost/${windowsSlashPath}`,
	];
	for (const sample of fileUris) {
		assert.equal(findPortablePathMatches(sample).length, 1);
	}
	assert.deepEqual(
		findPortablePathMatches(`https://example.com${macPath}`),
		[],
	);
});

test("findPortablePathMatches detects Unicode profile names", () => {
	const samples = [
		["", "home", "développeur", "project"].join("/"),
		["", "Users", "工程師", "project"].join("/"),
		["D:", "Users", "Ирина", "project"].join("\\"),
	];
	for (const sample of samples) {
		assert.deepEqual(findPortablePathMatches(sample), [sample]);
	}
});

test("findPortablePathMatches handles adversarial near-matches and exact boundaries", () => {
	const nearMatch = `${"file://localhost/homX/".repeat(100_000)} `;
	assert.deepEqual(findPortablePathMatches(nearMatch), []);
	assert.deepEqual(findPortablePathMatches(`x${linuxPath}`), []);
	assert.deepEqual(findPortablePathMatches(`:${linuxPath}`), []);
	assert.deepEqual(findPortablePathMatches(`(${linuxPath})`), [linuxPath]);
});

test("findPortablePathMatches keeps adjacent matches ordered and unique", () => {
	assert.deepEqual(
		findPortablePathMatches(`${linuxPath},${macPath} ${linuxPath}`),
		[linuxPath, macPath, linuxPath],
	);
});

test("findPortablePathMatches iterates over 10,000 punctuation-separated matches", () => {
	const expected = Array.from(
		{ length: 10_000 },
		(_, index) => ["", "home", "developer", `project-${index}`].join("/"),
	);
	assert.deepEqual(findPortablePathMatches(expected.join(",")), expected);
});

test("trusted git resolution accepts root-owned 0755 git for effective UID 0", () => {
	const stats = new Map([
		["/usr/bin/git", { isFile: () => true, mode: 0o100755, uid: 0 }],
		["/usr/bin", { isFile: () => false, mode: 0o40755, uid: 0 }],
		["/usr", { isFile: () => false, mode: 0o40755, uid: 0 }],
		["/", { isFile: () => false, mode: 0o40755, uid: 0 }],
	]);
	assert.equal(
		resolveTrustedGit({
			realpathSync: (path) => path,
			statSync: (path) => stats.get(path),
			getuid: () => 0,
		}),
		"/usr/bin/git",
	);
});

test("trusted git resolution accepts fixed safe candidates and rejects writable ones", () => {
	const stats = new Map([
		["/usr/bin/git", { isFile: () => true, mode: 0o100755, uid: 0 }],
		["/usr/bin", { isFile: () => false, mode: 0o40755, uid: 0 }],
		["/usr", { isFile: () => false, mode: 0o40755, uid: 0 }],
		["/", { isFile: () => false, mode: 0o40755, uid: 0 }],
	]);
	const deps = {
		realpathSync: (path) => path,
		statSync: (path) => stats.get(path),
		getuid: () => 1000,
	};
	assert.equal(resolveTrustedGit(deps), "/usr/bin/git");
	stats.get("/usr/bin").mode = 0o40777;
	assert.throws(() => resolveTrustedGit(deps), /No trusted Git executable/);
	stats.get("/usr/bin").mode = 0o40755;
	stats.get("/usr/bin").uid = 1000;
	assert.throws(() => resolveTrustedGit(deps), /No trusted Git executable/);
	stats.get("/usr/bin").uid = 1234;
	assert.throws(() => resolveTrustedGit(deps), /No trusted Git executable/);
});

test("scanner ignores PATH and reuses the resolved absolute git", () => {
	const calls = [];
	const spawn = (executable, args) => {
		calls.push([executable, args]);
		if (args[0] === "ls-files")
			return {
				status: 0,
				stdout: Buffer.from("100644 abc 0\tnotes.md\0"),
				stderr: Buffer.alloc(0),
			};
		return { status: 0, stdout: Buffer.from("safe"), stderr: Buffer.alloc(0) };
	};
	assert.deepEqual(runGitScan("/usr/bin/git", spawn), []);
	assert.deepEqual(
		calls.map(([executable]) => executable),
		["/usr/bin/git", "/usr/bin/git"],
	);
});

test("git resolution fails closed when no fixed candidate is trusted", () => {
	assert.throws(
		() =>
			resolveTrustedGit({
				realpathSync: () => {
					throw new Error("missing");
				},
				statSync: () => {
					throw new Error("missing");
				},
			}),
		/No trusted Git executable/,
	);
});

test("runGitScan fails closed for process and repository failures", () => {
	const index = Buffer.from("100644 abc 0\tnotes.md\0");
	assert.throws(() => runGitScan("/usr/bin/git", () => ({ status: null, error: new Error("spawn") })), /Unable to list/);
	assert.throws(() => runGitScan("/usr/bin/git", () => ({ status: 1, stdout: Buffer.alloc(0) })), /Unable to list/);
	assert.throws(() => runGitScan("/usr/bin/git", () => ({ status: 0, stdout: Buffer.from("malformed\0") })), /Unable to parse/);
	assert.throws(
		() => runGitScan("/usr/bin/git", (_git, args) => args[0] === "ls-files" ? { status: 0, stdout: index } : { status: 1, stdout: Buffer.alloc(0) }),
		/unable to read tracked blob/,
	);
	const oversized = Buffer.alloc(32 * 1024 * 1024 + 1);
	assert.throws(
		() => runGitScan("/usr/bin/git", (_git, args) => args[0] === "ls-files" ? { status: 0, stdout: index } : { status: 0, stdout: oversized }),
		/exceeds .* scan limit/,
	);
});

test("scanText reports each finding with its one-based line number", () => {
	assert.deepEqual(scanText("notes.md", `safe\n${linuxPath}\n${macPath}`), [
		{ file: "notes.md", line: 2, match: linuxPath },
		{ file: "notes.md", line: 3, match: macPath },
	]);
});

test("scanBuffer does not let a NUL hide a disclosure in a text file", () => {
	const content = Buffer.from(`heading\0\n${linuxPath}\n`);
	assert.deepEqual(scanBuffer("notes.md", content), [
		{ file: "notes.md", line: 2, match: linuxPath },
	]);
});

test("scanBuffer scans disclosures after the former two MiB boundary", () => {
	const content = Buffer.concat([
		Buffer.alloc(2 * 1024 * 1024 + 17, "x"),
		Buffer.from(`\n${linuxPath}\n`),
	]);
	assert.equal(scanBuffer("large.bin", content).at(-1)?.match, linuxPath);
});

test("scanBuffer does not let NULs or names hide disclosures", () => {
	for (const file of ["settings", ".env"]) {
		const content = Buffer.from(`binary-ish\0\x01\n${linuxPath}\n`);
		assert.equal(scanBuffer(file, content).at(-1)?.match, linuxPath);
	}
});

test("scanBuffer conservatively ignores binary data without a path", () => {
	assert.deepEqual(scanBuffer("image.png", Buffer.from("\0\x01\x02")), []);
});

test("scanPathname reports profile paths embedded in tracked names", () => {
	const exposedPath = ["", "home", "developer", "notes.md"].join("/");
	const pathname = `leak-${exposedPath}`;
	assert.deepEqual(scanPathname(pathname), [
		{ file: pathname, line: 0, match: exposedPath, location: "pathname" },
	]);
});
