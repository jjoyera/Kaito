import type { BaselineDraft, FieldErrors } from "../_domain/step-validation";
import { fieldErrorMessage } from "./field-messages";
import { NumberField } from "./number-field";

type BaselineStepProps = Readonly<{
	value: BaselineDraft;
	errors: FieldErrors;
	onChange: (patch: Partial<BaselineDraft>) => void;
}>;

export function BaselineStep({ value, errors, onChange }: BaselineStepProps) {
	return (
		<fieldset className="onboarding-step">
			<legend>¿Cómo han sido tus últimas 4 semanas?</legend>

			<NumberField
				id="baseline-sessions"
				label="Sesiones de entrenamiento"
				value={value.sessions}
				min={0}
				error={fieldErrorMessage(
					errors["profile.baseline_4_weeks.sessions"],
					"Sesiones de entrenamiento",
				)}
				onChange={(next) => onChange({ sessions: next })}
			/>
			<NumberField
				id="baseline-training-hours"
				label="Horas totales de entrenamiento (acepta medias horas)"
				value={value.training_hours}
				step={0.5}
				min={0}
				error={fieldErrorMessage(
					errors["profile.baseline_4_weeks.training_hours"],
					"Horas totales de entrenamiento",
				)}
				onChange={(next) => onChange({ training_hours: next })}
			/>
			<NumberField
				id="baseline-distance-km"
				label="Distancia total (km)"
				value={value.distance_km}
				min={0}
				error={fieldErrorMessage(
					errors["profile.baseline_4_weeks.distance_km"],
					"Distancia total",
				)}
				onChange={(next) => onChange({ distance_km: next })}
			/>
			<NumberField
				id="baseline-positive-elevation-m"
				label="Desnivel positivo acumulado (m)"
				value={value.positive_elevation_m}
				min={0}
				error={fieldErrorMessage(
					errors["profile.baseline_4_weeks.positive_elevation_m"],
					"Desnivel positivo acumulado",
				)}
				onChange={(next) => onChange({ positive_elevation_m: next })}
			/>
			<NumberField
				id="baseline-longest-outing-km"
				label="Salida más larga (km)"
				value={value.longest_outing_km}
				min={0}
				error={fieldErrorMessage(
					errors["profile.baseline_4_weeks.longest_outing_km"],
					"Salida más larga",
				)}
				onChange={(next) => onChange({ longest_outing_km: next })}
			/>
		</fieldset>
	);
}
