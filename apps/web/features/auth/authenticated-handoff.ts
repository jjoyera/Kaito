export const AUTHENTICATED_FLOW_DESTINATION = "/";

export type AuthenticatedFlowNavigator = {
	replace(destination: string): void;
};

export function continueToAuthenticatedFlow(
	navigator: AuthenticatedFlowNavigator,
	state?: unknown,
): void {
	void state;
	navigator.replace(AUTHENTICATED_FLOW_DESTINATION);
}
