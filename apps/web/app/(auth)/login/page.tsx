import { redirect } from "next/navigation";

import { LoginForm } from "../../../features/auth/_components/login-form";
import {
	getLoginContextMessage,
	selectReturnDestination,
} from "../../../features/auth/_domain/return-destination";
import { getServerSessionResult } from "../../../features/auth/_infrastructure/supabase/server";

type LoginPageProps = {
	searchParams: Promise<{ context?: string; returnTo?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const { context, returnTo } = await searchParams;
	const destination = selectReturnDestination(returnTo);
	const session = await getServerSessionResult();
	if (session.status === "authenticated") redirect(destination);

	const message = getLoginContextMessage(
		session.status === "invalid" ? "session_expired" : context,
	);
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
				{message ? <p role="alert">{message}</p> : null}
				<LoginForm returnTo={destination} />
			</section>
		</main>
	);
}
