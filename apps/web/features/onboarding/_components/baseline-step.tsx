import type {
	BaselineDraft,
	FieldErrors,
	RecentConsistency,
} from "../_domain/step-validation";
import { fieldErrorMessage } from "./field-messages";
import { NumberField } from "./number-field";

type BaselineStepProps = Readonly<{
	value: BaselineDraft;
	errors: FieldErrors;
	onChange: (patch: Partial<BaselineDraft>) => void;
}>;

const CONSISTENCY_OPTIONS: readonly Readonly<{
	value: RecentConsistency;
	label: string;
}>[] = [
	{ value: "irregular", label: "Irregular" },
	{ value: "fairly_consistent", label: "Bastante constante" },
	{ value: "very_consistent", label: "Muy constante" },
];

export function BaselineStep({ value, errors, onChange }: BaselineStepProps) {
	const consistencyError = fieldErrorMessage(
		errors["profile.baseline_4_weeks.recent_consistency"],
		"Constancia reciente",
	);

	return (
		<fieldset className="onboarding-step onboarding-baseline">
			<legend className="onboarding-visually-hidden">
				Actividad durante las cuatro semanas anteriores
			</legend>

			<div className="onboarding-baseline-metrics">
				<NumberField
					id="baseline-sessions"
					label="Sesiones en las últimas 4 semanas"
					value={value.sessions}
					min={0}
					error={fieldErrorMessage(
						errors["profile.baseline_4_weeks.sessions"],
						"Sesiones en las últimas 4 semanas",
					)}
					onChange={(next) => onChange({ sessions: next })}
				/>
				<NumberField
					id="baseline-distance-km"
					label="Distancia total en las últimas 4 semanas"
					value={value.distance_km}
					min={0}
					suffix="km"
					error={fieldErrorMessage(
						errors["profile.baseline_4_weeks.distance_km"],
						"Distancia total en las últimas 4 semanas",
					)}
					onChange={(next) => onChange({ distance_km: next })}
				/>
				<NumberField
					id="baseline-positive-elevation-m"
					label="Desnivel positivo en las últimas 4 semanas"
					value={value.positive_elevation_m}
					min={0}
					suffix="m"
					error={fieldErrorMessage(
						errors["profile.baseline_4_weeks.positive_elevation_m"],
						"Desnivel positivo en las últimas 4 semanas",
					)}
					onChange={(next) => onChange({ positive_elevation_m: next })}
				/>
				<NumberField
					id="baseline-longest-outing-km"
					label="Salida más larga de las últimas 4 semanas"
					value={value.longest_outing_km}
					min={0}
					suffix="km"
					error={fieldErrorMessage(
						errors["profile.baseline_4_weeks.longest_outing_km"],
						"Salida más larga de las últimas 4 semanas",
					)}
					onChange={(next) => onChange({ longest_outing_km: next })}
				/>
			</div>

			<fieldset
				className="onboarding-field onboarding-pill-field"
				aria-describedby={consistencyError ? "recent-consistency-error" : undefined}
			>
				<legend>Constancia reciente</legend>
				<div className="onboarding-pill-options">
					{CONSISTENCY_OPTIONS.map((option) => (
						<label className="onboarding-choice-pill" key={option.value}>
							<input
								type="radio"
								name="recent-consistency"
								value={option.value}
								checked={value.recent_consistency === option.value}
								onChange={() => onChange({ recent_consistency: option.value })}
							/>
							<span>{option.label}</span>
						</label>
					))}
				</div>
				{consistencyError ? (
					<p
						className="onboarding-field-error"
						id="recent-consistency-error"
						role="alert"
					>
						{consistencyError}
					</p>
				) : null}
			</fieldset>
		</fieldset>
	);
}
