import type { CSSProperties } from "react";
import { redirect } from "next/navigation";

import { getServerSessionResult } from "../../../../features/auth/_infrastructure/supabase/server";

const progressSteps = [
	"Analizando tu objetivo de carrera",
	"Revisando tu disponibilidad semanal",
	"Ajustando cargas y progresión",
	"Construyendo tu plan personalizado",
];

export default async function PlanGeneratingPage() {
	const session = await getServerSessionResult();
	if (session.status !== "authenticated") {
		const context = session.status === "invalid" ? "&context=session_expired" : session.status === "unavailable" ? "&context=auth_unavailable" : "";
		redirect(`/login?returnTo=%2Fplan%2Fgenerating${context}`);
	}

	return (
		<main className="plan-generating-page" data-loading-screen="plan-generation">
			<svg
				className="plan-generating-landscape"
				viewBox="0 0 1440 900"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<path className="plan-generating-mountain plan-generating-mountain-left" d="M-90 760 285 500 690 760Z" />
				<path className="plan-generating-mountain plan-generating-mountain-right" d="M610 760 1085 465 1530 730V900H610Z" />
				<path
					className="plan-generating-route"
					d="M82 925C235 820 350 650 470 570C612 475 737 540 887 430C1043 315 1100 230 1358 198"
				/>
			</svg>

			<section className="plan-generating-content" aria-labelledby="plan-generating-title">
				<div
					className="plan-generating-loader"
					data-animation="continuous"
					aria-hidden="true"
				>
					<span className="plan-generating-loader-ring" />
					<svg viewBox="0 0 48 48">
						<path className="plan-generating-loader-peak-back" d="m12 33 9-16 9 16Z" />
						<path className="plan-generating-loader-peak-front" d="m22 33 8-13 8 13Z" />
						<circle cx="31" cy="14" r="4" />
					</svg>
				</div>

				<div className="plan-generating-status" role="status" aria-atomic="true">
					<h1 id="plan-generating-title">Kaito está trazando tu ruta</h1>
					<p>
						Combinando tu objetivo, tu disponibilidad, tu entrenamiento actual y tu experiencia para construir una progresión a tu medida.
					</p>
				</div>

				<ol className="plan-generating-progress" aria-label="Preparación del plan" data-progress-animation="sequential">
					{progressSteps.map((step, index) => (
						<li key={step} style={{ "--progress-step": index } as CSSProperties}>
							{step}
						</li>
					))}
				</ol>
			</section>
		</main>
	);
}
