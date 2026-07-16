"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";

import { getSentryDsn } from "../../../lib/sentry-scrubbing";
import { isTestAuthAdapterEnabledInBrowser } from "../../../shared/testing/test-auth-adapter";
import { createSupabaseSignUpAdapter } from "../_adapters/supabase-sign-up";
import { ProcessingOverlay } from "./processing-overlay";
import {
	clearCooldownDeadline,
	createCooldownDeadline,
	hydrateCooldownDeadline,
	persistCooldownDeadline,
	registerFlowReducer,
	remainingCooldownSeconds,
} from "../_domain/register-flow";
import {
	type RegisterFieldErrors,
	validateRegisterInput,
} from "../_domain/register-validation";
import { getBrowserSupabaseClient } from "../_infrastructure/supabase/browser";
import { continueToAuthenticatedFlow } from "../_use-cases/authenticated-handoff";
import {
	createPostSignupConfirmation,
	removePostSignupConfirmation,
} from "../_use-cases/post-signup-confirmation";
import {
	createRegisterWithPassword,
	type RegisterOutcome,
	type RegisterWithPassword,
} from "../_use-cases/register-client";

const DUPLICATE_ACCOUNT_MESSAGE = "Ya existe una cuenta con ese correo electrónico.";
const SYSTEM_ERROR_MESSAGE =
	"Kaito no puede crear tu cuenta ahora mismo. Inténtalo de nuevo en unos minutos.";

export function RegisterForm() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [repeatPassword, setRepeatPassword] = useState("");
	const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
	const [flow, dispatch] = useReducer(registerFlowReducer, { kind: "idle" });
	const [cooldownExpired, setCooldownExpired] = useState(false);
	const pendingSubmission = useRef(false);
	const nextRequestId = useRef(0);
	const feedbackRef = useRef<HTMLDivElement>(null);
	const register = createDefaultRegisterWithPassword();

	useEffect(() => {
		const now = currentTime();
		const retryAt = hydrateCooldownDeadline(window.sessionStorage, now);
		if (retryAt) dispatch({ type: "hydrate_cooldown", retryAt, now });
	}, []);

	const activeRetryAt = flow.kind === "rate_limited" ? flow.retryAt : undefined;
	useEffect(() => {
		if (activeRetryAt === undefined) return;
		const tick = () => {
			const now = currentTime();
			if (now >= activeRetryAt) {
				clearCooldownDeadline(window.sessionStorage);
				setCooldownExpired(true);
			}
			dispatch({ type: "tick", now });
		};
		const timer = window.setInterval(tick, 250);
		return () => window.clearInterval(timer);
	}, [activeRetryAt]);

	useEffect(() => {
		if (flow.kind === "duplicate_account" || flow.kind === "rate_limited" || flow.kind === "system_error") {
			feedbackRef.current?.focus();
		}
	}, [flow.kind]);

	function editField(kind: "email" | "password" | "repeatPassword", value: string) {
		if (kind === "email") {
			setEmail(value);
			setFieldErrors((current) => ({ ...current, email: undefined }));
		} else if (kind === "password") {
			setPassword(value);
			setFieldErrors((current) => ({ ...current, password: undefined }));
		} else {
			setRepeatPassword(value);
			setFieldErrors((current) => ({ ...current, repeatPassword: undefined }));
		}
		setCooldownExpired(false);
		dispatch({ type: "edit" });
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pendingSubmission.current || flow.kind === "submitting" || flow.kind === "navigating") return;

		const now = currentTime();
		const storedRetryAt = hydrateCooldownDeadline(window.sessionStorage, now);
		if (storedRetryAt) {
			dispatch({ type: "hydrate_cooldown", retryAt: storedRetryAt, now });
			return;
		}
		if (flow.kind === "rate_limited" && now < flow.retryAt) return;

		const validation = validateRegisterInput({ email, password, repeatPassword });
		setFieldErrors(validation.fieldErrors);
		if (!validation.isValid) {
			focusFirstInvalid(validation.fieldErrors);
			return;
		}

		const requestId = ++nextRequestId.current;
		pendingSubmission.current = true;
		setCooldownExpired(false);
		dispatch({ type: "submit", requestId });
		try {
			const outcome = await register(validation.submission);
			await settleRegistration(outcome, requestId);
		} catch {
			dispatch({ type: "settle", requestId, outcome: "system_error" });
			reportRegistrationSystemError();
		} finally {
			pendingSubmission.current = false;
		}
	}

	async function settleRegistration(outcome: RegisterOutcome, requestId: number) {
		if (outcome.status === "rate_limited") {
			reportRegistrationEvent("rate_limited");
			const now = currentTime();
			const retryAt = createCooldownDeadline(now, outcome.retryAfterSeconds);
			persistCooldownDeadline(window.sessionStorage, retryAt);
			dispatch({ type: "rate_limit", requestId, retryAt, now });
			return;
		}
		if (outcome.status === "authenticated") {
			dispatch({ type: "settle", requestId, outcome: "authenticated" });
			continueToAuthenticatedFlow(router);
			router.refresh();
			return;
		}
		if (outcome.status === "confirmation_required") {
			const nonce = createPostSignupConfirmation(window.sessionStorage);
			if (!nonce) {
				dispatch({ type: "settle", requestId, outcome: "system_error" });
				reportRegistrationEvent("confirmation_storage_failed");
				return;
			}
			dispatch({ type: "settle", requestId, outcome: "confirmation_required" });
			try {
				router.replace(`/login?signupConfirmation=${encodeURIComponent(nonce)}`);
			} catch {
				removePostSignupConfirmation(nonce, window.sessionStorage);
				dispatch({ type: "navigation_error" });
				reportRegistrationEvent("confirmation_navigation_failed");
			}
			return;
		}
		dispatch({ type: "settle", requestId, outcome: outcome.status });
		if (outcome.status === "system_error") reportRegistrationSystemError();
	}

	const isBusy = flow.kind === "submitting" || flow.kind === "navigating";
	const isLimited = flow.kind === "rate_limited";
	const remaining = isLimited ? remainingCooldownSeconds(flow.retryAt, flow.now) : 0;

	return (
		<>
			<ProcessingOverlay
				description="Espera mientras procesamos tu registro."
				open={flow.kind === "submitting"}
				returnFocusRef={feedbackRef}
				title="Creando tu cuenta"
			/>
			<form className="login-form" noValidate onSubmit={handleSubmit}>
				<div className="login-field">
					<label htmlFor="register-email">Correo electrónico</label>
					<input
						aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
						aria-invalid={Boolean(fieldErrors.email)}
						autoComplete="email"
						id="register-email"
						onChange={(event) => editField("email", event.target.value)}
						type="email"
						value={email}
					/>
					{fieldErrors.email ? <p className="login-field-error" id="register-email-error" role="alert">{getEmailErrorMessage(fieldErrors.email)}</p> : null}
				</div>
				<div className="login-field">
					<label htmlFor="register-password">Contraseña</label>
					<input
						aria-describedby={`register-password-hint${fieldErrors.password ? " register-password-error" : ""}`}
						aria-invalid={Boolean(fieldErrors.password)}
						autoComplete="new-password"
						id="register-password"
						onChange={(event) => editField("password", event.target.value)}
						type="password"
						value={password}
					/>
					<p className="login-field-hint" id="register-password-hint">Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.</p>
					{fieldErrors.password ? <p className="login-field-error" id="register-password-error" role="alert">{getPasswordErrorMessage(fieldErrors.password)}</p> : null}
				</div>
				<div className="login-field">
					<label htmlFor="register-repeat-password">Repite la contraseña</label>
					<input
						aria-describedby={fieldErrors.repeatPassword ? "register-repeat-password-error" : undefined}
						aria-invalid={Boolean(fieldErrors.repeatPassword)}
						autoComplete="new-password"
						id="register-repeat-password"
						onChange={(event) => editField("repeatPassword", event.target.value)}
						type="password"
						value={repeatPassword}
					/>
					{fieldErrors.repeatPassword ? <p className="login-field-error" id="register-repeat-password-error" role="alert">{getRepeatPasswordErrorMessage(fieldErrors.repeatPassword)}</p> : null}
				</div>

				<div className="register-feedback" ref={feedbackRef} tabIndex={-1}>
					{flow.kind === "duplicate_account" ? (
						<p className="login-form-error" role="alert">{DUPLICATE_ACCOUNT_MESSAGE} <Link href="/login">Iniciar sesión</Link>.</p>
					) : null}
					{isLimited ? (
						<><p className="login-form-error" role="alert">Se han realizado demasiados intentos de registro.</p><p id="register-cooldown">Podrás intentarlo de nuevo en {remaining} segundos.</p></>
					) : null}
					{flow.kind === "system_error" ? <p className="login-form-error" role="alert">{SYSTEM_ERROR_MESSAGE}</p> : null}
					{cooldownExpired ? <p aria-live="polite" role="status">Ya puedes volver a intentarlo.</p> : null}
				</div>

				<button aria-describedby={isLimited ? "register-cooldown" : undefined} disabled={isBusy || isLimited} type="submit">
					{flow.kind === "submitting" ? "Creando cuenta…" : "Crear cuenta"}
				</button>
			</form>
		</>
	);
}

function createDefaultRegisterWithPassword(): RegisterWithPassword {
	if (isTestAuthAdapterEnabledInBrowser()) {
		return async (input) => {
			const count = Number(sessionStorage.getItem("kaito:e2e:signup-calls") ?? "0") + 1;
			sessionStorage.setItem("kaito:e2e:signup-calls", String(count));
			return resolveTestRegisterOutcome(input.email, count);
		};
	}
	const client = getBrowserSupabaseClient();
	if (!client) return () => Promise.resolve({ status: "system_error" });
	return createRegisterWithPassword(createSupabaseSignUpAdapter(client));
}

async function resolveTestRegisterOutcome(email: string, callCount: number): Promise<RegisterOutcome> {
	if (email === "pending@example.com") {
		await new Promise((resolve) => setTimeout(resolve, 2_000));
		return { status: "confirmation_required" };
	}
	if (email === "confirmation@example.com") return { status: "confirmation_required" };
	if (email === "pending-system@example.com") {
		await new Promise((resolve) => setTimeout(resolve, 2_000));
		return { status: "system_error" };
	}
	if (email === "duplicate@example.com") return { status: "duplicate_account" };
	if (email === "rate-limit@example.com") return { status: "rate_limited" };
	if (email === "short-rate-limit@example.com" && callCount === 1) return { status: "rate_limited", retryAfterSeconds: 2 };
	if (email === "system-once@example.com" && callCount === 1) return { status: "system_error" };
	window.document.cookie = "kaito-e2e-session=authenticated; Path=/; SameSite=Lax";
	return { status: "authenticated" };
}

function focusFirstInvalid(errors: RegisterFieldErrors) {
	const id = errors.email ? "register-email" : errors.password ? "register-password" : "register-repeat-password";
	document.getElementById(id)?.focus();
}

function getEmailErrorMessage(error: NonNullable<RegisterFieldErrors["email"]>) {
	return error === "required" ? "El correo electrónico es obligatorio." : "Introduce un correo electrónico válido.";
}
function getPasswordErrorMessage(error: NonNullable<RegisterFieldErrors["password"]>) {
	if (error === "required") return "La contraseña es obligatoria.";
	if (error === "too_short") return "La contraseña debe tener al menos 8 caracteres.";
	return "La contraseña debe incluir mayúscula, minúscula, número y símbolo.";
}
function getRepeatPasswordErrorMessage(error: NonNullable<RegisterFieldErrors["repeatPassword"]>) {
	return error === "required" ? "Repite la contraseña." : "Las contraseñas deben coincidir.";
}
function currentTime(): number {
	return Date.now();
}

function reportRegistrationSystemError(): void {
	reportRegistrationEvent("system_error");
}

function reportRegistrationEvent(
	outcome: "system_error" | "rate_limited" | "confirmation_storage_failed" | "confirmation_navigation_failed",
): void {
	if (!getSentryDsn()) return;
	Sentry.captureMessage("registration flow outcome", {
		level: outcome === "rate_limited" ? "info" : "error",
		tags: { component: "register-form", operation: "sign-up", outcome },
	});
}
