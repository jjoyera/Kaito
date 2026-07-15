type NumberFieldProps = Readonly<{
	id: string;
	label: string;
	value: number | undefined;
	error?: string;
	step?: number;
	min?: number;
	onChange: (next: number | undefined) => void;
}>;

export function NumberField({
	id,
	label,
	value,
	error,
	step,
	min,
	onChange,
}: NumberFieldProps) {
	return (
		<div className="onboarding-field">
			<label htmlFor={id}>{label}</label>
			<input
				id={id}
				type="number"
				step={step}
				min={min}
				value={value ?? ""}
				aria-invalid={Boolean(error)}
				aria-describedby={error ? `${id}-error` : undefined}
				onChange={(event) => {
					const raw = event.target.value;
					onChange(raw === "" ? undefined : Number(raw));
				}}
			/>
			{error ? (
				<p className="onboarding-field-error" id={`${id}-error`} role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
