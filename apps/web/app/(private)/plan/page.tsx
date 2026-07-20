import { redirect } from "next/navigation";

import { getServerSessionResult } from "../../../features/auth/_infrastructure/supabase/server";
import { ActivePlanDashboard } from "../../../features/planning/_components/active-plan-dashboard";

export default async function PlanPage() {
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

	return <ActivePlanDashboard />;
}
