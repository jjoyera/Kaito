import { selectReturnDestination } from "../_domain/return-destination";

export const AUTHENTICATED_FLOW_DESTINATION = "/onboarding";

export type AuthenticatedFlowNavigator = {
	replace(destination: string): void;
};

export function continueToAuthenticatedFlow(
	navigator: AuthenticatedFlowNavigator,
	returnTo?: unknown,
): void {
	navigator.replace(
		typeof returnTo === "string"
			? selectReturnDestination(returnTo)
			: AUTHENTICATED_FLOW_DESTINATION,
	);
}
