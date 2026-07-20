"use client";

import {
	type CSSProperties,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "../../auth/_adapters/get-access-token";
import { getBrowserSupabaseClient } from "../../auth/_infrastructure/supabase/browser";
import { createSessionRecoveryController } from "../../auth/_use-cases/session-recovery-controller";
import { PrivateApiError } from "../../../shared/adapters/private-fetch";
import { isTestAuthAdapterEnabledInBrowser } from "../../../shared/testing/test-auth-adapter";
import {
	generateTrainingPlan,
	PlanGenerationError,
	type PlanGenerationErrorKind,
} from "../_adapters/generate-plan-api";

type GenerationState =
	| { kind: "loading" }
	| { kind: "error"; error: PlanGenerationErrorKind | "service_error" };

const progressSteps = [
	"Analizando tu objetivo de carrera",
	"Revisando tu disponibilidad semanal",
	"Ajustando cargas y progresión",
	"Construyendo tu plan personalizado",
];

const errorCopy: Record<
	Exclude<GenerationState, { kind: "loading" }>["error"],
	readonly [string, string]
> = {
	missing_context: [
		"No hemos encontrado los datos necesarios",
		"Vuelve al onboarding para comprobar tu objetivo y tu disponibilidad.",
	],
	cannot_generate: [
		"Tu plan no se puede generar todavía",
		"Revisa los datos de tu onboarding antes de intentarlo de nuevo.",
	],
	invalid_generated_plan: [
		"No hemos podido validar tu plan",
		"No se ha guardado ningún resultado incompleto. Puedes intentarlo de nuevo.",
	],
	provider_unavailable: [
		"El servicio de generación no está disponible",
		"Tu información sigue segura. Inténtalo de nuevo dentro de unos instantes.",
	],
	service_error: [
		"No hemos podido generar tu plan",
		"Tu información sigue segura. Inténtalo de nuevo dentro de unos instantes.",
	],
};

export function PlanGeneration() {
	const router = useRouter();
	const [state, setState] = useState<GenerationState>({ kind: "loading" });
	const automaticRequestStarted = useRef(false);
	const requestInFlight = useRef(false);

	const generate = useCallback(async () => {
		if (requestInFlight.current) return;
		requestInFlight.current = true;
		setState({ kind: "loading" });

		try {
			await generateTrainingPlan({
				apiBaseUrl: (process.env.NEXT_PUBLIC_KAITO_API_URL ?? "").trim(),
				getAccessToken: isTestAuthAdapterEnabledInBrowser()
					? async () => "test-access-token"
					: getAccessToken,
				fetcher: (input, init) => fetch(input, init),
			});
			router.replace("/plan");
		} catch (error) {
			if (isRecoverableSessionError(error)) {
				await createSessionRecoveryController({
					currentPath: "/plan/generating",
					signOut,
					replace: router.replace,
				}).recover(error.kind);
				return;
			}
			setState({
				kind: "error",
				error:
					error instanceof PlanGenerationError
						? error.kind
						: "service_error",
			});
		} finally {
			requestInFlight.current = false;
		}
	}, [router]);

	useEffect(() => {
		if (automaticRequestStarted.current) return;
		const pending = window.setTimeout(() => {
			if (automaticRequestStarted.current) return;
			automaticRequestStarted.current = true;
			void generate();
		}, 0);
		return () => window.clearTimeout(pending);
	}, [generate]);

	const copy =
		state.kind === "loading"
			? [
					"Kaito está trazando tu ruta",
					"Combinando tu objetivo, tu disponibilidad, tu entrenamiento actual y tu experiencia para construir una progresión a tu medida.",
				] as const
			: errorCopy[state.error];

	return (
		<main className="plan-generating-page" data-loading-screen="plan-generation">
			<Landscape />
			<section className="plan-generating-content" aria-labelledby="plan-generating-title">
				{state.kind === "loading" && <Loader />}
				<div
					className="plan-generating-status"
					role={state.kind === "error" ? "alert" : "status"}
					aria-atomic="true"
				>
					<h1 id="plan-generating-title">{copy[0]}</h1>
					<p>{copy[1]}</p>
				</div>
				{state.kind === "loading" ? (
					<ol
						className="plan-generating-progress"
						aria-label="Preparación del plan"
						data-progress-animation="sequential"
					>
						{progressSteps.map((step, index) => (
							<li key={step} style={{ "--progress-step": index } as CSSProperties}>
								{step}
							</li>
						))}
					</ol>
				) : (
					<button className="plan-generating-retry" type="button" onClick={() => void generate()}>
						Reintentar
					</button>
				)}
			</section>
		</main>
	);
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
		document.cookie = "kaito-e2e-session=; Path=/; Max-Age=0; SameSite=Lax";
		return;
	}
	await getBrowserSupabaseClient()?.auth.signOut();
}

function Landscape() {
	return (
		<svg
			className="plan-generating-landscape"
			viewBox="0 0 1440 900"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<path className="plan-generating-mountain plan-generating-mountain-left" d="M-90 760 285 500 690 760Z" />
			<path className="plan-generating-mountain plan-generating-mountain-right" d="M610 760 1085 465 1530 730V900H610Z" />
			<path className="plan-generating-route" d="M82 925C235 820 350 650 470 570C612 475 737 540 887 430C1043 315 1100 230 1358 198" />
		</svg>
	);
}

function Loader() {
	return (
		<div className="plan-generating-loader" data-animation="continuous" aria-hidden="true">
			<span className="plan-generating-loader-ring" />
			<svg viewBox="0 0 48 48">
				<path className="plan-generating-loader-peak-back" d="m12 33 9-16 9 16Z" />
				<path className="plan-generating-loader-peak-front" d="m22 33 8-13 8 13Z" />
				<circle cx="31" cy="14" r="4" />
			</svg>
		</div>
	);
}
