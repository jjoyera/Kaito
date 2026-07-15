import type {
	FieldErrors,
	GoalDraft,
	Modality,
	Technicality,
} from "../_domain/step-validation";
import { fieldErrorMessage } from "./field-messages";
import { NumberField } from "./number-field";

type GoalStepProps = Readonly<{
	value: GoalDraft;
	errors: FieldErrors;
	onChange: (patch: Partial<GoalDraft>) => void;
}>;

const MODALITY_LABELS: Record<Modality, string> = {
	trail: "Trail",
	ultra_trail: "Ultra-trail",
	ocr: "OCR",
	backyard: "Backyard Ultra",
};

const TECHNICALITY_LABELS: Record<Technicality, string> = {
	low: "Baja",
	medium: "Media",
	high: "Alta",
};

export function GoalStep({ value, errors, onChange }: GoalStepProps) {
	const modality = value.modality;
	const showTrailFields = modality === "trail" || modality === "ultra_trail";
	const showOcrFields = modality === "ocr";
	const showBackyardFields = modality === "backyard";

	return (
		<fieldset className="onboarding-step">
			<legend>¿Cuál es tu objetivo?</legend>

			<div className="onboarding-field">
				<label htmlFor="goal-modality">Modalidad</label>
				<select
					id="goal-modality"
					value={modality ?? ""}
					aria-invalid={Boolean(errors["goal.modality"])}
					aria-describedby={
						errors["goal.modality"] ? "goal-modality-error" : undefined
					}
					onChange={(event) =>
						onChange({
							modality: (event.target.value || undefined) as
								| Modality
								| undefined,
						})
					}
				>
					<option value="">Selecciona una modalidad</option>
					{(Object.keys(MODALITY_LABELS) as Modality[]).map((option) => (
						<option key={option} value={option}>
							{MODALITY_LABELS[option]}
						</option>
					))}
				</select>
				{errors["goal.modality"] ? (
					<p
						className="onboarding-field-error"
						id="goal-modality-error"
						role="alert"
					>
						{fieldErrorMessage(errors["goal.modality"], "Modalidad")}
					</p>
				) : null}
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

			{showTrailFields ? (
				<>
					<NumberField
						id="goal-target-distance-km"
						label="Distancia objetivo (km)"
						value={value.target_distance_km}
						error={fieldErrorMessage(
							errors["goal.target_distance_km"],
							"Distancia objetivo",
						)}
						onChange={(next) => onChange({ target_distance_km: next })}
					/>
					<NumberField
						id="goal-positive-elevation-m"
						label="Desnivel positivo (m)"
						value={value.positive_elevation_m}
						error={fieldErrorMessage(
							errors["goal.positive_elevation_m"],
							"Desnivel positivo",
						)}
						onChange={(next) => onChange({ positive_elevation_m: next })}
					/>
					<div className="onboarding-field">
						<label htmlFor="goal-technicality">Tecnicidad del recorrido</label>
						<select
							id="goal-technicality"
							value={value.technicality ?? ""}
							aria-invalid={Boolean(errors["goal.technicality"])}
							onChange={(event) =>
								onChange({
									technicality: (event.target.value || undefined) as
										| Technicality
										| undefined,
								})
							}
						>
							<option value="">Selecciona una opción</option>
							{(Object.keys(TECHNICALITY_LABELS) as Technicality[]).map(
								(option) => (
									<option key={option} value={option}>
										{TECHNICALITY_LABELS[option]}
									</option>
								),
							)}
						</select>
						{errors["goal.technicality"] ? (
							<p className="onboarding-field-error" role="alert">
								{fieldErrorMessage(
									errors["goal.technicality"],
									"Tecnicidad del recorrido",
								)}
							</p>
						) : null}
					</div>
					<NumberField
						id="goal-max-altitude-m"
						label="Altitud máxima estimada (m, opcional)"
						value={value.max_altitude_m}
						error={fieldErrorMessage(
							errors["goal.max_altitude_m"],
							"Altitud máxima estimada",
						)}
						onChange={(next) => onChange({ max_altitude_m: next })}
					/>
				</>
			) : null}

			{showOcrFields ? (
				<>
					<NumberField
						id="goal-target-distance-km"
						label="Distancia objetivo (km)"
						value={value.target_distance_km}
						error={fieldErrorMessage(
							errors["goal.target_distance_km"],
							"Distancia objetivo",
						)}
						onChange={(next) => onChange({ target_distance_km: next })}
					/>
					<NumberField
						id="goal-obstacle-count"
						label="Número de obstáculos"
						value={value.obstacle_count}
						error={fieldErrorMessage(
							errors["goal.obstacle_count"],
							"Número de obstáculos",
						)}
						onChange={(next) => onChange({ obstacle_count: next })}
					/>
					<div className="onboarding-field">
						<label htmlFor="goal-obstacle-difficulty">
							Dificultad de los obstáculos (opcional)
						</label>
						<select
							id="goal-obstacle-difficulty"
							value={value.obstacle_difficulty ?? ""}
							onChange={(event) =>
								onChange({
									obstacle_difficulty: (event.target.value || undefined) as
										| Technicality
										| undefined,
								})
							}
						>
							<option value="">Selecciona una opción</option>
							{(Object.keys(TECHNICALITY_LABELS) as Technicality[]).map(
								(option) => (
									<option key={option} value={option}>
										{TECHNICALITY_LABELS[option]}
									</option>
								),
							)}
						</select>
					</div>
				</>
			) : null}

			{showBackyardFields ? (
				<NumberField
					id="goal-target-loops"
					label="Vueltas objetivo"
					value={value.target_loops}
					error={fieldErrorMessage(
						errors["goal.target_loops"],
						"Vueltas objetivo",
					)}
					onChange={(next) => onChange({ target_loops: next })}
				/>
			) : null}
		</fieldset>
	);
}
