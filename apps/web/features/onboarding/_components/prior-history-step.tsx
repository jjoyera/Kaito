import type {
	FieldErrors,
	GoalDraft,
	HabitualTerrain,
	MountainExperience,
	PriorHistoryDraft,
	PriorModalityRaceFrequency,
} from "../_domain/step-validation";
import { fieldErrorMessage } from "./field-messages";
import { NumberField } from "./number-field";

type PriorHistoryStepProps = Readonly<{
	value: PriorHistoryDraft;
	goalModality: GoalDraft["modality"];
	errors: FieldErrors;
	onChange: (patch: Partial<PriorHistoryDraft>) => void;
}>;

type PillOption<T extends string> = Readonly<{ value: T; label: string }>;

const TERRAIN_OPTIONS: readonly PillOption<HabitualTerrain>[] = [
	{ value: "mountain", label: "Montaña" },
	{ value: "trail", label: "Sendero/pista" },
	{ value: "road", label: "Asfalto" },
	{ value: "mixed", label: "Mixto" },
];

const EXPERIENCE_OPTIONS: readonly PillOption<MountainExperience>[] = [
	{ value: "low", label: "Baja" },
	{ value: "medium", label: "Media" },
	{ value: "high", label: "Alta" },
];

const RACE_FREQUENCY_OPTIONS: readonly PillOption<PriorModalityRaceFrequency>[] = [
	{ value: "once", label: "Sí, una vez" },
	{ value: "multiple", label: "Varias veces" },
	{ value: "never", label: "Nunca" },
];

function PillRadioGroup<T extends string>({
	legend,
	name,
	options,
	selected,
	error,
	onChange,
}: Readonly<{
	legend: string;
	name: string;
	options: readonly PillOption<T>[];
	selected: T | undefined;
	error?: string;
	onChange: (value: T) => void;
}>) {
	return (
		<fieldset className="onboarding-field onboarding-pill-field">
			<legend>{legend}</legend>
			<div className="onboarding-pill-options">
				{options.map((option) => (
					<label className="onboarding-choice-pill" key={option.value}>
						<input
							type="radio"
							name={name}
							value={option.value}
							checked={selected === option.value}
							onChange={() => onChange(option.value)}
						/>
						<span>{option.label}</span>
					</label>
				))}
			</div>
			{error ? <p className="onboarding-field-error" role="alert">{error}</p> : null}
		</fieldset>
	);
}

export function PriorHistoryStep({
	value,
	goalModality,
	errors,
	onChange,
}: PriorHistoryStepProps) {
	const priorRaceLegend =
		goalModality === "ultra_trail"
			? "¿Has corrido un ultra antes?"
			: "¿Has corrido un trail antes?";

	return (
		<fieldset className="onboarding-step onboarding-prior-history">
			<legend className="onboarding-visually-hidden">
				¿Cuál es tu experiencia previa?
			</legend>

			<div className="onboarding-prior-history-row">
				<NumberField
					id="prior-history-longest-distance"
					label="Distancia más larga completada"
					value={value.longest_completed_distance_km}
					min={0}
					suffix="km"
					error={fieldErrorMessage(
						errors["profile.prior_history.longest_completed_distance_km"],
						"Distancia más larga completada",
					)}
					onChange={(next) => onChange({ longest_completed_distance_km: next })}
				/>

				<div className="onboarding-field">
					<label htmlFor="prior-history-habitual-terrain">Terreno habitual</label>
					<select
						id="prior-history-habitual-terrain"
						value={value.habitual_terrain ?? ""}
						aria-invalid={Boolean(errors["profile.prior_history.habitual_terrain"])}
						onChange={(event) =>
							onChange({ habitual_terrain: (event.target.value || undefined) as HabitualTerrain | undefined })
						}
					>
						<option value="">Selecciona un terreno</option>
						{TERRAIN_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>{option.label}</option>
						))}
					</select>
					{errors["profile.prior_history.habitual_terrain"] ? (
						<p className="onboarding-field-error" role="alert">
							{fieldErrorMessage(errors["profile.prior_history.habitual_terrain"], "Terreno habitual")}
						</p>
					) : null}
				</div>
			</div>

			<PillRadioGroup
				legend="Experiencia en montaña"
				name="mountain-experience"
				options={EXPERIENCE_OPTIONS}
				selected={value.mountain_experience}
				error={fieldErrorMessage(errors["profile.prior_history.mountain_experience"], "Experiencia en montaña")}
				onChange={(next) => onChange({ mountain_experience: next })}
			/>
			<PillRadioGroup
				legend={priorRaceLegend}
				name="prior-modality-race-frequency"
				options={RACE_FREQUENCY_OPTIONS}
				selected={value.prior_modality_race_frequency}
				error={fieldErrorMessage(errors["profile.prior_history.prior_modality_race_frequency"], priorRaceLegend)}
				onChange={(next) => onChange({ prior_modality_race_frequency: next })}
			/>
		</fieldset>
	);
}
