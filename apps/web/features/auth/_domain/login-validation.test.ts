import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateLoginInput } from "./login-validation";

describe("validateLoginInput", () => {
	it("requires an email address", () => {
		const result = validateLoginInput({ email: "", password: "trail-pass" });

		assert.deepEqual(result.fieldErrors, { email: "required" });
		assert.equal(result.isValid, false);
	});

	it("rejects an invalid email shape", () => {
		const result = validateLoginInput({
			email: "runner-at-kaito",
			password: "trail-pass",
		});

		assert.deepEqual(result.fieldErrors, { email: "invalid_format" });
		assert.equal(result.isValid, false);
	});

	it("requires a password", () => {
		const result = validateLoginInput({
			email: "runner@kaito.app",
			password: "",
		});

		assert.deepEqual(result.fieldErrors, { password: "required" });
		assert.equal(result.isValid, false);
	});

	it("accepts valid email and password input", () => {
		const result = validateLoginInput({
			email: "runner@kaito.app",
			password: "trail-pass",
		});

		assert.deepEqual(result.fieldErrors, {});
		assert.equal(result.isValid, true);
		assert.equal(result.submission.email, "runner@kaito.app");
		assert.equal(result.submission.password, "trail-pass");
	});

	it("trims the email used for submission", () => {
		const result = validateLoginInput({
			email: "  runner@kaito.app  ",
			password: "trail-pass",
		});

		assert.equal(result.isValid, true);
		assert.equal(result.submission.email, "runner@kaito.app");
	});

	it("preserves the visible email value for correction", () => {
		const result = validateLoginInput({
			email: "  runner@kaito.app  ",
			password: "trail-pass",
		});

		assert.equal(result.visible.email, "  runner@kaito.app  ");
	});
});
