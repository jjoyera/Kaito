import { redirect } from "next/navigation";

import { getServerSessionResult } from "../../../../features/auth/_infrastructure/supabase/server";
import { PlanGeneration } from "../../../../features/planning/_components/plan-generation";

export default async function PlanGeneratingPage() {
	const session = await getServerSessionResult();
	if (session.status !== "authenticated") {
		const context =
			session.status === "invalid"
				? "&context=session_expired"
				: session.status === "unavailable"
					? "&context=auth_unavailable"
					: "";
		redirect(`/login?returnTo=%2Fplan%2Fgenerating${context}`);
	}

	return <PlanGeneration />;
}
