"use client";

import { useState } from "react";

import {
	type RegisterFieldErrors,
	validateRegisterInput,
} from "../_domain/register-validation";

type RegisterStatus = "idle" | "valid";

export function RegisterForm() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [repeatPassword, setRepeatPassword] = useState("");
	const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
	const [status, setStatus] = useState<RegisterStatus>("idle");

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus("idle");

		const validation = validateRegisterInput({
			email,
			password,
			repeatPassword,
		});
		setFieldErrors(validation.fieldErrors);
		if (validation.isValid) {
			setStatus("valid");
		}
	}

	return (
		<form className="login-form" noValidate onSubmit={handleSubmit}>
			<div className="login-field">
				<label htmlFor="register-email">Correo electrónico</label>
				<input
					aria-describedby={
						fieldErrors.email ? "register-email-error" : undefined
					}
					aria-invalid={Boolean(fieldErrors.email)}
					autoComplete="email"
					id="register-email"
					onChange={(event) => {
						setEmail(event.target.value);
						setFieldErrors((current) => ({ ...current, email: undefined }));
						setStatus("idle");
					}}
					type="email"
					value={email}
				/>
				{fieldErrors.email ? (
					<p className="login-field-error" id="register-email-error" role="alert">
						{getEmailErrorMessage(fieldErrors.email)}
					</p>
				) : null}
			</div>

			<div className="login-field">
				<label htmlFor="register-password">Contraseña</label>
				<input
					aria-describedby={
						fieldErrors.password
							? "register-password-hint register-password-error"
							: "register-password-hint"
					}
					aria-invalid={Boolean(fieldErrors.password)}
					autoComplete="new-password"
					id="register-password"
					onChange={(event) => {
						setPassword(event.target.value);
						setFieldErrors((current) => ({ ...current, password: undefined }));
						setStatus("idle");
					}}
					type="password"
					value={password}
				/>
				<p className="login-field-hint" id="register-password-hint">
					Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.
				</p>
				{fieldErrors.password ? (
					<p
						className="login-field-error"
						id="register-password-error"
						role="alert"
					>
						{getPasswordErrorMessage(fieldErrors.password)}
					</p>
				) : null}
			</div>

			<div className="login-field">
				<label htmlFor="register-repeat-password">Repite la contraseña</label>
				<input
					aria-describedby={
						fieldErrors.repeatPassword
							? "register-repeat-password-error"
							: undefined
					}
					aria-invalid={Boolean(fieldErrors.repeatPassword)}
					autoComplete="new-password"
					id="register-repeat-password"
					onChange={(event) => {
						setRepeatPassword(event.target.value);
						setFieldErrors((current) => ({
							...current,
							repeatPassword: undefined,
						}));
						setStatus("idle");
					}}
					type="password"
					value={repeatPassword}
				/>
				{fieldErrors.repeatPassword ? (
					<p
						className="login-field-error"
						id="register-repeat-password-error"
						role="alert"
					>
						{getRepeatPasswordErrorMessage(fieldErrors.repeatPassword)}
					</p>
				) : null}
			</div>

			{status === "valid" ? (
				<p role="status">
					Los datos son válidos. La creación de cuentas todavía no está conectada.
				</p>
			) : null}

			<button type="submit">Crear cuenta</button>
		</form>
	);
}

function getEmailErrorMessage(error: NonNullable<RegisterFieldErrors["email"]>) {
	return error === "required"
		? "El correo electrónico es obligatorio."
		: "Introduce un correo electrónico válido.";
}

function getPasswordErrorMessage(
	error: NonNullable<RegisterFieldErrors["password"]>,
) {
	if (error === "required") return "La contraseña es obligatoria.";
	if (error === "too_short") {
		return "La contraseña debe tener al menos 8 caracteres.";
	}
	return "La contraseña debe incluir mayúscula, minúscula, número y símbolo.";
}

function getRepeatPasswordErrorMessage(
	error: NonNullable<RegisterFieldErrors["repeatPassword"]>,
) {
	return error === "required"
		? "Repite la contraseña."
		: "Las contraseñas deben coincidir.";
}
