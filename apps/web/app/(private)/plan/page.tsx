import { redirect } from "next/navigation";

import { getServerSessionResult } from "../../../features/auth/_infrastructure/supabase/server";
import { ActivePlanDashboard } from "../../../features/planning/_components/active-plan-dashboard";
import { getServerProductRouteDecision } from "../../../features/product-routing/_adapters/server-product-route-state";
import { CanonicalPlanUrl } from "../../../features/product-routing/_components/canonical-plan-url";
import { ProductRouteUnavailable } from "../../../features/product-routing/_components/product-route-unavailable";

type PlanPageProps = {
	searchParams: Promise<{ handoff?: string }>;
};

export default async function PlanPage({ searchParams }: PlanPageProps) {
	const session = await getServerSessionResult();
	if (session.status !== "authenticated") {
		const context =
			session.status === "invalid"
				? "&context=session_expired"
				: session.status === "unavailable"
					? "&context=auth_unavailable"
					: "";
		redirect(`/login?returnTo=%2Fplan${context}`);
	}

	const { handoff } = await searchParams;
	const activePlanHandoff = handoff === "active-plan";
	const decision = await getServerProductRouteDecision("plan", {
		activePlanHandoff,
	});
	if (decision.kind === "redirect") {
		redirect(decision.destination);
	}
	if (decision.kind === "unavailable") {
		return <ProductRouteUnavailable route="plan" />;
	}

	return (
		<>
			{activePlanHandoff && <CanonicalPlanUrl />}
			<ActivePlanDashboard />
		</>
	);
}
