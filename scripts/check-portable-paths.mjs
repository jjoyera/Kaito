import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { dirname, win32 } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BLOB_BYTES = 32 * 1024 * 1024;
const POSIX_GIT_CANDIDATES = ["/usr/bin/git", "/bin/git"];
const WINDOWS_GIT_ROOTS = [
	"C:\\Program Files\\Git",
	"C:\\Program Files (x86)\\Git",
];
const WINDOWS_GIT_CANDIDATES = WINDOWS_GIT_ROOTS.flatMap((root) => [
	`${root}\\cmd\\git.exe`,
	`${root}\\bin\\git.exe`,
]);
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
	if (
		/^[A-Za-z]$/u.test(text[driveStart] ?? "") &&
		text[driveStart + 1] === ":" &&
		/[\\/]/u.test(text[driveStart + 2] ?? "") &&
		text.startsWith("Users", driveStart + 3) &&
		/[\\/]/u.test(text[driveStart + 8] ?? "")
	)
		return driveStart + 9;
	return -1;
}

function endOfPath(text, start, separatorPattern) {
	let end = start;
	while (end < text.length && !FORBIDDEN.test(text[end])) {
		if (text[end] === ":") break;
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
	if (!uri && index > 0 && WORD_OR_URL.test(text[index - 1])) {
		if (text[index - 1] !== ":") return -1;
	}
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
		const protocolLength = text.startsWith("https://", index)
			? 8
			: text.startsWith("http://", index)
				? 7
				: 0;
		if (protocolLength && (index === 0 || FORBIDDEN.test(text[index - 1]))) {
			index += protocolLength;
			while (index < text.length && !FORBIDDEN.test(text[index])) index++;
			index--;
			continue;
		}
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
	return text.split(/\r?\n/u).flatMap((lineText, index) =>
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
export function resolveTrustedGit(overrides = {}) {
	const deps = {
		platform: process.platform,
		realpathSync,
		statSync,
		getuid: () => process.getuid?.(),
		...overrides,
	};
	if (deps.platform === "linux" || deps.platform === "darwin") {
		for (const candidate of deps.candidates ?? POSIX_GIT_CANDIDATES)
			if (candidate.startsWith("/") && trustedCandidate(candidate, deps))
				return candidate;
		throw new Error(
			"No trusted Git executable found in fixed system locations",
		);
	}
	if (deps.platform === "win32") {
		const roots = deps.approvedRoots ?? WINDOWS_GIT_ROOTS;
		for (const candidate of deps.candidates ?? WINDOWS_GIT_CANDIDATES) {
			try {
				const canonical = deps.realpathSync(candidate);
				const contained = roots.some((root) => {
					const relative = win32.relative(root, canonical);
					return (
						relative !== ".." &&
						!relative.startsWith(`..${win32.sep}`) &&
						!win32.isAbsolute(relative)
					);
				});
				if (
					canonical === candidate &&
					contained &&
					deps.statSync(candidate).isFile()
				)
					return candidate;
			} catch {
				/* reject candidate */
			}
		}
		throw new Error(
			"No trusted Git executable found in fixed system locations",
		);
	}
	throw new Error(
		`No trusted Git executable: unsupported platform ${deps.platform}`,
	);
}

function formatFinding(finding) {
	return `${finding.file}:${finding.location === "pathname" ? "pathname" : finding.line}: ${finding.match}`;
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
			return { mode: match[1], hash: match[2], file: match[3] };
		});
	const findings = [];
	const errors = [];
	const diagnostics = [];
	for (const { mode, file, hash } of entries) {
		const pathnameFindings = scanPathname(file);
		findings.push(...pathnameFindings);
		diagnostics.push(...pathnameFindings.map(formatFinding));
		if (mode === "160000") continue;
		let blob;
		try {
			blob = spawn(git, ["cat-file", "blob", hash], {
				encoding: "buffer",
				maxBuffer: MAX_BLOB_BYTES + 1,
			});
		} catch {
			blob = { status: null, error: new Error("spawn threw") };
		}
		if (blob?.status !== 0 || blob.error || !Buffer.isBuffer(blob.stdout)) {
			const message = `${file}: unable to read tracked blob ${hash}`;
			errors.push(message);
			diagnostics.push(message);
			continue;
		}
		try {
			const blobFindings = scanBuffer(file, blob.stdout);
			findings.push(...blobFindings);
			diagnostics.push(...blobFindings.map(formatFinding));
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: `${file}: unable to scan tracked blob ${hash}`;
			errors.push(message);
			diagnostics.push(message);
		}
	}
	if (errors.length) {
		const error = new Error(diagnostics.join("\n"));
		error.errors = errors;
		error.findings = findings;
		throw error;
	}
	return findings;
}

async function main() {
	try {
		const findings = runGitScan(resolveTrustedGit());
		for (const finding of findings) console.error(formatFinding(finding));
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
