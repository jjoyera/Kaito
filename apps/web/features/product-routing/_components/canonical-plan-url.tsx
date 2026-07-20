"use client";

import { useEffect } from "react";

export function CanonicalPlanUrl() {
	useEffect(() => {
		if (window.location.search === "?handoff=active-plan") {
			window.history.replaceState(window.history.state, "", "/plan");
		}
	}, []);
	return null;
}
