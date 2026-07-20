export type ProductRoute = "onboarding" | "plan";
export type OnboardingProductState =
	| "completed"
	| "incomplete"
	| "missing"
	| "unavailable";
export type ActivePlanPresence = "active" | "none" | "unavailable";

export type ProductRouteDecision =
	| { kind: "allow" }
	| {
			kind: "redirect";
			destination: "/onboarding" | "/plan" | "/plan?handoff=active-plan";
	  }
	| { kind: "unavailable" };

export type ProductRouteFacts = {
	route: ProductRoute;
	onboarding: OnboardingProductState;
	activePlan?: ActivePlanPresence;
	activePlanHandoff?: boolean;
};

export function decideProductRoute({
	route,
	onboarding,
	activePlan,
	activePlanHandoff = false,
}: ProductRouteFacts): ProductRouteDecision {
	if (onboarding === "unavailable") {
		return { kind: "unavailable" };
	}

	if (route === "plan") {
		return onboarding === "completed" || activePlanHandoff
			? { kind: "allow" }
			: { kind: "redirect", destination: "/onboarding" };
	}

	if (onboarding === "completed") {
		return { kind: "redirect", destination: "/plan" };
	}
	if (activePlan === "active") {
		return { kind: "redirect", destination: "/plan?handoff=active-plan" };
	}
	if (activePlan === "none") {
		return { kind: "allow" };
	}
	return { kind: "unavailable" };
}
