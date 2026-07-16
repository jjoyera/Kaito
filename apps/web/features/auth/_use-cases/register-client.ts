export type RegisterInput = { email: string; password: string };

export type RegisterOutcome =
	| { status: "authenticated" }
	| { status: "confirmation_required" }
	| { status: "duplicate_account" }
	| { status: "rate_limited"; retryAfterSeconds?: number }
	| { status: "system_error" };

export type RegisterWithPassword = (input: RegisterInput) => Promise<RegisterOutcome>;

export type ProviderRegisterError = {
	code?: string;
	status?: number;
	retryAfterSeconds?: unknown;
};

export type ProviderRegisterResult =
	| { ok: true; hasSession: boolean }
	| { ok: false; error?: ProviderRegisterError };

export type ProviderRegisterAdapter = (input: RegisterInput) => Promise<ProviderRegisterResult>;
export type RegisterSystemErrorReporter = (error: unknown) => void;

const DUPLICATE_ACCOUNT_ERROR_CODES = new Set(["user_already_exists", "email_exists"]);
const RATE_LIMIT_ERROR_CODE = "over_email_send_rate_limit";
export const DEFAULT_REGISTER_COOLDOWN_SECONDS = 60;
export const DEFAULT_REGISTER_TIMEOUT_MS = 15_000;
const MAX_DATE_EPOCH_MS = 8_640_000_000_000_000;
export const MAX_SAFE_COOLDOWN_SECONDS = Math.floor(
	(Number.MAX_SAFE_INTEGER - MAX_DATE_EPOCH_MS) / 1_000,
);

export function normalizeRetryAfterSeconds(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
	const rounded = Math.ceil(value);
	return rounded <= MAX_SAFE_COOLDOWN_SECONDS ? rounded : undefined;
}

export function selectCooldownSeconds(value: unknown): number {
	return normalizeRetryAfterSeconds(value) ?? DEFAULT_REGISTER_COOLDOWN_SECONDS;
}

export function mapProviderRegisterResult(result: ProviderRegisterResult): RegisterOutcome {
	if (result.ok) {
		return result.hasSession
			? { status: "authenticated" }
			: { status: "confirmation_required" };
	}

	const { error } = result;
	if (error?.code && DUPLICATE_ACCOUNT_ERROR_CODES.has(error.code)) {
		return { status: "duplicate_account" };
	}
	if (error?.code === RATE_LIMIT_ERROR_CODE || error?.status === 429) {
		const retryAfterSeconds = normalizeRetryAfterSeconds(error.retryAfterSeconds);
		return retryAfterSeconds === undefined
			? { status: "rate_limited" }
			: { status: "rate_limited", retryAfterSeconds };
	}
	return { status: "system_error" };
}

export function createRegisterWithPassword(
	adapter: ProviderRegisterAdapter,
	onSystemError?: RegisterSystemErrorReporter,
	timeoutMs = DEFAULT_REGISTER_TIMEOUT_MS,
): RegisterWithPassword {
	return async (input) => {
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			const result = await Promise.race([
				adapter(input),
				new Promise<never>((_, reject) => {
					timeout = setTimeout(
						() => reject(new Error("registration provider timeout")),
						Math.max(0, timeoutMs),
					);
				}),
			]);
			return mapProviderRegisterResult(result);
		} catch (error) {
			try {
				onSystemError?.(error);
			} catch {
				// Reporting is best-effort and cannot alter the safe outcome.
			}
			return { status: "system_error" };
		} finally {
			if (timeout !== undefined) clearTimeout(timeout);
		}
	};
}
