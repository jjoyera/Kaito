import type { ErrorEvent, Event, init as _sentryInit } from "@sentry/nextjs";

type TransactionEvent = Event & { type: "transaction" };

const REDACTED = "[redacted]";
const REDACTED_PATH = "[redacted-path]";
// Keep only low-cardinality technical values from free-form payload sections.
const SAFE_KEYS = new Set([
	"runtime",
	"component",
	"operation",
	"statusCode",
	"errorName",
	"release",
	"environment",
]);
const DENIED_KEYWORDS = [
	"token",
	"secret",
	"password",
	"apikey",
	"api_key",
	"authorization",
	"cookie",
	"session",
	"supabase",
	"strava",
	"access_token",
	"refresh_token",
	"jwt",
	"bearer",
	"email",
	"phone",
	"lat",
	"lon",
	"latitude",
	"longitude",
	"gps",
	"coordinates",
	"activity",
	"workout",
	"hr",
	"heartrate",
	"athlete",
] as const;
// Short keywords (≤ 3 chars) are common English substrings that would produce
// false positives with simple `.includes()` matching (e.g. "lat" in "platform",
// "hr" in "threshold", "lon" in "belongs_to"). They must appear as a whole
// delimited token (word-boundary via `_`, `-`, `.`, or string start/end).
// Literals are used instead of dynamic `new RegExp()` so patterns are auditable.
const SHORT_DENY_REGEXES: ReadonlyArray<RegExp> = [
	/(?:^|[_\-.])hr(?:$|[_\-.])/i,
	/(?:^|[_\-.])lat(?:$|[_\-.])/i,
	/(?:^|[_\-.])lon(?:$|[_\-.])/i,
	/(?:^|[_\-.])jwt(?:$|[_\-.])/i,
	/(?:^|[_\-.])gps(?:$|[_\-.])/i,
];
// The short keywords above are excluded from the substring list so they are
// checked exclusively via boundary matching.
const SHORT_DENY_SET = new Set(["hr", "lat", "lon", "jwt", "gps"]);
const LONG_DENY_KEYWORDS: ReadonlyArray<string> = DENIED_KEYWORDS.filter(
	(kw) => !SHORT_DENY_SET.has(kw),
);
const DYNAMIC_SEGMENT =
	/(\b\d{4,}\b|[0-9a-f]{8,}|[A-Za-z0-9_-]{24,}|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/;
const DYNAMIC_SEGMENT_TEXT = new RegExp(DYNAMIC_SEGMENT.source, "g");
const SECRET_TEXT_PATTERNS = [
	/bearer\s+[A-Za-z0-9._-]+/gi,
	// Bounded local-part/domain lengths prevent catastrophic backtracking on
	// long non-email strings (RFC 5321 local-part ≤ 64, domain ≤ 253, TLD ≤ 24).
	/[\w.+-]{1,64}@[\w.-]{1,253}\.[A-Za-z]{2,24}/gi,
	/https?:\/\/\S+\?\S+/gi,
	/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g,
	/\b\d{8,}\b/g,
	/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
	/\b[A-Za-z0-9+/]{32,}={0,2}\b/g,
] as const;
// Production keeps sampling intentionally low unless explicitly overridden.
const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalises camelCase keys to snake_case so short boundary-matched tokens
 * correctly fire on keys like `userLat` → `user_lat` or `heartHr` → `heart_hr`.
 */
function camelToSnake(s: string): string {
	return s.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

function isDeniedKey(key: string): boolean {
	const normalized = key.toLowerCase();
	// Long keywords: simple substring scan is unlikely to produce false positives.
	if (LONG_DENY_KEYWORDS.some((kw) => normalized.includes(kw))) return true;
	// Short keywords: require delimiter or string-boundary context to avoid
	// incidental matches (e.g. "lat" inside "platform", "hr" inside "threshold").
	// camelCase is normalised to snake_case first so `userLat` → `user_lat` matches.
	const snakeKey = camelToSnake(key);
	return SHORT_DENY_REGEXES.some((re) => re.test(snakeKey));
}

function scrubText(value: string): string {
	const withoutSecrets = SECRET_TEXT_PATTERNS.reduce(
		(text, pattern) => text.replace(pattern, REDACTED),
		value,
	);
	return withoutSecrets.replace(DYNAMIC_SEGMENT_TEXT, REDACTED);
}

function scrubUrl(value: string): string {
	try {
		const url = new URL(value, "https://kaito.local");
		const path = normalizePath(url.pathname);
		return value.startsWith("http") ? `${url.origin}${path}` : path;
	} catch {
		return normalizePath(value.split("?")[0] ?? "");
	}
}

function normalizePath(path: string): string {
	const clean = path.split("?")[0] ?? "";
	return clean
		.split("/")
		.map((segment) => {
			if (!segment) return segment;
			return DYNAMIC_SEGMENT.test(segment) ? REDACTED_PATH : scrubText(segment);
		})
		.join("/");
}

function safePrimitive(
	value: unknown,
): value is string | number | boolean | null {
	return (
		value === null || ["string", "number", "boolean"].includes(typeof value)
	);
}

function scrubObject(value: unknown, allowOnlySafeKeys = false): unknown {
	if (typeof value === "string") return scrubText(value);
	if (Array.isArray(value))
		return value.map((item) => scrubObject(item, allowOnlySafeKeys));
	if (!isObject(value)) return value;

	return Object.fromEntries(
		Object.entries(value).flatMap(([key, nested]) => {
			if (isDeniedKey(key)) return [[key, REDACTED]];
			if (allowOnlySafeKeys && !SAFE_KEYS.has(key)) return [];
			if (allowOnlySafeKeys && !safePrimitive(nested)) return [];
			return [[key, scrubObject(nested, allowOnlySafeKeys)]];
		}),
	);
}

function scrubRequest(request: Event["request"]): Event["request"] {
	if (!request) return request;
	return {
		...request,
		url: request.url ? scrubUrl(request.url) : request.url,
		query_string: undefined,
		cookies: undefined,
		// Headers are free-form and can contain referers, forwarding IPs, auth, or custom PII.
		headers: undefined,
		data: scrubObject(request.data, true),
	};
}

function scrubBreadcrumbs(
	breadcrumbs: Event["breadcrumbs"],
): Event["breadcrumbs"] {
	return breadcrumbs?.map((breadcrumb) => ({
		...breadcrumb,
		message: breadcrumb.message
			? scrubText(breadcrumb.message)
			: breadcrumb.message,
		data: scrubObject(breadcrumb.data, true) as
			| Record<string, unknown>
			| undefined,
	}));
}

function scrubExceptions(exception: Event["exception"]): Event["exception"] {
	return exception
		? {
				...exception,
				values: exception.values?.map((entry) => ({
					...entry,
					value: entry.value ? scrubText(entry.value) : entry.value,
				})),
			}
		: exception;
}

function scrubSpans(spans: Event["spans"]): Event["spans"] {
	return spans?.map((span) => ({
		...span,
		description: span.description
			? normalizePath(scrubText(span.description))
			: span.description,
		// Span data is free-form; apply the safe-key allowlist so arbitrary
		// application values (training notes, names, GPS coords under non-denied
		// keys) cannot leak through, matching the privacy contract.
		data: scrubObject(span.data, true) as NonNullable<typeof span.data>,
	}));
}

export function getSentryDsn(): string | undefined {
	if (typeof process === "undefined") return undefined;
	return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

export function getSentryEnvironment(): string {
	if (typeof process === "undefined") return "development";
	return (
		process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
		process.env.NODE_ENV ||
		"development"
	);
}

export function getTracesSampleRate(): number {
	if (typeof process === "undefined") return 0;
	const configured = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);
	if (Number.isFinite(configured) && configured >= 0 && configured <= 1)
		return configured;
	return process.env.NODE_ENV === "production"
		? PRODUCTION_TRACES_SAMPLE_RATE
		: 0;
}

export function sentryPrivacyOptions() {
	return {
		sendDefaultPii: false,
		beforeSend,
		beforeSendTransaction,
		environment: getSentryEnvironment(),
		tracesSampleRate: getTracesSampleRate(),
	};
}

/** @internal — exported only for tests; use `initSentryIfConfigured` at runtime. */
export function buildSentryInitOptions() {
	const dsn = getSentryDsn();
	if (!dsn) return undefined;
	return {
		dsn,
		...sentryPrivacyOptions(),
	};
}

/**
 * Initialises the given Sentry SDK object when a DSN is present.
 * The `opts` type is intentionally widened to the union that `@sentry/nextjs`
 * `init` itself accepts, so no cast is needed at call sites.
 */
export function initSentryIfConfigured(sentry: {
	init(opts: Parameters<typeof _sentryInit>[0]): unknown;
}): void {
	const options = buildSentryInitOptions();
	if (options) sentry.init(options as Parameters<typeof _sentryInit>[0]);
}

export function beforeSend(event: ErrorEvent): ErrorEvent {
	return scrubEvent(event) as ErrorEvent;
}

export function beforeSendTransaction(
	event: TransactionEvent,
): TransactionEvent {
	return scrubEvent(event) as TransactionEvent;
}

function scrubEvent(event: Event): Event {
	return {
		...event,
		user: undefined,
		message: event.message ? scrubText(event.message) : event.message,
		transaction: event.transaction
			? normalizePath(event.transaction)
			: event.transaction,
		request: scrubRequest(event.request),
		breadcrumbs: scrubBreadcrumbs(event.breadcrumbs),
		exception: scrubExceptions(event.exception),
		extra: scrubObject(event.extra, true) as
			| Record<string, unknown>
			| undefined,
		contexts: scrubObject(event.contexts, true) as Event["contexts"],
		// Tags are free-form key/value pairs; apply the safe-key allowlist so
		// non-technical or user-supplied tag values cannot leak PII.
		tags: scrubObject(event.tags, true) as Record<string, string> | undefined,
		spans: scrubSpans(event.spans),
	};
}
