import type {
	AvailabilityAction,
	AvailabilityInteractionState,
	AvailabilityIssue,
} from "../_domain/availability-model";
import { WEEKDAY_ORDER } from "../_domain/availability-model";
import type { WeekDay } from "../_domain/step-validation";

type AvailabilityStepProps = Readonly<{
	value: AvailabilityInteractionState;
	issues: readonly AvailabilityIssue[];
	onAction: (action: AvailabilityAction) => void;
}>;

const WEEK_DAY_LABELS: Record<WeekDay, string> = {
	monday: "Lunes",
	tuesday: "Martes",
	wednesday: "Miércoles",
	thursday: "Jueves",
	friday: "Viernes",
	saturday: "Sábado",
	sunday: "Domingo",
};

const WEEK_DAY_INITIALS: Record<WeekDay, string> = {
	monday: "L",
	tuesday: "M",
	wednesday: "X",
	thursday: "J",
	friday: "V",
	saturday: "S",
	sunday: "D",
};

const PRESETS = [
	{ minutes: 45 as const, label: "45 min" },
	{ minutes: 60 as const, label: "1 h–1 h 30" },
	{ minutes: 120 as const, label: "2 h+" },
];

const ISSUE_MESSAGES: Record<AvailabilityIssue, string> = {
	exact_value_required: "Indica los minutos exactos de cada día seleccionado.",
	invalid_day_value: "Cada día marcado debe tener entre 15 y 300 minutos enteros.",
	insufficient_days: "Selecciona al menos 3 días para entrenar.",
	insufficient_weekly_minutes:
		"Necesitas al menos 150 minutos semanales: añade otro día o aumenta tu tiempo disponible.",
};

function isSelected(value: AvailabilityInteractionState, day: WeekDay): boolean {
	return value.minutesByDay[day] !== undefined || value.pendingDays.includes(day);
}

function derivedStatus(value: AvailabilityInteractionState): string | null {
	if (value.baseMode.kind === "mixed") return "Varía por día";
	if (value.baseMode.kind === "uniform-custom") {
		return `Duración uniforme personalizada: ${value.baseMode.minutes} min`;
	}
	return null;
}

export function AvailabilityStep({
	value,
	issues,
	onAction,
}: AvailabilityStepProps) {
	const invalid = issues.length > 0;
	const feedbackId = "availability-feedback";
	const status = derivedStatus(value);

	return (
		<div className="onboarding-availability">
			<fieldset
				className="onboarding-field onboarding-availability-days"
				aria-describedby={feedbackId}
				aria-invalid={invalid || undefined}
			>
				<legend>¿Qué días puedes entrenar?</legend>
				<div className="onboarding-pill-options">
					{WEEKDAY_ORDER.map((day) => (
						<label key={day} className="onboarding-choice-pill">
							<input
								type="checkbox"
								checked={isSelected(value, day)}
								onChange={() => onAction({ type: "toggle-day", day })}
								aria-label={WEEK_DAY_LABELS[day]}
								aria-describedby={feedbackId}
							/>
							<span aria-hidden="true">{WEEK_DAY_INITIALS[day]}</span>
						</label>
					))}
				</div>
			</fieldset>

			<fieldset
				className="onboarding-field onboarding-availability-presets"
				role="radiogroup"
				aria-describedby={feedbackId}
			>
				<legend>Duración habitual</legend>
				<div className="onboarding-pill-options">
					{PRESETS.map(({ minutes, label }) => (
						<label key={minutes} className="onboarding-choice-pill">
							<input
								type="radio"
								name="availability-preset"
								checked={
									value.baseMode.kind === "preset" &&
									value.baseMode.minutes === minutes
								}
								onChange={() => onAction({ type: "choose-preset", minutes })}
								aria-describedby={feedbackId}
							/>
							<span>{label}</span>
						</label>
					))}
				</div>
				{status ? <p className="onboarding-availability-status">{status}</p> : null}
			</fieldset>

			{WEEKDAY_ORDER.some((day) => isSelected(value, day)) ? (
				<div className="onboarding-availability-exact">
					<h2>Ajusta los minutos exactos si lo necesitas</h2>
					{WEEKDAY_ORDER.filter((day) => isSelected(value, day)).map((day) => (
						<label key={day} className="onboarding-availability-exact-row">
							<span>{WEEK_DAY_LABELS[day]}</span>
							<input
								type="number"
								min={15}
								max={300}
								inputMode="numeric"
								aria-label={`Minutos disponibles el ${WEEK_DAY_LABELS[day]}`}
								aria-describedby={feedbackId}
								aria-invalid={invalid || undefined}
								value={value.minutesByDay[day] ?? ""}
								onChange={(event) => {
									const raw = event.target.value;
									onAction({
										type: "set-exact-minutes",
										day,
										minutes: raw === "" ? undefined : Number(raw),
									});
								}}
							/>
						</label>
					))}
				</div>
			) : null}

			<div id={feedbackId} aria-live="polite">
				{issues.length > 0 ? (
					<div className="onboarding-field-error" role="alert">
						{issues.map((issue) => (
							<p key={issue}>{ISSUE_MESSAGES[issue]}</p>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}
