export type LoginFieldErrors = {
	email?: "required" | "invalid_format";
	password?: "required";
};

export type LoginInput = {
	email: string;
	password: string;
};

export type LoginValidationResult = {
	isValid: boolean;
	fieldErrors: LoginFieldErrors;
	submission: LoginInput;
	visible: Pick<LoginInput, "email">;
};

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginInput(input: LoginInput): LoginValidationResult {
	const submissionEmail = input.email.trim();
	const fieldErrors: LoginFieldErrors = {};

	if (submissionEmail.length === 0) {
		fieldErrors.email = "required";
	} else if (!BASIC_EMAIL_PATTERN.test(submissionEmail)) {
		fieldErrors.email = "invalid_format";
	}

	if (input.password.length === 0) {
		fieldErrors.password = "required";
	}

	return {
		isValid: Object.keys(fieldErrors).length === 0,
		fieldErrors,
		submission: {
			email: submissionEmail,
			password: input.password,
		},
		visible: {
			email: input.email,
		},
	};
}
