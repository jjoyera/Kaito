import { OnboardingStatusSurface } from "../../../features/onboarding/_components/onboarding-status-surface";

export default function OnboardingLoading() {
	return (
		<OnboardingStatusSurface
			variant="loading"
			title="Preparando tu plan"
			description="Estamos preparando tu espacio de onboarding para que puedas continuar con tu plan."
		/>
	);
}
