"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "../../auth/_adapters/get-access-token";
import { isTestAuthAdapterEnabledInBrowser } from "../../../shared/testing/test-auth-adapter";
import type { OnboardingApiDependencies } from "../_adapters/onboarding-api";
import {
	hydrateAvailability,
	reduceAvailability,
	toAvailabilityDraft,
	validateAvailabilityInteraction,
	type AvailabilityAction,
	type AvailabilityInteractionState,
	type AvailabilityIssue,
} from "../_domain/availability-model";
import {
	applyConditionalClearing,
	createBlankWizardDraft,
	firstIncompleteStepIndex,
	normalizeWizardDraft,
	toDiagnosticsByField,
} from "../_domain/wizard-draft";
import {
	validateStep,
	type BaselineDraft,
	type FieldErrors,
	type GoalDraft,
	type OnboardingSnapshotDraft,
	type PhysicalStatusDraft,
	type PriorHistoryDraft,
	type TrainingPreferencesDraft,
} from "../_domain/step-validation";
import { ONBOARDING_STEPS } from "../_domain/steps";
import {
	type TrainingApproach,
	type TrainingApproachAssessment,
} from "../_domain/training-approach-choice";
import { completeOnboarding } from "../_use-cases/complete-onboarding";
import { loadOnboardingDraft } from "../_use-cases/load-onboarding-draft";
import { loadCurrentTrainingApproachEligibility } from "../_use-cases/load-training-approach-eligibility";
import { saveOnboardingStep } from "../_use-cases/save-onboarding-step";
import { saveTrainingPlanDraft } from "../_use-cases/save-training-plan-draft";
import { OnboardingStatusSurface } from "./onboarding-status-surface";
import { OnboardingStepContent } from "./onboarding-step-content";
import { StepNavigator } from "./step-navigator";
import { TrainingApproachChoice } from "./training-approach-choice";

type Phase = "loading" | "ready" | "load_error" | "eligibility_loading" | "eligibility_error" | "choice";
type SaveStatus = "idle" | "saving" | "save_error";
type WizardState = {
	draft: OnboardingSnapshotDraft;
	availability: AvailabilityInteractionState;
};

function todayIsoDate(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function createApiDependencies(): OnboardingApiDependencies {
	return {
		apiBaseUrl: (process.env.NEXT_PUBLIC_KAITO_API_URL ?? "").trim(),
		getAccessToken: isTestAuthAdapterEnabledInBrowser()
			? async () => "test-access-token"
			: getAccessToken,
		fetcher: (input, init) => fetch(input, init),
	};
}

function createWizardState(draft: OnboardingSnapshotDraft): WizardState {
	return {
		draft,
		availability: hydrateAvailability(draft.profile.availability?.minutes_by_day ?? {}),
	};
}

function projectAvailability(
	draft: OnboardingSnapshotDraft,
	availability: AvailabilityInteractionState,
): OnboardingSnapshotDraft {
	return {
		...draft,
		profile: {
			...draft.profile,
			availability: toAvailabilityDraft(availability),
		},
	};
}

export function OnboardingWizard() {
	const router = useRouter();
	const dependencies = useMemo(() => createApiDependencies(), []);
	const today = useMemo(() => todayIsoDate(), []);
	const saveInFlight = useRef(false);

	const [phase, setPhase] = useState<Phase>("loading");
	const [wizard, setWizard] = useState<WizardState>(() =>
		createWizardState(createBlankWizardDraft()),
	);
	const [stepIndex, setStepIndex] = useState(0);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [availabilityIssues, setAvailabilityIssues] = useState<
		readonly AvailabilityIssue[]
	>([]);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [assessment, setAssessment] = useState<TrainingApproachAssessment | null>(null);
	const [selectedApproach, setSelectedApproach] = useState<TrainingApproach | null>(null);
	const [draftError, setDraftError] = useState<string | null>(null);
	const [choicePending, setChoicePending] = useState(false);
	const [eligibilityAttempt, setEligibilityAttempt] = useState(0);
	const draft = wizard.draft;

	useEffect(() => {
		let cancelled = false;
		async function loadEligibility() {
			setPhase("eligibility_loading");
			const eligibility = await loadCurrentTrainingApproachEligibility(dependencies);
			if (cancelled) return;
			if (eligibility.status === "error") {
				setPhase("eligibility_error");
				return;
			}
			setAssessment(eligibility.assessment);
			setPhase("choice");
		}

		loadOnboardingDraft(today, dependencies).then((outcome) => {
			if (cancelled) return;
			if (outcome.status === "error") {
				setPhase("load_error");
				return;
			}
			if (outcome.status === "blank") {
				setPhase("ready");
				return;
			}

			const loadedDraft = normalizeWizardDraft({
				profile: outcome.result.snapshot.profile,
				goal: outcome.result.snapshot.goal,
			});
			const loadedDiagnostics = toDiagnosticsByField(outcome.result.diagnostics);
			setWizard(createWizardState(loadedDraft));

			if (outcome.result.snapshot.state === "completed") {
				void loadEligibility();
				return;
			}

			setStepIndex(firstIncompleteStepIndex(loadedDraft, loadedDiagnostics));
			setPhase("ready");
		});
		return () => {
			cancelled = true;
		};
	}, [today, dependencies, eligibilityAttempt]);

	async function enterChoiceFlow() {
		setPhase("eligibility_loading");
		const eligibility = await loadCurrentTrainingApproachEligibility(dependencies);
		if (eligibility.status === "error") {
			setPhase("eligibility_error");
			return;
		}
		setAssessment(eligibility.assessment);
		setPhase("choice");
	}

	async function handleApproachSubmit() {
		if (!selectedApproach || choicePending) return;
		setChoicePending(true);
		setDraftError(null);
		const outcome = await saveTrainingPlanDraft(selectedApproach, dependencies);
		if (outcome.status === "success") {
			router.push(`/plan/generating?plan_id=${encodeURIComponent(outcome.draft.plan_id)}`);
			return;
		}
		setChoicePending(false);
		setDraftError(
			outcome.reason === "conflict"
				? "Tu plan ya no se puede modificar. Actualiza la página para continuar con su estado actual."
				: "No hemos podido guardar tu elección. Revisa tu conexión e inténtalo de nuevo.",
		);
	}

	function updateDraft(update: (current: OnboardingSnapshotDraft) => OnboardingSnapshotDraft) {
		setWizard((current) => ({ ...current, draft: update(current.draft) }));
	}

	function updateGoal(patch: Partial<GoalDraft>) {
		updateDraft((current) => ({ ...current, goal: { ...current.goal, ...patch } }));
	}

	function updatePriorHistory(patch: Partial<PriorHistoryDraft>) {
		updateDraft((current) => ({
			...current,
			profile: {
				...current.profile,
				prior_history: { ...current.profile.prior_history, ...patch },
			},
		}));
	}

	function updateBaseline(patch: Partial<BaselineDraft>) {
		updateDraft((current) => ({
			...current,
			profile: {
				...current.profile,
				baseline_4_weeks: { ...current.profile.baseline_4_weeks, ...patch },
			},
		}));
	}

	function updateAvailability(action: AvailabilityAction) {
		setWizard((current) => {
			const availability = reduceAvailability(current.availability, action);
			return {
				availability,
				draft: projectAvailability(current.draft, availability),
			};
		});
		setAvailabilityIssues([]);
	}

	function updatePreferences(patch: Partial<TrainingPreferencesDraft>) {
		updateDraft((current) => ({
			...current,
			profile: {
				...current.profile,
				training_preferences: {
					...current.profile.training_preferences,
					...patch,
				},
			},
		}));
	}

	function updatePhysicalStatus(patch: Partial<PhysicalStatusDraft>) {
		updateDraft((current) => ({
			...current,
			profile: {
				...current.profile,
				physical_status: {
					...current.profile.physical_status,
					...patch,
				},
			},
		}));
	}

	function handleBack() {
		setStepIndex((current) => Math.max(0, current - 1));
		setFieldErrors({});
		setAvailabilityIssues([]);
		setSaveStatus("idle");
	}

	async function handleNext() {
		if (saveInFlight.current) return;
		const currentStep = ONBOARDING_STEPS[stepIndex];
		const issues =
			currentStep.id === "availability"
				? validateAvailabilityInteraction(wizard.availability)
				: [];
		if (issues.length > 0) {
			setAvailabilityIssues(issues);
			setFieldErrors({});
			return;
		}

		const validationDraft =
			currentStep.id === "availability"
				? projectAvailability(draft, wizard.availability)
				: draft;
		const errors = validateStep(currentStep.id, validationDraft);
		setFieldErrors(errors);
		if (Object.keys(errors).length > 0) return;

		const cleared = applyConditionalClearing(validationDraft);
		setWizard((current) => ({ ...current, draft: cleared }));

		const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;
		saveInFlight.current = true;
		setSaveStatus("saving");
		const outcome = isLastStep
			? await completeOnboarding(cleared, today, dependencies)
			: await saveOnboardingStep(cleared, today, dependencies);
		saveInFlight.current = false;

		if (outcome.status === "error") {
			setSaveStatus("save_error");
			return;
		}
		setSaveStatus("idle");

		if (outcome.status === "completed") {
			await enterChoiceFlow();
			return;
		}
		if (outcome.status === "demoted") {
			setStepIndex(
				firstIncompleteStepIndex(
					cleared,
					toDiagnosticsByField(outcome.result.diagnostics),
				),
			);
			setFieldErrors({});
			return;
		}

		setStepIndex(stepIndex + 1);
		setFieldErrors({});
		setAvailabilityIssues([]);
	}

	if (phase === "loading") {
		return (
			<OnboardingStatusSurface
				variant="loading"
				title="Preparando tu plan"
				description="Estamos recuperando tus respuestas para que puedas continuar donde lo dejaste."
			/>
		);
	}

	if (phase === "load_error") {
		return (
			<OnboardingStatusSurface
				variant="error"
				title="No hemos podido cargar tus respuestas"
				description="Puede ser un problema de conexión. Tus datos siguen a salvo y puedes intentarlo de nuevo sin salir de esta página."
				action={{ label: "Reintentar", href: "/onboarding" }}
			/>
		);
	}

	if (phase === "eligibility_loading") {
		return (
			<OnboardingStatusSurface
				variant="loading"
				title="Comprobando tus opciones"
				description="Estamos revisando qué enfoques están disponibles con tu situación actual."
			/>
		);
	}

	if (phase === "eligibility_error") {
		return (
			<section className="onboarding-status-surface onboarding-status-surface-error" role="alert">
				<div className="onboarding-status-copy">
					<h1>No hemos podido comprobar tus opciones</h1>
					<p>Tus respuestas siguen guardadas. Puedes volver a intentarlo aquí.</p>
				</div>
				<button className="onboarding-status-action" type="button" onClick={() => setEligibilityAttempt((value) => value + 1)}>
					Reintentar
				</button>
			</section>
		);
	}

	if (phase === "choice" && assessment) {
		return (
			<TrainingApproachChoice
				assessment={assessment}
				selected={selectedApproach}
				pending={choicePending}
				error={draftError}
				onSelect={(approach) => {
					setSelectedApproach(approach);
					setDraftError(null);
				}}
				onSubmit={handleApproachSubmit}
			/>
		);
	}

	const currentStep = ONBOARDING_STEPS[stepIndex];
	const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;
	let nextButtonLabel = "Continuar";
	if (saveStatus === "saving") nextButtonLabel = "Guardando…";
	else if (isLastStep) nextButtonLabel = "Continuar";

	return (
		<div className="onboarding-wizard">
			<StepNavigator currentStepIndex={stepIndex} />
			<OnboardingStepContent
				stepId={currentStep.id}
				draft={draft}
				errors={fieldErrors}
				onGoalChange={updateGoal}
				onPriorHistoryChange={updatePriorHistory}
				onBaselineChange={updateBaseline}
				availability={wizard.availability}
				availabilityIssues={availabilityIssues}
				onAvailabilityAction={updateAvailability}
				onPreferencesChange={updatePreferences}
				onPhysicalStatusChange={updatePhysicalStatus}
			>
				{saveStatus === "save_error" ? (
					<p className="onboarding-form-error" role="alert">
						No hemos podido guardar este paso. Revisa tu conexión e inténtalo de nuevo; tus respuestas no se han perdido.
					</p>
				) : null}

				<div className="onboarding-step-actions">
					{stepIndex > 0 ? (
						<button
							className="onboarding-back-action"
							type="button"
							disabled={saveStatus === "saving"}
							onClick={handleBack}
						>
							<span aria-hidden="true">←</span> Atrás
						</button>
					) : null}
					<button
						className="onboarding-next-action"
						type="button"
						disabled={saveStatus === "saving"}
						onClick={handleNext}
					>
						{nextButtonLabel} <span aria-hidden="true">→</span>
					</button>
				</div>
			</OnboardingStepContent>
		</div>
	);
}
