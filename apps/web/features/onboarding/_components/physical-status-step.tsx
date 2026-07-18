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
	const painError = fieldErrorMessage(
		errors["profile.physical_status.has_pain_or_limitation"],
		"Dolor o limitación actual",
	);
	const impactError = fieldErrorMessage(
		errors["profile.physical_status.pain_or_limitation_affects_running"],
		"Impacto al correr",
	);
	const detailError = fieldErrorMessage(
		errors["profile.physical_status.pain_or_limitation_detail"],
		"Detalle del dolor o limitación",
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

			<fieldset className="onboarding-field onboarding-pill-field">
				<legend>¿Tienes dolor o alguna limitación actual?</legend>
				<div className="onboarding-pill-options">
					<label className="onboarding-choice-pill">
						<input type="radio" name="has-pain" checked={value.has_pain_or_limitation === true} onChange={() => onChange({ has_pain_or_limitation: true })} />
						<span>Sí</span>
					</label>
					<label className="onboarding-choice-pill">
						<input type="radio" name="has-pain" checked={value.has_pain_or_limitation === false} onChange={() => onChange({ has_pain_or_limitation: false, pain_or_limitation_affects_running: undefined, pain_or_limitation_detail: undefined })} />
						<span>No</span>
					</label>
				</div>
				{painError ? <p className="onboarding-field-error" role="alert">{painError}</p> : null}
			</fieldset>

			{value.has_pain_or_limitation ? (
				<>
					<fieldset className="onboarding-field onboarding-pill-field">
						<legend>¿Afecta a tu forma de correr?</legend>
						<div className="onboarding-pill-options">
							<label className="onboarding-choice-pill">
								<input type="radio" name="pain-affects-running" checked={value.pain_or_limitation_affects_running === true} onChange={() => onChange({ pain_or_limitation_affects_running: true })} />
								<span>Sí</span>
							</label>
							<label className="onboarding-choice-pill">
								<input type="radio" name="pain-affects-running" checked={value.pain_or_limitation_affects_running === false} onChange={() => onChange({ pain_or_limitation_affects_running: false })} />
								<span>No</span>
							</label>
						</div>
						{impactError ? <p className="onboarding-field-error" role="alert">{impactError}</p> : null}
					</fieldset>
					<div className="onboarding-field">
						<label htmlFor="pain-or-limitation-detail">Describe brevemente la molestia <span className="onboarding-optional-indicator">(opcional)</span></label>
						<textarea id="pain-or-limitation-detail" name="pain-or-limitation-detail" maxLength={500} value={value.pain_or_limitation_detail ?? ""} aria-describedby={detailError ? "pain-or-limitation-detail-error" : undefined} aria-invalid={Boolean(detailError)} onChange={(event) => onChange({ pain_or_limitation_detail: event.target.value })} />
						{detailError ? <p className="onboarding-field-error" id="pain-or-limitation-detail-error" role="alert">{detailError}</p> : null}
					</div>
				</>
			) : null}
		</fieldset>
	);
}
