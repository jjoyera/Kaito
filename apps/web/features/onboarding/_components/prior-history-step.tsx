import type {
	FieldErrors,
	Modality,
	PracticedTerrain,
	PriorHistoryDraft,
	RaceCountRange,
} from "../_domain/step-validation";
import { CheckboxGroup } from "./checkbox-group";
import { fieldErrorMessage } from "./field-messages";
import { NumberField } from "./number-field";

type PriorHistoryStepProps = Readonly<{
	value: PriorHistoryDraft;
	errors: FieldErrors;
	onChange: (patch: Partial<PriorHistoryDraft>) => void;
}>;

const RACE_COUNT_LABELS: Record<RaceCountRange, string> = {
	none: "Ninguna",
	one_to_three: "1 a 3",
	four_to_ten: "4 a 10",
	eleven_to_twenty_five: "11 a 25",
	twenty_six_plus: "26 o más",
};

const MODALITY_OPTIONS: readonly { value: Modality; label: string }[] = [
	{ value: "trail", label: "Trail" },
	{ value: "ultra_trail", label: "Ultra-trail" },
	{ value: "ocr", label: "OCR" },
	{ value: "backyard", label: "Backyard Ultra" },
];

const TERRAIN_OPTIONS: readonly { value: PracticedTerrain; label: string }[] =
	[
		{ value: "road", label: "Asfalto" },
		{ value: "trail", label: "Sendero" },
		{ value: "mountain", label: "Montaña" },
		{ value: "mixed", label: "Mixto" },
	];

export function PriorHistoryStep({
	value,
	errors,
	onChange,
}: PriorHistoryStepProps) {
	return (
		<fieldset className="onboarding-step">
			<legend>Cuéntanos tu experiencia previa</legend>

			<NumberField
				id="prior-history-training-years"
				label="Años entrenando (acepta medios años, ej. 1.5)"
				value={value.training_years}
				step={0.5}
				min={0}
				error={fieldErrorMessage(
					errors["profile.prior_history.training_years"],
					"Años entrenando",
				)}
				onChange={(next) => onChange({ training_years: next })}
			/>

			<div className="onboarding-field">
				<label htmlFor="prior-history-race-count">
					Carreras completadas hasta ahora
				</label>
				<select
					id="prior-history-race-count"
					value={value.completed_race_count_range ?? ""}
					aria-invalid={Boolean(
						errors["profile.prior_history.completed_race_count_range"],
					)}
					onChange={(event) =>
						onChange({
							completed_race_count_range: (event.target.value ||
								undefined) as RaceCountRange | undefined,
						})
					}
				>
					<option value="">Selecciona un rango</option>
					{(Object.keys(RACE_COUNT_LABELS) as RaceCountRange[]).map(
						(option) => (
							<option key={option} value={option}>
								{RACE_COUNT_LABELS[option]}
							</option>
						),
					)}
				</select>
				{errors["profile.prior_history.completed_race_count_range"] ? (
					<p className="onboarding-field-error" role="alert">
						{fieldErrorMessage(
							errors["profile.prior_history.completed_race_count_range"],
							"Carreras completadas",
						)}
					</p>
				) : null}
			</div>

			<NumberField
				id="prior-history-longest-distance"
				label="Distancia más larga completada (km)"
				value={value.longest_completed_distance_km}
				min={0}
				error={fieldErrorMessage(
					errors["profile.prior_history.longest_completed_distance_km"],
					"Distancia más larga completada",
				)}
				onChange={(next) => onChange({ longest_completed_distance_km: next })}
			/>

			<CheckboxGroup
				legend="Modalidades que has practicado (marca las que apliquen; puedes dejarlo vacío)"
				options={MODALITY_OPTIONS}
				selected={value.practiced_modalities}
				error={fieldErrorMessage(
					errors["profile.prior_history.practiced_modalities"],
					"Modalidades practicadas",
				)}
				onChange={(next) => onChange({ practiced_modalities: next })}
			/>

			<CheckboxGroup
				legend="Terrenos en los que has entrenado (marca los que apliquen; puedes dejarlo vacío)"
				options={TERRAIN_OPTIONS}
				selected={value.practiced_terrain}
				error={fieldErrorMessage(
					errors["profile.prior_history.practiced_terrain"],
					"Terrenos practicados",
				)}
				onChange={(next) => onChange({ practiced_terrain: next })}
			/>
		</fieldset>
	);
}
