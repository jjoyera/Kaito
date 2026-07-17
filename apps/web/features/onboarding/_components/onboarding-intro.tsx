type OnboardingIntroProps = Readonly<{
	onStart: () => void;
}>;

export function OnboardingIntro({ onStart }: OnboardingIntroProps) {
	return (
		<section className="onboarding-intro" aria-labelledby="onboarding-intro-title">
			<div className="onboarding-intro-content">
				<header className="onboarding-intro-header">
					<h1 id="onboarding-intro-title">
						Tu plan de entrenamiento,
						<br /> hecho a tu medida
					</h1>
					<p>
						Kaito diseña, explica y adapta tu entrenamiento según tu objetivo, tu
						fondo y el tiempo real que tienes para entrenar.
					</p>
				</header>

				<div className="onboarding-intro-benefits">
					<article className="onboarding-intro-card">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="12" cy="12" r="8.5" />
							<circle cx="12" cy="12" r="4.5" />
							<circle cx="12" cy="12" r="1" />
						</svg>
						<h2>Plan personalizado</h2>
						<p>Construido desde tu objetivo real y tu disponibilidad.</p>
					</article>

					<article className="onboarding-intro-card">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="m3 16 5-5 3 3 7-8" />
							<path d="m16 6h2v2" />
						</svg>
						<h2>Explicaciones claras</h2>
						<p>Sabes por qué haces cada sesión, no solo qué hacer.</p>
					</article>
				</div>

				<button className="onboarding-intro-cta" type="button" onClick={onStart}>
					Crear mi plan <span aria-hidden="true">→</span>
				</button>
			</div>
		</section>
	);
}
