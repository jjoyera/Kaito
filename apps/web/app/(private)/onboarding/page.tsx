import { redirect } from "next/navigation";

import { OnboardingWizard } from "../../../features/onboarding/_components/onboarding-wizard";
import { getServerSessionResult } from "../../../features/auth/_infrastructure/supabase/server";

export default async function OnboardingPage() {
	const session = await getServerSessionResult();
	if (session.status !== "authenticated") {
		const context =
			session.status === "invalid"
				? "&context=session_expired"
				: session.status === "unavailable"
					? "&context=auth_unavailable"
					: "";
		redirect(`/login?returnTo=%2Fonboarding${context}`);
	}

	return (
		<main className="onboarding-page">
			<h1>Cuéntanos tu punto de partida</h1>
			<OnboardingWizard />
		</main>
	);
}
