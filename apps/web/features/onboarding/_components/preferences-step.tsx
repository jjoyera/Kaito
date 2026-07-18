import type {
	FieldErrors,
	GymAccess,
	MountainTrailAccess,
	PlanningPreference,
	TrainingPreferencesDraft,
} from "../_domain/step-validation";
import { fieldErrorMessage } from "./field-messages";

type PreferenceOption<T extends string> = Readonly<{
	value: T;
	label: string;
}>;

type PreferencesStepProps = Readonly<{
	value: TrainingPreferencesDraft;
	errors: FieldErrors;
	onChange: (patch: Partial<TrainingPreferencesDraft>) => void;
}>;

const MOUNTAIN_OPTIONS: readonly PreferenceOption<MountainTrailAccess>[] = [
	{ value: "easy_access", label: "Sí, fácil acceso" },
	{ value: "weekends_only", label: "Solo fines de semana" },
	{ value: "very_limited", label: "Muy limitado" },
];
const GYM_OPTIONS: readonly PreferenceOption<GymAccess>[] = [
	{ value: "yes", label: "Sí" },
	{ value: "home_only", label: "Solo en casa" },
];
const PLANNING_OPTIONS: readonly PreferenceOption<PlanningPreference>[] = [
	{ value: "fixed_routine", label: "Rutina fija" },
	{ value: "flexible_weekly", label: "Flexible por semana" },
];

function PreferenceRadioGroup<T extends string>({
	label,
	name,
	options,
	selected,
	error,
	onChange,
}: Readonly<{
	label: string;
	name: string;
	options: readonly PreferenceOption<T>[];
	selected: T | undefined;
	error?: string;
	onChange: (value: T) => void;
}>) {
	const errorId = `${name}-error`;
	return (
		<div className="onboarding-field onboarding-pill-field">
			<p className="onboarding-preference-label" id={`${name}-label`}>
				{label}
			</p>
			<div
				className="onboarding-pill-options"
				role="radiogroup"
				aria-labelledby={`${name}-label`}
				aria-describedby={error ? errorId : undefined}
				aria-invalid={Boolean(error)}
			>
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
			{error ? (
				<p className="onboarding-field-error" id={errorId} role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}

export function PreferencesStep({ value, errors, onChange }: PreferencesStepProps) {
	return (
		<fieldset className="onboarding-step onboarding-preferences">
			<legend className="onboarding-visually-hidden">Tus preferencias y recursos</legend>
			<PreferenceRadioGroup
				label="Acceso a montaña / desnivel"
				name="mountain-trail-access"
				options={MOUNTAIN_OPTIONS}
				selected={value.mountain_trail_access}
				error={fieldErrorMessage(
					errors["profile.training_preferences.mountain_trail_access"],
					"Acceso a montaña / desnivel",
				)}
				onChange={(mountain_trail_access) => onChange({ mountain_trail_access })}
			/>
			<PreferenceRadioGroup
				label="Acceso a gimnasio"
				name="gym-access"
				options={GYM_OPTIONS}
				selected={value.gym_access}
				error={fieldErrorMessage(
					errors["profile.training_preferences.gym_access"],
					"Acceso a gimnasio",
				)}
				onChange={(gym_access) => onChange({ gym_access })}
			/>
			<PreferenceRadioGroup
				label="Preferencia de planificación"
				name="planning-preference"
				options={PLANNING_OPTIONS}
				selected={value.planning_preference}
				error={fieldErrorMessage(
					errors["profile.training_preferences.planning_preference"],
					"Preferencia de planificación",
				)}
				onChange={(planning_preference) => onChange({ planning_preference })}
			/>
		</fieldset>
	);
}
