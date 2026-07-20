"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "../../auth/_adapters/get-access-token";
import { getBrowserSupabaseClient } from "../../auth/_infrastructure/supabase/browser";
import { createSessionRecoveryController } from "../../auth/_use-cases/session-recovery-controller";
import { PrivateApiError } from "../../../shared/adapters/private-fetch";
import { isTestAuthAdapterEnabledInBrowser } from "../../../shared/testing/test-auth-adapter";
import {
	activeBlockMetrics,
	currentPlanWeek,
	fetchActiveTrainingPlan,
	nextPlanSession,
	planCalendarDate,
	type ActiveTrainingPlan,
	type ActiveTrainingSession,
} from "../_adapters/active-plan-api";

type DashboardState =
	| { kind: "loading" }
	| { kind: "empty" }
	| { kind: "error" }
	| { kind: "plan"; plan: ActiveTrainingPlan };

type NonPlanState = Exclude<DashboardState["kind"], "plan">;

const approachNames = {
	kaio_path: "Kaio Path",
	mode_z: "Mode Z",
	kaioken: "Kaioken",
};

export function ActivePlanDashboard() {
	const router = useRouter();
	const [state, setState] = useState<DashboardState>({ kind: "loading" });

	const load = useCallback(async () => {
		setState({ kind: "loading" });
		try {
			const result = await fetchActiveTrainingPlan({
				apiBaseUrl: (
					process.env.NEXT_PUBLIC_KAITO_API_URL ?? ""
				).trim(),
				getAccessToken: isTestAuthAdapterEnabledInBrowser()
					? async () => "test-access-token"
					: getAccessToken,
				fetcher: (input, init) => fetch(input, init),
			});
			setState(
				result === "empty"
					? { kind: "empty" }
					: { kind: "plan", plan: result },
			);
		} catch (error) {
			if (isRecoverableSessionError(error)) {
				setState({ kind: "loading" });
				await createSessionRecoveryController({
					currentPath: "/plan",
					signOut,
					replace: router.replace,
				}).recover(error.kind);
				return;
			}
			setState({ kind: "error" });
		}
	}, [router]);

	useEffect(() => {
		const pending = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(pending);
	}, [load]);

	if (state.kind !== "plan") {
		return <DashboardStatus state={state.kind} retry={load} />;
	}
	return <Plan plan={state.plan} />;
}

function isRecoverableSessionError(
	error: unknown,
): error is PrivateApiError & { kind: "auth_required" | "auth_rejected" } {
	return (
		error instanceof PrivateApiError &&
		(error.kind === "auth_required" || error.kind === "auth_rejected")
	);
}

async function signOut() {
	if (isTestAuthAdapterEnabledInBrowser()) {
		document.cookie =
			"kaito-e2e-session=; Path=/; Max-Age=0; SameSite=Lax";
		return;
	}
	await getBrowserSupabaseClient()?.auth.signOut();
}

function DashboardStatus({
	state,
	retry,
}: {
	state: NonPlanState;
	retry: () => void;
}) {
	const copy =
		state === "empty"
			? [
					"Todavía no tienes un plan activo",
					"Cuando generes tu primer bloque, encontrarás aquí cada semana y sesión.",
				]
			: state === "error"
				? [
						"No hemos podido cargar tu plan",
						"Tu información sigue segura. Prueba de nuevo en unos instantes.",
					]
				: [
						"Cargando tu bloque activo",
						"Estamos consultando tus próximas sesiones.",
					];

	return (
		<main className="plan-dashboard-state">
			<section
				className="plan-state-card"
				role={state === "error" ? "alert" : "status"}
			>
				<span className="plan-logo" aria-hidden="true">
					▲
				</span>
				<h1>{copy[0]}</h1>
				<p>{copy[1]}</p>
				{state === "error" && (
					<button type="button" onClick={retry}>
						Reintentar
					</button>
				)}
			</section>
		</main>
	);
}

function Plan({ plan }: { plan: ActiveTrainingPlan }) {
	const sessions = plan.weeks.flatMap((week) => week.sessions);
	const today = planCalendarDate();
	const nextSession = nextPlanSession(today, sessions);
	const metrics = activeBlockMetrics(
		today,
		plan.start_date,
		plan.end_date,
		sessions,
	);

	return (
		<main className="plan-dashboard">
			<DashboardSidebar approach={approachNames[plan.plan_approach]} />
			<div className="plan-content">
				<header className="plan-header">
					<p>Plan activo</p>
					<h1>Tu plan de entrenamiento personalizado</h1>
					<span>
						{formatDate(plan.start_date)} – {formatDate(plan.end_date)}
					</span>
				</header>

				<section className="plan-metrics" aria-label="Resumen del bloque">
					<Metric
						label="Kilómetros planificados esta semana"
						value={`${formatNumber(metrics.plannedKilometers)} km`}
					/>
					<Metric
						label="Sesiones planificadas esta semana"
						value={String(metrics.plannedSessionCount)}
					/>
					<Metric
						label="Días restantes del bloque activo"
						value={String(metrics.remainingDays)}
					/>
					<Metric
						label="Progreso temporal del bloque"
						value={`${metrics.temporalProgress} %`}
					/>
				</section>

				{nextSession ? (
					<NextSession session={nextSession} />
				) : (
					<FinishedBlock />
				)}

				<WeeklyCalendar today={today} sessions={sessions} />
			</div>
		</main>
	);
}

function DashboardSidebar({ approach }: { approach: string }) {
	return (
		<aside className="plan-sidebar">
			<strong>
				<span aria-hidden="true">▲</span> Kaito
			</strong>
			<nav aria-label="Plan de entrenamiento">
				<Link href="/plan" aria-current="page">
					<DashboardIcon />
					<span>Dashboard</span>
				</Link>
				<a href="#calendario">Calendario</a>
			</nav>
			<small>
				Bloque activo
				<br />
				{approach}
			</small>
		</aside>
	);
}

function DashboardIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<rect x="3" y="3" width="7" height="7" rx="1" />
			<rect x="14" y="3" width="7" height="7" rx="1" />
			<rect x="3" y="14" width="7" height="7" rx="1" />
			<rect x="14" y="14" width="7" height="7" rx="1" />
		</svg>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<article>
			<span>{label}</span>
			<strong>{value}</strong>
		</article>
	);
}

function NextSession({ session }: { session: ActiveTrainingSession }) {
	return (
		<section className="plan-next" aria-labelledby="next-title">
			<p className="plan-kicker">
				PRÓXIMA SESIÓN · {formatDate(session.scheduled_date)}
			</p>
			<h2 id="next-title">{session.session_type}</h2>
			<p>{session.purpose}</p>
			<dl>
				<Stat
					label="Duración"
					value={`${session.planned_duration_minutes} min`}
				/>
				<Stat
					label="Distancia"
					value={`${formatNumber(Number(session.planned_distance_kilometers))} km`}
				/>
				<Stat
					label="Desnivel"
					value={`${formatNumber(session.planned_elevation_meters)} m`}
				/>
				<Stat
					label="Intensidad"
					value={`${session.intensity_description} · RPE ${session.target_rpe_min}–${session.target_rpe_max}`}
				/>
			</dl>
			<h3>Indicaciones</h3>
			<p>{session.instructions}</p>
		</section>
	);
}

function FinishedBlock() {
	return (
		<section className="plan-next">
			<p className="plan-kicker">BLOQUE FINALIZADO</p>
			<h2>No quedan sesiones programadas</h2>
			<p>Puedes consultar el detalle de tu bloque debajo.</p>
		</section>
	);
}

function WeeklyCalendar({
	today,
	sessions,
}: {
	today: string;
	sessions: ActiveTrainingSession[];
}) {
	const days = currentPlanWeek(today, sessions);
	return (
		<section
			id="calendario"
			className="plan-schedule"
			aria-labelledby="schedule-title"
		>
			<p className="plan-kicker">CALENDARIO</p>
			<h2 id="schedule-title">Esta semana</h2>
			<div className="plan-week-grid">
				{days.map((day) => (
					<article
						key={day.date}
						className="plan-day-card"
						data-today={day.date === today ? "true" : undefined}
						aria-label={`${dayName(day.date)} ${formatDate(day.date)}${day.date === today ? ", hoy" : ""}`}
					>
						<header>
							<span>{dayName(day.date)}</span>
							<strong>{Number(day.date.slice(-2))}</strong>
							{day.date === today && <small>Hoy</small>}
						</header>
						{day.sessions.length ? (
							<ul>
								{day.sessions.map((session, index) => (
									<CalendarSession key={`${session.session_type}-${index}`} session={session} />
								))}
							</ul>
						) : (
							<p>Sin sesión planificada</p>
						)}
					</article>
				))}
			</div>
		</section>
	);
}

function CalendarSession({ session }: { session: ActiveTrainingSession }) {
	const distance = Number(session.planned_distance_kilometers);
	return (
		<li>
			<strong>{session.session_type}</strong>
			<small>
				{session.planned_duration_minutes} min · {formatNumber(distance)} km
			</small>
		</li>
	);
}

function dayName(date: string) {
	return new Intl.DateTimeFormat("es-ES", {
		weekday: "long",
		timeZone: "UTC",
	}).format(new Date(`${date}T00:00:00Z`));
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt>{label}</dt>
			<dd>{value}</dd>
		</div>
	);
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("es-ES", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${value}T00:00:00Z`));
}

function formatNumber(value: number) {
	return new Intl.NumberFormat("es-ES", {
		maximumFractionDigits: 2,
	}).format(value);
}
