"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { getSentryDsn } from "../lib/sentry-scrubbing";

export default function GlobalError({
	error,
}: {
	error: Error & { digest?: string };
}) {
	useEffect(() => {
		if (getSentryDsn()) Sentry.captureException(error);
	}, [error]);

	return (
		<html lang="en">
			<body>
				<main>
					<h1>Something went wrong.</h1>
					<p>Please refresh the page or try again later.</p>
				</main>
			</body>
		</html>
	);
}
