import type { FieldErrorCode } from "../_domain/step-validation";

export function fieldErrorMessage(
	code: FieldErrorCode | undefined,
	label: string,
): string | undefined {
	switch (code) {
		case "required":
			return `Este campo es obligatorio: ${label}.`;
		case "invalid_type":
			return `El valor de "${label}" no es válido.`;
		case "out_of_range":
			return `Revisa el valor de "${label}".`;
		case "invalid_length":
			return `El texto de "${label}" debe tener entre 1 y 500 caracteres.`;
		default:
			return undefined;
	}
}
