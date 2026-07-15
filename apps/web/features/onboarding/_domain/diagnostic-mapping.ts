import { ONBOARDING_STEPS, type StepId } from "./steps";

const FIELD_TO_STEP: ReadonlyMap<string, StepId> = new Map(
	ONBOARDING_STEPS.flatMap((step) =>
		step.fields.map((field) => [field, step.id] as const),
	),
);

export function stepForField(field: string): StepId {
	const step = FIELD_TO_STEP.get(field);
	if (step === undefined) {
		throw new Error(`onboarding: no wizard step owns field "${field}"`);
	}
	return step;
}

export function mapDiagnosticFieldsToSteps(
	fields: readonly string[],
): StepId[] {
	const affected = new Set(fields.map(stepForField));
	return ONBOARDING_STEPS.filter((step) => affected.has(step.id)).map(
		(step) => step.id,
	);
}
