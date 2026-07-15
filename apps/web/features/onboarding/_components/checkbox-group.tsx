type CheckboxGroupProps<T extends string> = Readonly<{
	legend: string;
	options: readonly { value: T; label: string }[];
	selected: T[] | undefined;
	error?: string;
	onChange: (next: T[]) => void;
}>;

export function CheckboxGroup<T extends string>({
	legend,
	options,
	selected,
	error,
	onChange,
}: CheckboxGroupProps<T>) {
	const current = selected ?? [];

	return (
		<fieldset className="onboarding-field">
			<legend>{legend}</legend>
			{options.map((option) => {
				const checked = current.includes(option.value);
				return (
					<label key={option.value} className="onboarding-checkbox">
						<input
							type="checkbox"
							checked={checked}
							onChange={() =>
								onChange(
									checked
										? current.filter((item) => item !== option.value)
										: [...current, option.value],
								)
							}
						/>
						{option.label}
					</label>
				);
			})}
			{error ? (
				<p className="onboarding-field-error" role="alert">
					{error}
				</p>
			) : null}
		</fieldset>
	);
}
