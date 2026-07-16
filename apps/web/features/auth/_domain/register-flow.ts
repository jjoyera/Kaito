import { selectCooldownSeconds } from "../_use-cases/register-client";

export const REGISTER_COOLDOWN_STORAGE_KEY = "kaito:auth:signup-cooldown";

export type RegisterFlowState =
	| { kind: "idle" }
	| { kind: "submitting"; requestId: number }
	| { kind: "navigating"; destination: "onboarding" | "login" }
	| { kind: "rate_limited"; retryAt: number; now: number }
	| { kind: "system_error" };

export type RegisterSettlement =
	| "authenticated"
	| "confirmation_required"
	| "system_error";

export type RegisterFlowEvent =
	| { type: "submit"; requestId: number }
	| { type: "settle"; requestId: number; outcome: RegisterSettlement }
	| { type: "rate_limit"; requestId: number; retryAt: number; now: number }
	| { type: "edit" }
	| { type: "hydrate_cooldown"; retryAt: number; now: number }
	| { type: "tick"; now: number }
	| { type: "navigation_error" };

export function registerFlowReducer(
	state: RegisterFlowState,
	event: RegisterFlowEvent,
): RegisterFlowState {
	if (event.type === "submit") {
		return state.kind === "idle" || state.kind === "system_error"
			? { kind: "submitting", requestId: event.requestId }
			: state;
	}
	if (event.type === "settle") {
		if (state.kind !== "submitting" || state.requestId !== event.requestId) return state;
		if (event.outcome === "authenticated") return { kind: "navigating", destination: "onboarding" };
		if (event.outcome === "confirmation_required") return { kind: "navigating", destination: "login" };
		return { kind: event.outcome };
	}
	if (event.type === "rate_limit") {
		return state.kind === "submitting" && state.requestId === event.requestId
			? { kind: "rate_limited", retryAt: event.retryAt, now: event.now }
			: state;
	}
	if (event.type === "hydrate_cooldown") {
		return event.retryAt > event.now
			? { kind: "rate_limited", retryAt: event.retryAt, now: event.now }
			: state;
	}
	if (event.type === "tick" && state.kind === "rate_limited") {
		return event.now >= state.retryAt ? { kind: "idle" } : { ...state, now: event.now };
	}
	if (event.type === "edit") {
		return state.kind === "system_error" ? { kind: "idle" } : state;
	}
	if (event.type === "navigation_error" && state.kind === "navigating") {
		return { kind: "system_error" };
	}
	return state;
}

export function createCooldownDeadline(now: number, retryAfterSeconds: unknown): number {
	return now + selectCooldownSeconds(retryAfterSeconds) * 1_000;
}

export function remainingCooldownSeconds(retryAt: number, now: number): number {
	return Math.max(0, Math.ceil((retryAt - now) / 1_000));
}

type ReadableStorage = Pick<Storage, "getItem" | "removeItem">;

export function hydrateCooldownDeadline(storage: ReadableStorage, now: number): number | undefined {
	try {
		const raw = storage.getItem(REGISTER_COOLDOWN_STORAGE_KEY);
		if (raw === null) return undefined;
		const retryAt = Number(raw);
		if (Number.isSafeInteger(retryAt) && retryAt > now) return retryAt;
		storage.removeItem(REGISTER_COOLDOWN_STORAGE_KEY);
	} catch {
		// Storage restrictions degrade to the in-memory guard.
	}
	return undefined;
}

export function persistCooldownDeadline(storage: Pick<Storage, "setItem">, retryAt: number): void {
	try {
		storage.setItem(REGISTER_COOLDOWN_STORAGE_KEY, String(retryAt));
	} catch {
		// Storage restrictions degrade to the in-memory guard.
	}
}

export function clearCooldownDeadline(storage: Pick<Storage, "removeItem">): void {
	try {
		storage.removeItem(REGISTER_COOLDOWN_STORAGE_KEY);
	} catch {
		// Storage restrictions must not break registration recovery.
	}
}
