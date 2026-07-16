import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateRegisterInput } from "./register-validation";

const validInput = {
	email: "runner@kaito.app",
	password: "Trail#42",
	repeatPassword: "Trail#42",
};

describe("validateRegisterInput", () => {
	it("requires all fields", () => {
		const result = validateRegisterInput({
			email: "",
			password: "",
			repeatPassword: "",
		});

		assert.deepEqual(result.fieldErrors, {
			email: "required",
			password: "required",
			repeatPassword: "required",
		});
		assert.equal(result.isValid, false);
	});

	it("uses the same basic email format and trims the submitted email", () => {
		const invalid = validateRegisterInput({
			...validInput,
			email: "runner-at-kaito",
		});
		const valid = validateRegisterInput({
			...validInput,
			email: "  runner@kaito.app  ",
		});

		assert.equal(invalid.fieldErrors.email, "invalid_format");
		assert.equal(valid.isValid, true);
		assert.equal(valid.submission.email, "runner@kaito.app");
	});

	it("requires at least eight password characters", () => {
		const result = validateRegisterInput({
			...validInput,
			password: "Tr#42",
			repeatPassword: "Tr#42",
		});

		assert.equal(result.fieldErrors.password, "too_short");
	});

	for (const [missingRequirement, password] of [
		["uppercase", "trail#42"],
		["lowercase", "TRAIL#42"],
		["number", "Trail###"],
		["symbol", "Trail123"],
	] as const) {
		it(`requires a password ${missingRequirement}`, () => {
			const result = validateRegisterInput({
				...validInput,
				password,
				repeatPassword: password,
			});

			assert.equal(result.fieldErrors.password, "weak_format");
			assert.equal(result.isValid, false);
		});
	}

	it("requires the repeated password to match", () => {
		const result = validateRegisterInput({
			...validInput,
			repeatPassword: "Other#42",
		});

		assert.deepEqual(result.fieldErrors, { repeatPassword: "mismatch" });
		assert.equal(result.isValid, false);
	});

	it("accepts a valid registration without changing password values", () => {
		const result = validateRegisterInput(validInput);

		assert.deepEqual(result.fieldErrors, {});
		assert.equal(result.isValid, true);
		assert.deepEqual(result.submission, validInput);
	});
});
