import { redirect } from "next/navigation";

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
		<main>
			<h1>Onboarding process</h1>
			<p>Welcome to your Kaito onboarding area.</p>
		</main>
	);
}
