import { redirect } from "next/navigation";

import { getServerSessionResult } from "../../../../features/auth/_infrastructure/supabase/server";

export default async function PlanGeneratingPlaceholder() {
	const session = await getServerSessionResult();
	if (session.status !== "authenticated") {
		const context = session.status === "invalid" ? "&context=session_expired" : session.status === "unavailable" ? "&context=auth_unavailable" : "";
		redirect(`/login?returnTo=%2Fplan%2Fgenerating${context}`);
	}
	return (
		<main className="plan-generating-page">
			<section className="plan-generating-placeholder" aria-labelledby="plan-next-step-title">
				<span className="plan-generating-icon" aria-hidden="true">✓</span>
				<h1 id="plan-next-step-title">Tu enfoque se ha guardado</h1>
				<p>
					La creación personalizada de tu plan estará disponible en el siguiente paso. Puedes cerrar esta página con tranquilidad.
				</p>
			</section>
		</main>
	);
}
