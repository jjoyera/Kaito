import { LoginForm } from "../../../features/auth/_components/login-form";

export default function LoginPage() {
	return (
		<main className="login-page">
			<section className="login-card" aria-labelledby="login-heading">
				<div className="login-brand">
					<p className="login-brand-wordmark">Kaito</p>
					<p className="login-brand-caption">
						Tu entrenador de carrera de montaña
					</p>
				</div>
				<h1 id="login-heading">Inicia sesión</h1>
				<p className="login-intro">Accede a tu espacio de entrenamiento</p>
				<LoginForm />
			</section>
		</main>
	);
}
