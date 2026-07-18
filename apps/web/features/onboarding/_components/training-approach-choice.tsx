import { useState } from "react";

import {
	buildApproachChoices,
	previewBlockingReasons,
	SAFETY_RESTRICTION_COPY,
	type ApproachChoice,
	type TrainingApproach,
	type TrainingApproachAssessment,
} from "../_domain/training-approach-choice";
import { StepNavigator } from "./step-navigator";

type Props = Readonly<{
	assessment: TrainingApproachAssessment;
	selected: TrainingApproach | null;
	pending: boolean;
	error: string | null;
	onSelect(approach: TrainingApproach): void;
	onSubmit(): void;
}>;

export function TrainingApproachChoice({ assessment, selected, pending, error, onSelect, onSubmit }: Props) {
	const choices = buildApproachChoices(assessment);
	const [blockedDetail, setBlockedDetail] = useState<TrainingApproach | null>(null);
	const [reasonsExpanded, setReasonsExpanded] = useState(false);
	const restrictions = assessment.safety_restriction_codes.map(
		(code) => SAFETY_RESTRICTION_COPY[code] ?? "Aplicaremos una restricción de seguridad a tu plan.",
	);
	const blockedChoice = choices.find((choice) => choice.approach === blockedDetail);
	const selectedChoice = choices.find((choice) => choice.approach === selected);

	function choose(approach: TrainingApproach) {
		setBlockedDetail(null);
		setReasonsExpanded(false);
		onSelect(approach);
	}

	function explain(approach: TrainingApproach) {
		setBlockedDetail(approach);
		setReasonsExpanded(false);
	}

	return (
		<div className="onboarding-wizard onboarding-approach-step">
			<StepNavigator currentStepIndex={6} />
			<header className="onboarding-step-intro onboarding-approach-intro">
				<h1>Elige tu enfoque de entrenamiento</h1>
				<p>Selecciona el camino que quieres seguir. Solo puedes elegir las opciones que ya tienes disponibles.</p>
			</header>
			<section className="onboarding-approach-landscape" aria-label="Caminos de entrenamiento">
				<div className="onboarding-mountain onboarding-mountain-one" aria-hidden="true" />
				<div className="onboarding-mountain onboarding-mountain-two" aria-hidden="true" />
				<div className="onboarding-path-line" aria-hidden="true" />
				<fieldset className="onboarding-approach-group" role="radiogroup" aria-labelledby="training-approach-legend" aria-describedby={restrictions.length > 0 ? "onboarding-safety-restrictions" : undefined}>
					<legend id="training-approach-legend" className="onboarding-visually-hidden">Enfoque de entrenamiento</legend>
					{choices.map((choice, index) => (
						<div className="onboarding-approach-card" data-level={index} data-selected={selected === choice.approach || undefined} data-disabled={!choice.available || undefined} key={choice.approach}>
							<label className="onboarding-approach-label">
								<input type="radio" name="training-approach" value={choice.approach} checked={selected === choice.approach} disabled={!choice.available || pending} onChange={() => choose(choice.approach)} />
								<span className="onboarding-approach-icon" aria-hidden="true"><ApproachIcon approach={choice.approach} /></span>
								{selected === choice.approach ? <span className="onboarding-choice-check" aria-label="Seleccionado"><StatusIcon kind="check" /></span> : choice.available ? <span className="onboarding-choice-neutral" aria-hidden="true" /> : <span className="onboarding-card-lock" aria-label="Bloqueado"><StatusIcon kind="lock" /></span>}
								<span className="onboarding-approach-name">{choice.name}</span>
							</label>
							<span className="onboarding-level-markers" aria-hidden="true"><i /><i /><i /></span>
							{!choice.available ? (
								<button type="button" className="onboarding-why-action" aria-label={`¿Por qué no está disponible ${choice.name}?`} aria-expanded={blockedDetail === choice.approach} aria-controls="onboarding-blocked-detail" onClick={() => explain(choice.approach)}>
									<span aria-hidden="true">ⓘ</span> ¿Por qué?
								</button>
							) : null}
						</div>
					))}
				</fieldset>
				{blockedChoice ? (
					<BlockedPanel choice={blockedChoice} expanded={reasonsExpanded} onToggle={() => setReasonsExpanded((value) => !value)} onClose={() => { setBlockedDetail(null); setReasonsExpanded(false); }} />
				) : selectedChoice ? <SelectedPanel choice={selectedChoice} /> : null}
				<p className="onboarding-approach-guidance"><span aria-hidden="true">♙</span> Los enfoques superiores pueden desbloquearse a medida que ganas constancia y volumen.</p>
			</section>
			{restrictions.length > 0 ? (
				<aside id="onboarding-safety-restrictions" className="onboarding-safety-restrictions" aria-label="Restricciones de seguridad">
					<strong>Medidas de seguridad para tu plan</strong>
					<ul>{restrictions.map((restriction, index) => <li key={`${index}-${restriction}`}>{restriction}</li>)}</ul>
				</aside>
			) : null}
			{error ? <p className="onboarding-form-error" role="alert">{error}</p> : null}
			<div className="onboarding-step-actions onboarding-approach-actions">
				<button className="onboarding-next-action" type="button" disabled={!selected || pending} onClick={onSubmit}>
					{pending ? "Guardando…" : "Generar mi plan"} <span aria-hidden="true">→</span>
				</button>
			</div>
		</div>
	);
}

function BlockedPanel({ choice, expanded, onToggle, onClose }: Readonly<{ choice: ApproachChoice; expanded: boolean; onToggle(): void; onClose(): void }>) {
	const preview = previewBlockingReasons(choice.blockingReasons, expanded);
	return (
		<section id="onboarding-blocked-detail" className="onboarding-approach-panel onboarding-blocked-panel" aria-live="polite" aria-labelledby="blocked-panel-title">
			<span className="onboarding-panel-icon" aria-hidden="true"><StatusIcon kind="lock" /></span>
			<div><h2 id="blocked-panel-title">{choice.name} · aún no disponible</h2>
				<div className="onboarding-reason-chips">{preview.visible.map((reason, index) => <span key={`${index}-${reason}`}>{reason}</span>)}</div>
				{preview.hiddenCount > 0 ? <button type="button" className="onboarding-reasons-toggle" aria-expanded="false" onClick={onToggle}>+{preview.hiddenCount} más</button> : choice.blockingReasons.length > 3 ? <button type="button" className="onboarding-reasons-toggle" aria-expanded="true" onClick={onToggle}>Mostrar menos</button> : null}
				<p>No es un castigo: es una etapa para seguir construyendo tu preparación con seguridad.</p>
			</div>
			<button type="button" className="onboarding-panel-close" aria-label={`Cerrar detalle de ${choice.name}`} onClick={onClose}>×</button>
		</section>
	);
}

function SelectedPanel({ choice }: Readonly<{ choice: ApproachChoice }>) {
	return (
		<section id="onboarding-selected-summary" className="onboarding-approach-panel onboarding-selected-panel" aria-live="polite" aria-label={`Has elegido ${choice.name}`}>
			<span className="onboarding-panel-icon onboarding-selected-icon" aria-hidden="true"><ApproachIcon approach={choice.approach} /></span>
			<div><strong>Has elegido · {choice.name}</strong><p>{choice.description}</p></div>
			<span className="onboarding-available-status"><span aria-hidden="true">✓</span> Disponible para ti</span>
		</section>
	);
}

function StatusIcon({ kind }: Readonly<{ kind: "check" | "lock" }>) {
	return kind === "check"
		? <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9" /></svg>
		: <svg viewBox="0 0 24 24"><rect x="6" y="10" width="12" height="9" rx="2" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></svg>;
}

function ApproachIcon({ approach }: Readonly<{ approach: TrainingApproach }>) {
	if (approach === "kaio_path") return <svg viewBox="0 0 24 24"><path d="M5 19c8 0 13-5 14-14C10 6 5 11 5 19Zm0 0c3-5 6-7 11-10" /></svg>;
	if (approach === "mode_z") return <svg viewBox="0 0 24 24"><path d="m3 18 5-7 4 4 3-5 6 8H3Zm12-11 1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" /></svg>;
	return <svg viewBox="0 0 24 24"><path d="M13 3c1 4-3 5-1 8 1 2 3 1 3-1 3 3 3 8-1 10-4 2-9-1-9-6 0-4 3-6 5-8 0 3 1 4 3 5" /></svg>;
}
