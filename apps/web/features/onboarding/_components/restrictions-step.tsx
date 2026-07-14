import type {
	FieldErrors,
	RestrictionsDraft,
} from "../_domain/step-validation";
import { fieldErrorMessage } from "./field-messages";

type RestrictionsStepProps = {
	value: RestrictionsDraft;
	errors: FieldErrors;
	onChange: (patch: Partial<RestrictionsDraft>) => void;
};

export function RestrictionsStep({
	value,
	errors,
	onChange,
}: RestrictionsStepProps) {
	const hasRestrictions = value.has_restrictions;

	return (
		<fieldset className="onboarding-step">
			<legend>¿Tienes restricciones o molestias a tener en cuenta?</legend>
			<div
				className="onboarding-field"
				role="radiogroup"
				aria-label="¿Tienes restricciones?"
			>
				<label>
					<input
						type="radio"
						name="has-restrictions"
						checked={hasRestrictions === true}
						onChange={() => onChange({ has_restrictions: true })}
					/>
					Sí
				</label>
				<label>
					<input
						type="radio"
						name="has-restrictions"
						checked={hasRestrictions === false}
						onChange={() =>
							onChange({ has_restrictions: false, detail: undefined })
						}
					/>
					No
				</label>
				{errors["profile.restrictions.has_restrictions"] ? (
					<p className="onboarding-field-error" role="alert">
						{fieldErrorMessage(
							errors["profile.restrictions.has_restrictions"],
							"Restricciones",
						)}
					</p>
				) : null}
			</div>
			{hasRestrictions ? (
				<div className="onboarding-field">
					<label htmlFor="restrictions-detail">Cuéntanos brevemente</label>
					<textarea
						id="restrictions-detail"
						value={value.detail ?? ""}
						maxLength={500}
						aria-invalid={Boolean(errors["profile.restrictions.detail"])}
						aria-describedby={
							errors["profile.restrictions.detail"]
								? "restrictions-detail-error"
								: undefined
						}
						onChange={(event) => onChange({ detail: event.target.value })}
					/>
					{errors["profile.restrictions.detail"] ? (
						<p
							className="onboarding-field-error"
							id="restrictions-detail-error"
							role="alert"
						>
							{fieldErrorMessage(
								errors["profile.restrictions.detail"],
								"Detalle de la restricción",
							)}
						</p>
					) : null}
				</div>
			) : null}
		</fieldset>
	);
}
