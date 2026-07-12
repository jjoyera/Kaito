"use client";

import * as Sentry from "@sentry/nextjs";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSentryDsn } from "../../../lib/sentry-scrubbing";
import {
	createSignInWithPassword,
	type SignInOutcome,
	type SignInWithPassword,
} from "../_use-cases/auth-client";
import { continueToAuthenticatedFlow } from "../_use-cases/authenticated-handoff";
import { createSupabaseSignInAdapter } from "../_adapters/supabase-sign-in";
import { getBrowserSupabaseClient } from "../_infrastructure/supabase/browser";
import {
	validateLoginInput,
	type LoginFieldErrors,
} from "../_domain/login-validation";

type LoginStatus =
	| "idle"
	| "submitting"
	| "invalid_credentials"
	| "system_error";

const INVALID_CREDENTIALS_MESSAGE =
	"No hemos podido iniciar sesión con ese correo electrónico y contraseña. Comprueba ambos campos e inténtalo de nuevo.";
const SYSTEM_ERROR_MESSAGE =
	"Kaito no puede conectar con el servicio de inicio de sesión ahora mismo. Inténtalo de nuevo en unos minutos o contacta con soporte si el problema continúa.";

type LoginFormProps = { returnTo: string };

export function LoginForm({ returnTo }: LoginFormProps) {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
	const [status, setStatus] = useState<LoginStatus>("idle");
	const pendingSubmission = useRef(false);

	const isSubmitting = status === "submitting";
	const submitLabel = isSubmitting ? "Iniciando sesión…" : "Iniciar sesión";
	const signIn = createDefaultSignInWithPassword();
	const emailErrorMessage = getEmailErrorMessage(fieldErrors.email);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pendingSubmission.current) {
			return;
		}

		setStatus("idle");
		const validation = validateLoginInput({ email, password });
		setFieldErrors(validation.fieldErrors);
		if (!validation.isValid) {
			return;
		}

		setStatus("submitting");
		pendingSubmission.current = true;
		try {
			const outcome = await signIn({
				email: validation.submission.email,
				password: validation.submission.password,
			});

			if (outcome.status === "success") {
				continueToAuthenticatedFlow(router, returnTo);
				router.refresh();
				return;
			}

			setStatus(outcome.status);
			if (outcome.status === "system_error") {
				reportLoginSystemError();
			}
		} catch {
			setStatus("system_error");
			reportLoginSystemError();
		} finally {
			pendingSubmission.current = false;
		}
	}

	return (
		<form className="login-form" noValidate onSubmit={handleSubmit}>
			<div className="login-field">
				<label htmlFor="login-email">Correo electrónico</label>
				<input
					autoComplete="email"
					id="login-email"
					onChange={(event) => {
						setEmail(event.target.value);
						setFieldErrors((current) => ({ ...current, email: undefined }));
					}}
					type="email"
					value={email}
					aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
					aria-invalid={Boolean(fieldErrors.email)}
				/>
				{emailErrorMessage ? (
					<p className="login-field-error" id="login-email-error" role="alert">
						{emailErrorMessage}
					</p>
				) : null}
			</div>

			<div className="login-field">
				<label htmlFor="login-password">Contraseña</label>
				<input
					autoComplete="current-password"
					id="login-password"
					onChange={(event) => {
						setPassword(event.target.value);
						setFieldErrors((current) => ({ ...current, password: undefined }));
					}}
					type="password"
					value={password}
					aria-describedby={
						fieldErrors.password ? "login-password-error" : undefined
					}
					aria-invalid={Boolean(fieldErrors.password)}
				/>
				{fieldErrors.password ? (
					<p
						className="login-field-error"
						id="login-password-error"
						role="alert"
					>
						La contraseña es obligatoria.
					</p>
				) : null}
			</div>

			{status === "invalid_credentials" ? (
				<p className="login-form-error" role="alert">
					{INVALID_CREDENTIALS_MESSAGE}
				</p>
			) : null}
			{status === "system_error" ? (
				<p className="login-form-error" role="alert">
					{SYSTEM_ERROR_MESSAGE}
				</p>
			) : null}

			<button disabled={isSubmitting} type="submit">
				{submitLabel}
			</button>
		</form>
	);
}

function getEmailErrorMessage(
	error: LoginFieldErrors["email"],
): string | undefined {
	if (error === "required") {
		return "El correo electrónico es obligatorio.";
	}

	if (error === "invalid_format") {
		return "Introduce un correo electrónico válido.";
	}

	return undefined;
}

function createDefaultSignInWithPassword(): SignInWithPassword {
	if (isTestAuthAdapterEnabled()) {
		return (input) => {
			const testWindow = window as typeof window & {
				__KAITO_TEST_AUTH_CALL_COUNT__?: number;
			};
			testWindow.__KAITO_TEST_AUTH_CALL_COUNT__ =
				(testWindow.__KAITO_TEST_AUTH_CALL_COUNT__ ?? 0) + 1;
			return resolveTestAuthOutcome(input.email);
		};
	}

	const client = getBrowserSupabaseClient();
	if (!client) return () => Promise.resolve({ status: "system_error" });
	return createSignInWithPassword(createSupabaseSignInAdapter(client));
}

async function resolveTestAuthOutcome(email: string): Promise<SignInOutcome> {
	if (email === "pending@example.com") {
		await new Promise((resolve) => setTimeout(resolve, 2_000));
		return { status: "invalid_credentials" };
	}

	if (email === "invalid@example.com") {
		return { status: "invalid_credentials" };
	}

	if (email === "system@example.com") {
		return { status: "system_error" };
	}

	window.document.cookie =
		"kaito-e2e-session=authenticated; Path=/; SameSite=Lax";
	return { status: "success" };
}

function reportLoginSystemError(): void {
	if (!getSentryDsn()) {
		return;
	}

	Sentry.captureException(new Error("login sign-in system_error"), {
		tags: {
			component: "login-form",
			operation: "sign-in",
		},
	});
}

function isTestAuthAdapterEnabled(): boolean {
	return (
		process.env.NODE_ENV !== "production" &&
		process.env.NEXT_PUBLIC_KAITO_TEST_AUTH_ADAPTER === "1" &&
		isLoopbackBrowserRuntime()
	);
}

function isLoopbackBrowserRuntime(): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}
