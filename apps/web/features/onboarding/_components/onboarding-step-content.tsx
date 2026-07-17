import type { ReactNode } from "react";

import type { StepId } from "../_domain/steps";
import type {
	AvailabilityAction,
	AvailabilityInteractionState,
	AvailabilityIssue,
} from "../_domain/availability-model";
import type {
	BaselineDraft,
	FieldErrors,
	GoalDraft,
	OnboardingSnapshotDraft,
	PriorHistoryDraft,
	RestrictionsDraft,
} from "../_domain/step-validation";
import { AvailabilityStep } from "./availability-step";
import { BaselineStep } from "./baseline-step";
import { GoalStep } from "./goal-step";
import { PriorHistoryStep } from "./prior-history-step";
import { RestrictionsStep } from "./restrictions-step";

type OnboardingStepContentProps = Readonly<{
	stepId: StepId;
	draft: OnboardingSnapshotDraft;
	errors: FieldErrors;
	onGoalChange: (patch: Partial<GoalDraft>) => void;
	onPriorHistoryChange: (patch: Partial<PriorHistoryDraft>) => void;
	onBaselineChange: (patch: Partial<BaselineDraft>) => void;
	availability: AvailabilityInteractionState;
	availabilityIssues: readonly AvailabilityIssue[];
	onAvailabilityAction: (action: AvailabilityAction) => void;
	onRestrictionsChange: (patch: Partial<RestrictionsDraft>) => void;
	children: ReactNode;
}>;

export function OnboardingStepContent({
	stepId,
	draft,
	errors,
	onGoalChange,
	onPriorHistoryChange,
	onBaselineChange,
	availability,
	availabilityIssues,
	onAvailabilityAction,
	onRestrictionsChange,
	children,
}: OnboardingStepContentProps) {
	let heading: ReactNode = null;
	let body: ReactNode;

	switch (stepId) {
		case "goal":
			heading = (
				<header className="onboarding-step-intro">
					<h1>Empecemos por tu objetivo</h1>
					<p>Cuéntame qué carrera tienes en mente. Es la brújula de todo tu plan.</p>
				</header>
			);
			body = <GoalStep value={draft.goal} errors={errors} onChange={onGoalChange} />;
			break;
		case "prior_history":
			heading = (
				<header className="onboarding-step-intro">
					<h1>¿Cuál es tu experiencia previa?</h1>
					<p>
						Necesito saber de dónde partes para no pedirte ni de más ni de menos.
					</p>
				</header>
			);
			body = (
				<PriorHistoryStep
					value={draft.profile.prior_history ?? {}}
					goalModality={draft.goal.modality}
					errors={errors}
					onChange={onPriorHistoryChange}
				/>
			);
			break;
		case "baseline":
			heading = (
				<header className="onboarding-step-intro">
					<h1>¿Cómo entrenas ahora mismo?</h1>
					<p>
						Todas las respuestas se refieren a las últimas cuatro semanas y nos
						ayudan a ajustar una progresión segura.
					</p>
				</header>
			);
			body = (
				<BaselineStep
					value={draft.profile.baseline_4_weeks ?? {}}
					errors={errors}
					onChange={onBaselineChange}
				/>
			);
			break;
		case "availability":
			heading = (
				<header className="onboarding-step-intro">
					<h1>¿Cuándo puedes entrenar?</h1>
					<p>Diseñaré el plan alrededor de tu vida, no al revés.</p>
				</header>
			);
			body = (
				<AvailabilityStep
					value={availability}
					issues={availabilityIssues}
					onAction={onAvailabilityAction}
				/>
			);
			break;
		case "restrictions":
			body = (
				<RestrictionsStep
					value={draft.profile.restrictions ?? {}}
					errors={errors}
					onChange={onRestrictionsChange}
				/>
			);
			break;
	}

	return (
		<>
			{heading}
			<div className="onboarding-wizard-card">
				{body}
				{children}
			</div>
		</>
	);
}
