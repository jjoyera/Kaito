import { ONBOARDING_STEPS, type StepId } from "../_domain/steps";

export type StepStatus = "complete" | "incomplete" | "not_reached";

type StepNavigatorProps = Readonly<{
	currentStepIndex: number;
	statuses: readonly StepStatus[];
	onJump: (index: number) => void;
}>;

const STEP_LABELS: Record<StepId, string> = {
	goal: "Objetivo",
	prior_history: "Historial previo",
	baseline: "Últimas 4 semanas",
	availability: "Disponibilidad",
	restrictions: "Restricciones",
};

export function StepNavigator({
	currentStepIndex,
	statuses,
	onJump,
}: StepNavigatorProps) {
	return (
		<nav className="onboarding-nav" aria-label="Progreso del onboarding">
			<ol className="onboarding-nav-list">
				{ONBOARDING_STEPS.map((step, index) => {
					const status = statuses[index] ?? "not_reached";
					const reached = status !== "not_reached";
					const isCurrent = index === currentStepIndex;
					return (
						<li key={step.id}>
							<button
								type="button"
								className="onboarding-nav-step"
								data-status={status}
								aria-current={isCurrent ? "step" : undefined}
								disabled={!reached}
								onClick={() => onJump(index)}
							>
								<span className="onboarding-nav-step-index">{index + 1}</span>
								<span className="onboarding-nav-step-label">
									{STEP_LABELS[step.id]}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
