"use client";

import { useEffect, useMemo, useState } from "react";

import { getAccessToken } from "../../auth/_adapters/get-access-token";
import { isTestAuthAdapterEnabledInBrowser } from "../../../shared/testing/test-auth-adapter";
import type {
	OnboardingApiDependencies,
	OnboardingDiagnostic,
} from "../_adapters/onboarding-api";
import {
	clearHiddenGoalFields,
	clearRestrictionDetail,
} from "../_domain/conditional-clearing";
import {
	validateStep,
	type AvailabilityDraft,
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
import { AvailabilityStep } from "./availability-step";
import { BaselineStep } from "./baseline-step";
import { CompletionView } from "./completion-view";
import { GoalStep } from "./goal-step";
import { PriorHistoryStep } from "./prior-history-step";
import { RestrictionsStep } from "./restrictions-step";
import { StepNavigator, type StepStatus } from "./step-navigator";

type Phase = "loading" | "ready" | "load_error" | "completed";
type SaveStatus = "idle" | "saving" | "save_error";
type DiagnosticsByField = Partial<Record<string, OnboardingDiagnostic>>;

function normalizeDraft(draft: OnboardingSnapshotDraft): OnboardingSnapshotDraft {
	return {
		...draft,
		profile: {
			...draft.profile,
			prior_history: {
				...draft.profile.prior_history,
				practiced_modalities:
					draft.profile.prior_history?.practiced_modalities ?? [],
				practiced_terrain:
					draft.profile.prior_history?.practiced_terrain ?? [],
			},
		},
	};
}

function blankDraft(): OnboardingSnapshotDraft {
	return normalizeDraft({ profile: {}, goal: {} });
}

function todayIsoDate(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function toDiagnosticsByField(
	diagnostics: readonly OnboardingDiagnostic[],
): DiagnosticsByField {
	const byField: DiagnosticsByField = {};
	for (const diagnostic of diagnostics) {
		byField[diagnostic.field] = diagnostic;
	}
	return byField;
}

function applyConditionalClearing(
	draft: OnboardingSnapshotDraft,
): OnboardingSnapshotDraft {
	return {
		profile: {
			...draft.profile,
			restrictions: draft.profile.restrictions
				? clearRestrictionDetail(draft.profile.restrictions)
				: draft.profile.restrictions,
		},
		goal: clearHiddenGoalFields(draft.goal),
	};
}

function firstIncompleteStepIndex(
	draft: OnboardingSnapshotDraft,
	diagnostics: DiagnosticsByField,
): number {
	const index = ONBOARDING_STEPS.findIndex(
		(step) =>
			Object.keys(validateStep(step.id, draft)).length > 0 ||
			step.fields.some((field) => diagnostics[field] !== undefined),
	);
	return index === -1 ? ONBOARDING_STEPS.length - 1 : index;
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

export function OnboardingExperience() {
	const [hasStarted, setHasStarted] = useState(false);

	if (hasStarted) {
		return (
			<section className="onboarding-flow" aria-labelledby="onboarding-flow-title">
				<h1 id="onboarding-flow-title">Cuéntanos tu punto de partida</h1>
				<OnboardingWizard />
			</section>
		);
	}

	return (
		<section className="onboarding-intro" aria-labelledby="onboarding-intro-title">
			<div className="onboarding-intro-content">
				<header className="onboarding-intro-header">
					<h1 id="onboarding-intro-title">
						Tu plan de entrenamiento,
						<br /> hecho a tu medida
					</h1>
					<p>
						Kaito diseña, explica y adapta tu entrenamiento según tu objetivo, tu
						fondo y el tiempo real que tienes para entrenar.
					</p>
				</header>

				<div className="onboarding-intro-benefits">
					<article className="onboarding-intro-card">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="12" cy="12" r="8.5" />
							<circle cx="12" cy="12" r="4.5" />
							<circle cx="12" cy="12" r="1" />
						</svg>
						<h2>Plan personalizado</h2>
						<p>Construido desde tu objetivo real y tu disponibilidad.</p>
					</article>

					<article className="onboarding-intro-card">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="m3 16 5-5 3 3 7-8" />
							<path d="m16 6h2v2" />
						</svg>
						<h2>Explicaciones claras</h2>
						<p>Sabes por qué haces cada sesión, no solo qué hacer.</p>
					</article>
				</div>

				<button
					className="onboarding-intro-cta"
					type="button"
					onClick={() => setHasStarted(true)}
				>
					Crear mi plan <span aria-hidden="true">→</span>
				</button>
			</div>
		</section>
	);
}

export function OnboardingWizard() {
	const dependencies = useMemo(() => createApiDependencies(), []);
	const today = useMemo(() => todayIsoDate(), []);

	const [phase, setPhase] = useState<Phase>("loading");
	const [draft, setDraft] = useState<OnboardingSnapshotDraft>(blankDraft);
	const [stepIndex, setStepIndex] = useState(0);
	const [furthestReachedIndex, setFurthestReachedIndex] = useState(0);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [diagnostics, setDiagnostics] = useState<DiagnosticsByField>({});
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

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

			const loadedDraft = normalizeDraft({
				profile: outcome.result.snapshot.profile,
				goal: outcome.result.snapshot.goal,
			});
			const loadedDiagnostics = toDiagnosticsByField(
				outcome.result.diagnostics,
			);
			setDraft(loadedDraft);
			setDiagnostics(loadedDiagnostics);

			if (outcome.result.snapshot.state === "completed") {
				setPhase("completed");
				return;
			}

			const resumeIndex = firstIncompleteStepIndex(
				loadedDraft,
				loadedDiagnostics,
			);
			setStepIndex(resumeIndex);
			setFurthestReachedIndex(resumeIndex);
			setPhase("ready");
		});
		return () => {
			cancelled = true;
		};
	}, [today, dependencies]);

	function updateGoal(patch: Partial<GoalDraft>) {
		setDraft((current) => ({ ...current, goal: { ...current.goal, ...patch } }));
	}

	function updatePriorHistory(patch: Partial<PriorHistoryDraft>) {
		setDraft((current) => ({
			...current,
			profile: {
				...current.profile,
				prior_history: { ...current.profile.prior_history, ...patch },
			},
		}));
	}

	function updateBaseline(patch: Partial<BaselineDraft>) {
		setDraft((current) => ({
			...current,
			profile: {
				...current.profile,
				baseline_4_weeks: { ...current.profile.baseline_4_weeks, ...patch },
			},
		}));
	}

	function updateAvailability(patch: Partial<AvailabilityDraft>) {
		setDraft((current) => ({
			...current,
			profile: {
				...current.profile,
				availability: { ...current.profile.availability, ...patch },
			},
		}));
	}

	function updateRestrictions(patch: Partial<RestrictionsDraft>) {
		setDraft((current) => ({
			...current,
			profile: {
				...current.profile,
				restrictions: { ...current.profile.restrictions, ...patch },
			},
		}));
	}

	async function handleNext() {
		const currentStep = ONBOARDING_STEPS[stepIndex];
		const errors = validateStep(currentStep.id, draft);
		setFieldErrors(errors);
		if (Object.keys(errors).length > 0) {
			return;
		}

		const cleared = applyConditionalClearing(draft);
		setDraft(cleared);

		const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;
		setSaveStatus("saving");
		const outcome = isLastStep
			? await completeOnboarding(cleared, today, dependencies)
			: await saveOnboardingStep(cleared, today, dependencies);

		if (outcome.status === "error") {
			setSaveStatus("save_error");
			return;
		}
		setSaveStatus("idle");
		setDiagnostics(toDiagnosticsByField(outcome.result.diagnostics));

		if (outcome.status === "completed") {
			setPhase("completed");
			return;
		}
		if (outcome.status === "demoted") {
			return;
		}

		const nextIndex = stepIndex + 1;
		setStepIndex(nextIndex);
		setFurthestReachedIndex((current) => Math.max(current, nextIndex));
		setFieldErrors({});
	}

	function handleJump(index: number) {
		if (index > furthestReachedIndex) return;
		setStepIndex(index);
		setFieldErrors({});
	}

	if (phase === "loading") {
		return (
			<p aria-live="polite" role="status">
				Cargando tu onboarding…
			</p>
		);
	}

	if (phase === "load_error") {
		return (
			<p className="onboarding-form-error" role="alert">
				No hemos podido cargar tu onboarding ahora mismo. Inténtalo de nuevo
				en unos minutos.
			</p>
		);
	}

	if (phase === "completed") {
		return <CompletionView />;
	}

	const statuses: StepStatus[] = ONBOARDING_STEPS.map((step, index) => {
		if (index > furthestReachedIndex) return "not_reached";
		const hasLocalErrors =
			Object.keys(validateStep(step.id, draft)).length > 0;
		const hasDiagnostic = step.fields.some(
			(field) => diagnostics[field] !== undefined,
		);
		return hasLocalErrors || hasDiagnostic ? "incomplete" : "complete";
	});

	const currentStep = ONBOARDING_STEPS[stepIndex];
	const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;
	let nextButtonLabel = "Siguiente";
	if (saveStatus === "saving") {
		nextButtonLabel = "Guardando…";
	} else if (isLastStep) {
		nextButtonLabel = "Completar";
	}

	return (
		<div className="onboarding-wizard">
			<StepNavigator
				currentStepIndex={stepIndex}
				statuses={statuses}
				onJump={handleJump}
			/>

			{currentStep.id === "goal" ? (
				<GoalStep value={draft.goal} errors={fieldErrors} onChange={updateGoal} />
			) : null}
			{currentStep.id === "prior_history" ? (
				<PriorHistoryStep
					value={draft.profile.prior_history ?? {}}
					errors={fieldErrors}
					onChange={updatePriorHistory}
				/>
			) : null}
			{currentStep.id === "baseline" ? (
				<BaselineStep
					value={draft.profile.baseline_4_weeks ?? {}}
					errors={fieldErrors}
					onChange={updateBaseline}
				/>
			) : null}
			{currentStep.id === "availability" ? (
				<AvailabilityStep
					value={draft.profile.availability ?? {}}
					errors={fieldErrors}
					onChange={updateAvailability}
				/>
			) : null}
			{currentStep.id === "restrictions" ? (
				<RestrictionsStep
					value={draft.profile.restrictions ?? {}}
					errors={fieldErrors}
					onChange={updateRestrictions}
				/>
			) : null}

			{saveStatus === "save_error" ? (
				<p className="onboarding-form-error" role="alert">
					No hemos podido guardar este paso. Revisa tu conexión e inténtalo de
					nuevo; tus respuestas no se han perdido.
				</p>
			) : null}

			<button
				type="button"
				disabled={saveStatus === "saving"}
				onClick={handleNext}
			>
				{nextButtonLabel}
			</button>
		</div>
	);
}
