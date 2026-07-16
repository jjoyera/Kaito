"use client";

import { useEffect, useState } from "react";

import { consumePostSignupConfirmation } from "../_use-cases/post-signup-confirmation";

type Props = { nonce?: string };

export function PostSignupConfirmationBanner({ nonce }: Props) {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!nonce || !consumePostSignupConfirmation(nonce, window.sessionStorage)) return;
		const url = new URL(window.location.href);
		url.searchParams.delete("signupConfirmation");
		window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
		queueMicrotask(() => setVisible(true));
	}, [nonce]);

	return visible ? (
		<p aria-live="polite" className="login-form-success" role="status">
			Si los datos son correctos, recibirás un correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión.
		</p>
	) : null;
}
