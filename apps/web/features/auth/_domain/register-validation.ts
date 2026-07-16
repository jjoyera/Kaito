export type RegisterFieldErrors = {
	email?: "required" | "invalid_format";
	password?: "required" | "too_short" | "weak_format";
	repeatPassword?: "required" | "mismatch";
};

export type RegisterInput = {
	email: string;
	password: string;
	repeatPassword: string;
};

export type RegisterValidationResult = {
	isValid: boolean;
	fieldErrors: RegisterFieldErrors;
	submission: RegisterInput;
};

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const NUMBER_PATTERN = /[0-9]/;
const SYMBOL_PATTERN = /[^A-Za-z0-9\s]/;

export function validateRegisterInput(
	input: RegisterInput,
): RegisterValidationResult {
	const submissionEmail = input.email.trim();
	const fieldErrors: RegisterFieldErrors = {};

	if (submissionEmail.length === 0) {
		fieldErrors.email = "required";
	} else if (!BASIC_EMAIL_PATTERN.test(submissionEmail)) {
		fieldErrors.email = "invalid_format";
	}

	if (input.password.length === 0) {
		fieldErrors.password = "required";
	} else if (input.password.length < 8) {
		fieldErrors.password = "too_short";
	} else if (
		!UPPERCASE_PATTERN.test(input.password) ||
		!LOWERCASE_PATTERN.test(input.password) ||
		!NUMBER_PATTERN.test(input.password) ||
		!SYMBOL_PATTERN.test(input.password)
	) {
		fieldErrors.password = "weak_format";
	}

	if (input.repeatPassword.length === 0) {
		fieldErrors.repeatPassword = "required";
	} else if (input.repeatPassword !== input.password) {
		fieldErrors.repeatPassword = "mismatch";
	}

	return {
		isValid: Object.keys(fieldErrors).length === 0,
		fieldErrors,
		submission: {
			email: submissionEmail,
			password: input.password,
			repeatPassword: input.repeatPassword,
		},
	};
}
