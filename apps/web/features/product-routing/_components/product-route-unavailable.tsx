import type { ProductRoute } from "../_domain/product-route-policy";

export function ProductRouteUnavailable({ route }: { route: ProductRoute }) {
	const href = route === "plan" ? "/plan" : "/onboarding";
	return (
		<main className="onboarding-page">
			<div className="onboarding-wizard">
				<section
					className="onboarding-wizard-card onboarding-status-surface onboarding-status-surface-error"
					role="alert"
					aria-labelledby="product-route-unavailable-title"
					aria-describedby="product-route-unavailable-description"
				>
					<span className="onboarding-status-icon" aria-hidden="true">
						!
					</span>
					<div className="onboarding-status-copy">
						<h1 id="product-route-unavailable-title">
							No hemos podido comprobar el estado de tu cuenta
						</h1>
						<p id="product-route-unavailable-description">
							El servicio no está disponible temporalmente. Inténtalo de nuevo en
							unos instantes.
						</p>
					</div>
					<a className="onboarding-status-action" href={href}>
						Reintentar <span aria-hidden="true">↻</span>
					</a>
				</section>
			</div>
		</main>
	);
}
