import { redirect } from "next/navigation";

import { OnboardingExperience } from "../../../features/onboarding/_components/onboarding-experience";
import { getServerSessionResult } from "../../../features/auth/_infrastructure/supabase/server";
import { getServerProductRouteDecision } from "../../../features/product-routing/_adapters/server-product-route-state";
import { ProductRouteUnavailable } from "../../../features/product-routing/_components/product-route-unavailable";

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

	const decision = await getServerProductRouteDecision("onboarding");
	if (decision.kind === "redirect") {
		redirect(decision.destination);
	}
	if (decision.kind === "unavailable") {
		return <ProductRouteUnavailable route="onboarding" />;
	}

	return (
		<main className="onboarding-page">
			<OnboardingExperience />
		</main>
	);
}
