"use client";

import * as Sentry from "@sentry/nextjs";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSentryDsn } from "../../lib/sentry-scrubbing";
import type { SignInOutcome, SignInWithPassword } from "./auth-client";
import { continueToAuthenticatedFlow } from "./authenticated-handoff";
import { validateLoginInput, type LoginFieldErrors } from "./login-validation";

type LoginStatus =
	| "idle"
	| "submitting"
	| "invalid_credentials"
	| "system_error";

const INVALID_CREDENTIALS_MESSAGE =
	"We could not sign you in with that email and password. Check both fields and try again.";
const SYSTEM_ERROR_MESSAGE =
	"Kaito could not reach the sign-in service right now. Try again in a moment or contact support if it continues.";

export function LoginForm() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
	const [status, setStatus] = useState<LoginStatus>("idle");
	const pendingSubmission = useRef(false);

	const isSubmitting = status === "submitting";
	const submitLabel = isSubmitting ? "Signing in…" : "Sign in";
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
		const outcome = await signIn({
			email: validation.submission.email,
			password: validation.submission.password,
		});

		if (outcome.status === "success") {
			continueToAuthenticatedFlow(router);
			return;
		}

		pendingSubmission.current = false;
		setStatus(outcome.status);
		if (outcome.status === "system_error") {
			reportLoginSystemError();
		}
	}

	return (
		<form className="login-form" noValidate onSubmit={handleSubmit}>
			<div className="login-field">
				<label htmlFor="login-email">Email address</label>
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
					<p className="login-field-error" id="login-email-error">
						{emailErrorMessage}
					</p>
				) : null}
			</div>

			<div className="login-field">
				<label htmlFor="login-password">Password</label>
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
					<p className="login-field-error" id="login-password-error">
						Password is required.
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
		return "Email is required.";
	}

	if (error === "invalid_format") {
		return "Enter a valid email address.";
	}

	return undefined;
}

function createDefaultSignInWithPassword(): SignInWithPassword {
	if (isTestAuthAdapterEnabled()) {
		return async (input) => resolveTestAuthOutcome(input.email);
	}

	return async () => ({ status: "system_error" });
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
