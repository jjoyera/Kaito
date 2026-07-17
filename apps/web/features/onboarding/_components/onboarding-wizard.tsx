"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
	type PriorHistoryDraft,
	type RestrictionsDraft,
} from "../_domain/step-validation";
import { ONBOARDING_STEPS } from "../_domain/steps";
import { completeOnboarding } from "../_use-cases/complete-onboarding";
import { loadOnboardingDraft } from "../_use-cases/load-onboarding-draft";
import { saveOnboardingStep } from "../_use-cases/save-onboarding-step";
import { CompletionView } from "./completion-view";
import { OnboardingStepContent } from "./onboarding-step-content";
import { StepNavigator } from "./step-navigator";

type Phase = "loading" | "ready" | "load_error" | "completed";
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
	const draft = wizard.draft;

	useEffect(() => {
		let cancelled = false;
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
			const loadedDiagnostics = toDiagnosticsByField(
				outcome.result.diagnostics,
			);
			setWizard(createWizardState(loadedDraft));

			if (outcome.result.snapshot.state === "completed") {
				setPhase("completed");
				return;
			}

			setStepIndex(firstIncompleteStepIndex(loadedDraft, loadedDiagnostics));
			setPhase("ready");
		});
		return () => {
			cancelled = true;
		};
	}, [today, dependencies]);

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

	function updateRestrictions(patch: Partial<RestrictionsDraft>) {
		updateDraft((current) => ({
			...current,
			profile: {
				...current.profile,
				restrictions: { ...current.profile.restrictions, ...patch },
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
			setPhase("completed");
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
		return <p aria-live="polite" role="status">Cargando tu onboarding…</p>;
	}

	if (phase === "load_error") {
		return (
			<p className="onboarding-form-error" role="alert">
				No hemos podido cargar tu onboarding ahora mismo. Inténtalo de nuevo en unos minutos.
			</p>
		);
	}

	if (phase === "completed") return <CompletionView />;

	const currentStep = ONBOARDING_STEPS[stepIndex];
	const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;
	let nextButtonLabel = "Continuar";
	if (saveStatus === "saving") nextButtonLabel = "Guardando…";
	else if (isLastStep) nextButtonLabel = "Completar";

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
				onRestrictionsChange={updateRestrictions}
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
