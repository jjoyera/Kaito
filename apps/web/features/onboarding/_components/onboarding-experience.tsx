"use client";

import { useState } from "react";

import { OnboardingIntro } from "./onboarding-intro";
import { OnboardingWizard } from "./onboarding-wizard";

export function OnboardingExperience() {
	const [hasStarted, setHasStarted] = useState(false);

	if (hasStarted) {
		return (
			<section className="onboarding-flow" aria-label="Configura tu plan">
				<OnboardingWizard />
			</section>
		);
	}

	return <OnboardingIntro onStart={() => setHasStarted(true)} />;
}
