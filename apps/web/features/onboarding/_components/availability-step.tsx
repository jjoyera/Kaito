import type {
	AvailabilityDraft,
	FieldErrors,
	WeekDay,
} from "../_domain/step-validation";

type AvailabilityStepProps = {
	value: AvailabilityDraft;
	errors: FieldErrors;
	onChange: (patch: Partial<AvailabilityDraft>) => void;
};

const WEEK_DAY_LABELS: Record<WeekDay, string> = {
	monday: "Lunes",
	tuesday: "Martes",
	wednesday: "Miércoles",
	thursday: "Jueves",
	friday: "Viernes",
	saturday: "Sábado",
	sunday: "Domingo",
};

const WEEK_DAYS_ORDER: readonly WeekDay[] = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
];

export function AvailabilityStep({
	value,
	errors,
	onChange,
}: AvailabilityStepProps) {
	const minutesByDay = value.minutes_by_day ?? {};
	const error = errors["profile.availability.minutes_by_day"];

	function toggleDay(day: WeekDay, enabled: boolean) {
		const next = { ...minutesByDay };
		if (enabled) {
			next[day] = 60;
		} else {
			delete next[day];
		}
		onChange({ minutes_by_day: next });
	}

	function setMinutes(day: WeekDay, minutes: number | undefined) {
		onChange({ minutes_by_day: { ...minutesByDay, [day]: minutes } });
	}

	return (
		<fieldset className="onboarding-step">
			<legend>¿Qué disponibilidad semanal tienes?</legend>
			{WEEK_DAYS_ORDER.map((day) => {
				const enabled = minutesByDay[day] !== undefined;
				return (
					<div key={day} className="onboarding-availability-day">
						<label>
							<input
								type="checkbox"
								checked={enabled}
								onChange={(event) => toggleDay(day, event.target.checked)}
							/>
							{WEEK_DAY_LABELS[day]}
						</label>
						{enabled ? (
							<input
								type="number"
								min={15}
								max={300}
								aria-label={`Minutos disponibles el ${WEEK_DAY_LABELS[day]}`}
								value={minutesByDay[day] ?? ""}
								onChange={(event) => {
									const raw = event.target.value;
									setMinutes(day, raw === "" ? undefined : Number(raw));
								}}
							/>
						) : null}
					</div>
				);
			})}
			{error ? (
				<p className="onboarding-field-error" role="alert">
					{error === "invalid_type"
						? "Cada día marcado debe tener entre 15 y 300 minutos."
						: "Marca al menos 3 días con un total de 150 minutos o más por semana."}
				</p>
			) : null}
		</fieldset>
	);
}
