import type {
	FieldErrors,
	GoalDraft,
	Modality,
} from "../_domain/step-validation";
import { fieldErrorMessage } from "./field-messages";
import { NumberField } from "./number-field";

type GoalStepProps = Readonly<{
	value: GoalDraft;
	errors: FieldErrors;
	onChange: (patch: Partial<GoalDraft>) => void;
}>;

const GOAL_MODALITIES: readonly { value: Modality; label: string }[] = [
	{ value: "trail", label: "Trail" },
	{ value: "ultra_trail", label: "Ultra" },
];

export function GoalStep({ value, errors, onChange }: GoalStepProps) {
	return (
		<fieldset className="onboarding-step">
			<legend className="onboarding-visually-hidden">
				Empecemos por tu objetivo
			</legend>

			<fieldset className="onboarding-field onboarding-race-types">
				<legend>Tipo de carrera</legend>
				<div className="onboarding-race-type-options">
					{GOAL_MODALITIES.map((option) => (
						<button
							key={option.value}
							type="button"
							className="onboarding-race-type-pill"
							aria-pressed={value.modality === option.value}
							onClick={() => onChange({ modality: option.value })}
						>
							{option.label}
						</button>
					))}
				</div>
				{errors["goal.modality"] ? (
					<p className="onboarding-field-error" id="goal-modality-error" role="alert">
						{fieldErrorMessage(errors["goal.modality"], "Tipo de carrera")}
					</p>
				) : null}
			</fieldset>

			<div className="onboarding-goal-metrics">
				<NumberField
					id="goal-target-distance-km"
					label="Distancia (km)"
					value={value.target_distance_km}
					error={fieldErrorMessage(
						errors["goal.target_distance_km"],
						"Distancia",
					)}
					onChange={(next) => onChange({ target_distance_km: next })}
				/>
				<NumberField
					id="goal-positive-elevation-m"
					label="Desnivel + (m)"
					value={value.positive_elevation_m}
					error={fieldErrorMessage(
						errors["goal.positive_elevation_m"],
						"Desnivel +",
					)}
					onChange={(next) => onChange({ positive_elevation_m: next })}
				/>
			</div>

			<div className="onboarding-field">
				<label htmlFor="goal-target-date">Fecha objetivo</label>
				<input
					id="goal-target-date"
					type="date"
					value={value.target_date ?? ""}
					aria-invalid={Boolean(errors["goal.target_date"])}
					aria-describedby={
						errors["goal.target_date"] ? "goal-target-date-error" : undefined
					}
					onChange={(event) =>
						onChange({ target_date: event.target.value || undefined })
					}
				/>
				{errors["goal.target_date"] ? (
					<p
						className="onboarding-field-error"
						id="goal-target-date-error"
						role="alert"
					>
						{fieldErrorMessage(errors["goal.target_date"], "Fecha objetivo")}
					</p>
				) : null}
			</div>
		</fieldset>
	);
}
