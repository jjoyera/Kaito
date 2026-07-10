export const AUTHENTICATED_FLOW_DESTINATION = "/";

export type AuthenticatedFlowNavigator = {
	replace(destination: string): void;
};

export function continueToAuthenticatedFlow(
	navigator: AuthenticatedFlowNavigator,
): void {
	navigator.replace(AUTHENTICATED_FLOW_DESTINATION);
}
