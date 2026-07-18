import type {
	FieldErrors,
	PhysicalStatus,
	PhysicalStatusDraft,
} from "../_domain/step-validation";
import { fieldErrorMessage } from "./field-messages";

type PhysicalStatusOption = Readonly<{
	value: PhysicalStatus;
	label: string;
}>;

type PhysicalStatusStepProps = Readonly<{
	value: PhysicalStatusDraft;
	errors: FieldErrors;
	onChange: (patch: Partial<PhysicalStatusDraft>) => void;
}>;

const STATUS_OPTIONS: readonly PhysicalStatusOption[] = [
	{ value: "feeling_good", label: "Me siento bien" },
	{ value: "carrying_fatigue", label: "Algo cargada" },
	{ value: "recovering", label: "Recuperándome" },
];

export function PhysicalStatusStep({
	value,
	errors,
	onChange,
}: PhysicalStatusStepProps) {
	const statusError = fieldErrorMessage(
		errors["profile.physical_status.status"],
		"Estado físico actual",
	);
	const detailError = fieldErrorMessage(
		errors["profile.physical_status.pain_or_limitation_detail"],
		"Dolor o limitación actual",
	);

	return (
		<fieldset className="onboarding-step onboarding-physical-status">
			<legend className="onboarding-visually-hidden">Estado físico</legend>
			<div className="onboarding-field onboarding-pill-field">
				<p className="onboarding-preference-label" id="physical-status-label">
					Estado físico actual
				</p>
				<div
					className="onboarding-pill-options"
					role="radiogroup"
					aria-labelledby="physical-status-label"
					aria-describedby={statusError ? "physical-status-error" : undefined}
					aria-invalid={Boolean(statusError)}
				>
					{STATUS_OPTIONS.map((option) => (
						<label className="onboarding-choice-pill" key={option.value}>
							<input
								type="radio"
								name="physical-status"
								value={option.value}
								checked={value.status === option.value}
								onChange={() => onChange({ status: option.value })}
							/>
							<span>{option.label}</span>
						</label>
					))}
				</div>
				{statusError ? (
					<p className="onboarding-field-error" id="physical-status-error" role="alert">
						{statusError}
					</p>
				) : null}
			</div>

			<div className="onboarding-field">
				<label htmlFor="pain-or-limitation-detail">
					¿Dolor o limitación actual? <span className="onboarding-optional-indicator">(opcional)</span>
				</label>
				<textarea
					id="pain-or-limitation-detail"
					name="pain-or-limitation-detail"
					maxLength={500}
					placeholder="Ninguna relevante ahora mismo."
					value={value.pain_or_limitation_detail ?? ""}
					aria-describedby={detailError ? "pain-or-limitation-detail-error" : undefined}
					aria-invalid={Boolean(detailError)}
					onChange={(event) =>
						onChange({ pain_or_limitation_detail: event.target.value })
					}
				/>
				{detailError ? (
					<p
						className="onboarding-field-error"
						id="pain-or-limitation-detail-error"
						role="alert"
					>
						{detailError}
					</p>
				) : null}
			</div>
		</fieldset>
	);
}
