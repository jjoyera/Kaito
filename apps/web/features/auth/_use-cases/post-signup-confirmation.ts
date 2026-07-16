export const CONFIRMATION_RECORD_TTL_MS = 30_000;
const STORAGE_PREFIX = "kaito:auth:signup-confirmation:";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WritableStorage = Pick<Storage, "setItem">;
type ConsumableStorage = Pick<Storage, "getItem" | "removeItem">;

export function normalizeConfirmationNonceInput(
	input: string | string[] | undefined,
): string | undefined {
	return typeof input === "string" && input.length <= 64 && UUID_PATTERN.test(input)
		? input
		: undefined;
}

export function confirmationStorageKey(nonce: string): string {
	return `${STORAGE_PREFIX}${nonce}`;
}

export function createPostSignupConfirmation(
	storage: WritableStorage,
	now: () => number = Date.now,
	createNonce: () => string = () => crypto.randomUUID(),
): string | undefined {
	try {
		const nonce = normalizeConfirmationNonceInput(createNonce());
		if (!nonce) return undefined;
		storage.setItem(
			confirmationStorageKey(nonce),
			JSON.stringify({ version: 1, createdAt: now() }),
		);
		return nonce;
	} catch {
		return undefined;
	}
}

export function removePostSignupConfirmation(
	nonce: string,
	storage: Pick<Storage, "removeItem">,
): void {
	try {
		storage.removeItem(confirmationStorageKey(nonce));
	} catch {
		// Best-effort cleanup; the caller still fails closed.
	}
}

export function consumePostSignupConfirmation(
	nonceInput: string | undefined,
	storage: ConsumableStorage,
	now: () => number = Date.now,
): boolean {
	const nonce = normalizeConfirmationNonceInput(nonceInput);
	if (!nonce) return false;
	const key = confirmationStorageKey(nonce);
	try {
		const raw = storage.getItem(key);
		if (raw === null) return false;
		let record: unknown;
		try {
			record = JSON.parse(raw);
		} catch {
			storage.removeItem(key);
			return false;
		}
		const valid = isValidRecord(record, now());
		storage.removeItem(key);
		return valid;
	} catch {
		return false;
	}
}

function isValidRecord(record: unknown, currentTime: number): boolean {
	if (typeof record !== "object" || record === null) return false;
	const candidate = record as { version?: unknown; createdAt?: unknown };
	if (candidate.version !== 1 || typeof candidate.createdAt !== "number") return false;
	const age = currentTime - candidate.createdAt;
	return Number.isFinite(candidate.createdAt) && age >= 0 && age <= CONFIRMATION_RECORD_TTL_MS;
}
