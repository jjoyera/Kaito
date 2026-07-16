import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "../../../features/auth/_components/login-form";
import { PostSignupConfirmationBanner } from "../../../features/auth/_components/post-signup-confirmation-banner";
import {
	getLoginContextMessage,
	selectReturnDestination,
} from "../../../features/auth/_domain/return-destination";
import { getServerSessionResult } from "../../../features/auth/_infrastructure/supabase/server";
import { normalizeConfirmationNonceInput } from "../../../features/auth/_use-cases/post-signup-confirmation";

type LoginPageProps = {
	searchParams: Promise<{
		context?: string | string[];
		returnTo?: string | string[];
		signupConfirmation?: string | string[];
	}>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const { context, returnTo, signupConfirmation } = await searchParams;
	const destination = selectReturnDestination(typeof returnTo === "string" ? returnTo : undefined);
	const session = await getServerSessionResult();
	if (session.status === "authenticated") redirect(destination);

	const message = getLoginContextMessage(
		session.status === "invalid" ? "session_expired" : context,
	);
	const confirmationNonce = normalizeConfirmationNonceInput(signupConfirmation);
	return (
		<main className="login-page">
			<section className="login-card" aria-labelledby="login-heading">
				<div className="login-brand">
					<p className="login-brand-wordmark">Kaito</p>
					<p className="login-brand-caption">Tu entrenador de carrera de montaña</p>
				</div>
				<h1 id="login-heading">Inicia sesión</h1>
				<p className="login-intro">Accede a tu espacio de entrenamiento</p>
				{message ? <p role="alert">{message}</p> : null}
				<PostSignupConfirmationBanner nonce={confirmationNonce} />
				<LoginForm returnTo={destination} />
				<p className="login-register-prompt">
					¿Aún no tienes cuenta? <Link href="/register">Crear cuenta</Link>
				</p>
			</section>
		</main>
	);
}
