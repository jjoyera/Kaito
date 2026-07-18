"use client";

import { useId } from "react";

type OnboardingStatusSurfaceProps =
	| {
			variant: "loading";
			title: string;
			description: string;
	  }
	| {
			variant: "error";
			title: string;
			description: string;
			action?: {
				label: string;
				href: "/onboarding";
			};
	  };

export function OnboardingStatusSurface(props: OnboardingStatusSurfaceProps) {
	const titleId = useId();
	const descriptionId = useId();
	const isError = props.variant === "error";

	return (
		<div className="onboarding-wizard">
			<section
				className={`onboarding-wizard-card onboarding-status-surface${
					isError ? " onboarding-status-surface-error" : ""
				}`}
				aria-describedby={isError ? descriptionId : undefined}
				aria-labelledby={isError ? titleId : undefined}
				aria-live={isError ? undefined : "polite"}
				role={isError ? "alert" : "status"}
			>
				{isError ? (
					<span className="onboarding-status-icon" aria-hidden="true">
						!
					</span>
				) : (
					<span className="onboarding-status-spinner" aria-hidden="true" />
				)}
				<div className="onboarding-status-copy">
					<h1 id={isError ? titleId : undefined}>{props.title}</h1>
					<p id={isError ? descriptionId : undefined}>{props.description}</p>
				</div>
				{isError ? (
					props.action ? (
						<a
							className="onboarding-status-action"
							href={props.action.href}
						>
							{props.action.label} <span aria-hidden="true">↻</span>
						</a>
					) : null
				) : (
					<div className="onboarding-status-placeholder" aria-hidden="true">
						<span />
						<span />
						<span />
					</div>
				)}
			</section>
		</div>
	);
}
