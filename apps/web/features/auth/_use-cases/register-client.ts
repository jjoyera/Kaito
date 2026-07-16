export type RegisterInput = { email: string; password: string };

export type RegisterOutcome =
	| { status: "authenticated" }
	| { status: "confirmation_required" }
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

const CONFIRMATION_GUIDANCE_ERROR_CODES = new Set(["user_already_exists", "email_exists"]);
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
	if (error?.code && CONFIRMATION_GUIDANCE_ERROR_CODES.has(error.code)) {
		return { status: "confirmation_required" };
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
	let unresolvedTimedOutProvider: Promise<void> | undefined;

	return async (input) => {
		if (unresolvedTimedOutProvider) {
			reportRegisterSystemError(
				onSystemError,
				new Error("registration provider still pending after timeout"),
			);
			return { status: "system_error" };
		}

		let timeout: ReturnType<typeof setTimeout> | undefined;
		const providerSettlement = adapter(input).then(
			(result) => mapProviderRegisterResult(result),
			(error) => {
				reportRegisterSystemError(onSystemError, error);
				return { status: "system_error" } as const;
			},
		);

		const timeoutSettlement = new Promise<"timeout">((resolve) => {
			timeout = setTimeout(() => resolve("timeout"), Math.max(0, timeoutMs));
		});

		const outcome = await Promise.race([providerSettlement, timeoutSettlement]);
		if (timeout !== undefined) clearTimeout(timeout);

		if (outcome === "timeout") {
			reportRegisterSystemError(onSystemError, new Error("registration provider timeout"));
			const cleanup = providerSettlement.then(() => {
				if (unresolvedTimedOutProvider === cleanup) unresolvedTimedOutProvider = undefined;
			});
			unresolvedTimedOutProvider = cleanup;
			return { status: "system_error" };
		}

		return outcome;
	};
}

function reportRegisterSystemError(
	reporter: RegisterSystemErrorReporter | undefined,
	error: unknown,
): void {
	try {
		reporter?.(error);
	} catch {
		// Reporting is best-effort and cannot alter the safe outcome.
	}
}
