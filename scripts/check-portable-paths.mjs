import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROFILE_PATH_PATTERN =
	/(?:file:(?:\/\/(?:localhost)?)?\/(?:home|Users)\/[^\s/\\`"'<>]+(?:\/[^\s`"'<>]*)?|file:(?:\/\/(?:localhost)?)?\/[A-Za-z]:[\\/]Users[\\/][^\s/\\`"'<>]+(?:[\\/][^\s`"'<>]*)?|(?<![\p{L}\p{N}:/])(?:\/(?:home|Users)\/[^\s/\\`"'<>]+(?:\/[^\s`"'<>]*)?|[A-Za-z]:[\\/]Users[\\/][^\s/\\`"'<>]+(?:[\\/][^\s`"'<>]*)?))/gu;
const MAX_BLOB_BYTES = 32 * 1024 * 1024;

export function findPortablePathMatches(text) {
	return [...text.matchAll(PROFILE_PATH_PATTERN)].map(({ 0: match }) =>
		match.replace(/[),.;:]+$/, ""),
	);
}

export function scanText(file, text) {
	const findings = [];
	for (const [index, lineText] of text.split(/\r?\n/).entries()) {
		for (const match of findPortablePathMatches(lineText)) {
			findings.push({ file, line: index + 1, match });
		}
	}
	return findings;
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
	if (content.length > MAX_BLOB_BYTES) {
		throw new Error(`${file}: tracked blob exceeds ${MAX_BLOB_BYTES} byte scan limit`);
	}
	return scanText(file, content.toString("utf8").replaceAll("\0", "�"));
}

async function main() {
	const listed = spawnSync("git", ["ls-files", "--stage", "-z"], { encoding: "buffer" });
	if (listed.status !== 0) {
		process.stderr.write(listed.stderr);
		process.exitCode = listed.status ?? 1;
		return;
	}

	const entries = listed.stdout
		.toString("utf8")
		.split("\0")
		.filter(Boolean)
		.map((entry) => {
			const match = /^(\d+) ([0-9a-f]+) 0\t([\s\S]+)$/.exec(entry);
			if (!match) throw new Error(`Unable to parse tracked index entry: ${entry}`);
			return { hash: match[2], file: match[3] };
		});
	const findings = entries.flatMap(({ file }) => scanPathname(file));
	for (const { file, hash } of entries) {
		const blob = spawnSync("git", ["cat-file", "blob", hash], {
			encoding: "buffer",
			maxBuffer: MAX_BLOB_BYTES + 1,
		});
		if (blob.status !== 0 || blob.error) {
			throw new Error(`${file}: unable to read tracked blob ${hash}`);
		}
		findings.push(...scanBuffer(file, blob.stdout));
	}

	for (const finding of findings) {
		const location = finding.location === "pathname" ? "pathname" : finding.line;
		console.error(`${finding.file}:${location}: ${finding.match}`);
	}
	if (findings.length > 0) {
		console.error(
			`Found ${findings.length} non-portable developer profile path(s).`,
		);
		process.exitCode = 1;
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	await main();
}
