import {
	decideProductRoute,
	type ActivePlanPresence,
	type OnboardingProductState,
	type ProductRoute,
	type ProductRouteDecision,
} from "../_domain/product-route-policy";

export type ProductRouteStateAccess = {
	loadOnboarding(): Promise<OnboardingProductState>;
	loadActivePlan(): Promise<ActivePlanPresence>;
};

export async function resolveProductRoute(
	route: ProductRoute,
	stateAccess: ProductRouteStateAccess,
	options: { activePlanHandoff?: boolean } = {},
): Promise<ProductRouteDecision> {
	const onboarding = await stateAccess.loadOnboarding();
	if (route === "plan" || onboarding === "completed" || onboarding === "unavailable") {
		return decideProductRoute({
			route,
			onboarding,
			activePlanHandoff: options.activePlanHandoff,
		});
	}

	const activePlan = await stateAccess.loadActivePlan();
	return decideProductRoute({ route, onboarding, activePlan });
}
