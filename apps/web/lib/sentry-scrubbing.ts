import type { ErrorEvent, Event } from "@sentry/nextjs";

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
const DENY_KEY =
	/(token|secret|password|api_?key|authorization|cookie|session|supabase|strava|access_token|refresh_token|jwt|bearer|email|phone|lat|lon|latitude|longitude|gps|coordinates|activity|workout|hr|heartrate|athlete)/i;
const DYNAMIC_SEGMENT =
	/(\b\d{4,}\b|[0-9a-f]{8,}|[A-Za-z0-9_-]{24,}|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/;
const DYNAMIC_SEGMENT_TEXT = new RegExp(DYNAMIC_SEGMENT.source, "g");
const SECRET_TEXT =
	/(bearer\s+[A-Za-z0-9._-]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\/\S+\?\S+|-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}|\b\d{8,}\b|\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b|\b[A-Za-z0-9+/]{32,}={0,2}\b)/gi;
// Production keeps sampling intentionally low unless explicitly overridden.
const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scrubText(value: string): string {
	return value
		.replace(SECRET_TEXT, REDACTED)
		.replace(DYNAMIC_SEGMENT_TEXT, REDACTED);
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
			if (DENY_KEY.test(key)) return [[key, REDACTED]];
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
