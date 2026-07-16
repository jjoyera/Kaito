type StepNavigatorProps = Readonly<{
	currentStepIndex: number;
}>;

const DISPLAYED_STEP_COUNT = 7;

export function StepNavigator({ currentStepIndex }: StepNavigatorProps) {
	const displayedStep = currentStepIndex + 1;
	const percentage = Math.round((displayedStep / DISPLAYED_STEP_COUNT) * 100);

	return (
		<nav className="onboarding-progress" aria-label="Progreso del onboarding">
			<div className="onboarding-progress-copy">
				<span>
					Paso {displayedStep} de {DISPLAYED_STEP_COUNT}
				</span>
				<span>{percentage}%</span>
			</div>
			<div
				className="onboarding-progress-track"
				role="progressbar"
				aria-label="Progreso"
				aria-valuemin={0}
				aria-valuemax={DISPLAYED_STEP_COUNT}
				aria-valuenow={displayedStep}
			>
				<span
					className="onboarding-progress-fill"
					style={{ width: `${percentage}%` }}
				/>
			</div>
		</nav>
	);
}
