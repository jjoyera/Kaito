import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BLOB_BYTES = 32 * 1024 * 1024;
const FIXED_GIT_CANDIDATES = ["/usr/bin/git", "/bin/git"];
const FORBIDDEN = /[\s`"'<>]/u;
const WORD_OR_URL = /[\p{L}\p{N}:/]/u;

function pathRootEnd(text, index) {
	let pathStart = index;
	if (text.startsWith("file:", index)) {
		pathStart += 5;
		if (text.startsWith("//localhost", pathStart)) pathStart += 11;
		else if (text.startsWith("//", pathStart)) pathStart += 2;
	}
	if (text.startsWith("/home/", pathStart)) return pathStart + 6;
	if (text.startsWith("/Users/", pathStart)) return pathStart + 7;
	const driveStart = text[pathStart] === "/" ? pathStart + 1 : pathStart;
	if (/^[A-Za-z]$/u.test(text[driveStart] ?? "") && text[driveStart + 1] === ":" && /[\\/]/u.test(text[driveStart + 2] ?? "") && text.startsWith("Users", driveStart + 3) && /[\\/]/u.test(text[driveStart + 8] ?? "")) return driveStart + 9;
	return -1;
}

function endOfPath(text, start, separatorPattern) {
	let end = start;
	while (end < text.length && !FORBIDDEN.test(text[end])) {
		if (/[),.;]/u.test(text[end]) && pathRootEnd(text, end + 1) >= 0) break;
		end++;
	}
	while (end > start && /[),.;:]/u.test(text[end - 1])) end--;
	const value = text.slice(start, end);
	const profile = value.split(separatorPattern)[0];
	return profile && !FORBIDDEN.test(profile) ? end : -1;
}

function parseAt(text, index) {
	let pathStart = index;
	let uri = false;
	if (text.startsWith("file:", index)) {
		uri = true;
		pathStart += 5;
		if (text.startsWith("//localhost", pathStart)) pathStart += 11;
		else if (text.startsWith("//", pathStart)) pathStart += 2;
	}
	if (!uri && index > 0 && WORD_OR_URL.test(text[index - 1])) return -1;
	for (const root of ["/home/", "/Users/"]) {
		if (text.startsWith(root, pathStart))
			return endOfPath(text, pathStart + root.length, /[\\/]/u);
	}
	const driveStart = text[pathStart] === "/" ? pathStart + 1 : pathStart;
	if (
		/^[A-Za-z]$/u.test(text[driveStart] ?? "") &&
		text[driveStart + 1] === ":" &&
		/[\\/]/u.test(text[driveStart + 2] ?? "") &&
		text.startsWith("Users", driveStart + 3) &&
		/[\\/]/u.test(text[driveStart + 8] ?? "")
	) {
		return endOfPath(text, driveStart + 9, /[\\/]/u);
	}
	return -1;
}

export function findPortablePathMatches(text) {
	const matches = [];
	for (let index = 0; index < text.length; index++) {
		if (
			text[index] !== "/" &&
			text[index] !== "f" &&
			!/[A-Za-z]/u.test(text[index])
		)
			continue;
		const end = parseAt(text, index);
		if (end > index) {
			matches.push(text.slice(index, end));
			index = end - 1;
		}
	}
	return matches;
}

export function scanText(file, text) {
	return text
		.split(/\r?\n/u)
		.flatMap((lineText, index) =>
			findPortablePathMatches(lineText).map((match) => ({
				file,
				line: index + 1,
				match,
			})),
		);
}
export function scanPathname(file) {
	return findPortablePathMatches(file).map((match) => ({
		file,
		line: 0,
		match,
		location: "pathname",
	}));
}
export function scanBuffer(file, content) {
	if (content.length > MAX_BLOB_BYTES)
		throw new Error(
			`${file}: tracked blob exceeds ${MAX_BLOB_BYTES} byte scan limit`,
		);
	return scanText(file, content.toString("utf8").replaceAll("\0", "�"));
}

function trustedCandidate(candidate, deps) {
	try {
		if (
			deps.realpathSync(candidate) !== candidate ||
			!deps.statSync(candidate).isFile()
		)
			return false;
		const effectiveUid = deps.getuid();
		if (!Number.isInteger(effectiveUid)) return false;
		for (let path = candidate; ; path = dirname(path)) {
			const stat = deps.statSync(path);
			if (stat.uid !== 0 || (stat.mode & 0o022) !== 0) return false;
			if (
				effectiveUid !== 0 &&
				stat.uid === effectiveUid &&
				(stat.mode & 0o200) !== 0
			)
				return false;
			if (path === "/") break;
		}
		return true;
	} catch {
		return false;
	}
}
export function resolveTrustedGit(deps = {
	realpathSync,
	statSync,
	getuid: () => process.getuid?.(),
}) {
	if (process.platform !== "linux")
		throw new Error(
			`No trusted Git executable: unsupported platform ${process.platform}`,
		);
	for (const candidate of FIXED_GIT_CANDIDATES)
		if (trustedCandidate(candidate, deps)) return candidate;
	throw new Error("No trusted Git executable found in fixed system locations");
}

export function runGitScan(git, spawn = spawnSync) {
	const listed = spawn(git, ["ls-files", "--stage", "-z"], {
		encoding: "buffer",
	});
	if (listed.status !== 0 || listed.error)
		throw new Error("Unable to list canonical tracked index entries");
	const entries = listed.stdout
		.toString("utf8")
		.split("\0")
		.filter(Boolean)
		.map((entry) => {
			const match = /^(\d+) ([0-9a-f]+) 0\t([\s\S]+)$/u.exec(entry);
			if (!match)
				throw new Error(`Unable to parse tracked index entry: ${entry}`);
			return { hash: match[2], file: match[3] };
		});
	const findings = entries.flatMap(({ file }) => scanPathname(file));
	for (const { file, hash } of entries) {
		const blob = spawn(git, ["cat-file", "blob", hash], {
			encoding: "buffer",
			maxBuffer: MAX_BLOB_BYTES + 1,
		});
		if (blob.status !== 0 || blob.error)
			throw new Error(`${file}: unable to read tracked blob ${hash}`);
		findings.push(...scanBuffer(file, blob.stdout));
	}
	return findings;
}

async function main() {
	try {
		const findings = runGitScan(resolveTrustedGit());
		for (const finding of findings)
			console.error(
				`${finding.file}:${finding.location === "pathname" ? "pathname" : finding.line}: ${finding.match}`,
			);
		if (findings.length) {
			console.error(
				`Found ${findings.length} non-portable developer profile path(s).`,
			);
			process.exitCode = 1;
		}
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
	await main();
