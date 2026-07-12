import assert from "node:assert/strict";
import test from "node:test";

import {
	findPortablePathMatches,
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
	assert.deepEqual(findPortablePathMatches(`https://example.com${macPath}`), []);
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
