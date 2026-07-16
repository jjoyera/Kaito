import { RegisterForm } from "../../../features/auth/_components/register-form";

export default function RegisterPage() {
	return (
		<main className="login-page">
			<section className="login-card" aria-labelledby="register-heading">
				<div className="login-brand">
					<p className="login-brand-wordmark">Kaito</p>
					<p className="login-brand-caption">
						Tu entrenador de carrera de montaña
					</p>
				</div>
				<h1 id="register-heading">Crea tu cuenta</h1>
				<p className="login-intro">Empieza a preparar tus próximos retos</p>
				<RegisterForm />
			</section>
		</main>
	);
}
