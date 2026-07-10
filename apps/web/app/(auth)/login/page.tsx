import { notFound } from "next/navigation";
import { LoginForm } from "../../../features/auth/login-form";

export default function LoginPage() {
	if (isProductionLoginUnavailable()) {
		notFound();
	}

	return (
		<main className="login-page">
			<section className="login-card" aria-labelledby="login-heading">
				<p className="eyebrow">Kaito running coach</p>
				<h1 id="login-heading">Sign in to Kaito</h1>
				<p className="login-intro">
					Continue to your endurance coaching workspace with your existing email
					and password.
				</p>
				<LoginForm />
			</section>
		</main>
	);
}

function isProductionLoginUnavailable(): boolean {
	return process.env.VERCEL_ENV === "production";
}
