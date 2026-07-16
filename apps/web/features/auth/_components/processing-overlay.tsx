"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProcessingOverlayProps = {
	open: boolean;
	title: string;
	description: string;
	returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function ProcessingOverlay({
	open,
	title,
	description,
	returnFocusRef,
}: ProcessingOverlayProps) {
	const [host, setHost] = useState<HTMLDivElement | null>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = useId();
	const descriptionId = useId();

	useEffect(() => {
		if (!open) return;
		const portalHost = document.createElement("div");
		portalHost.dataset.authOverlayHost = "";
		document.body.append(portalHost);
		let active = true;
		queueMicrotask(() => {
			if (active) setHost(portalHost);
		});
		return () => {
			active = false;
			portalHost.remove();
		};
	}, [open]);

	useEffect(() => {
		if (!open || !host || !dialogRef.current) return;
		const dialog = dialogRef.current;
		const previouslyFocused = document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
		const priorOverflow = document.body.style.overflow;
		const returnFocusTarget = returnFocusRef?.current;
		const inertValues = new Map<HTMLElement, boolean>();
		for (const child of document.body.children) {
			if (child === host || !(child instanceof HTMLElement)) continue;
			inertValues.set(child, child.inert);
			child.inert = true;
		}
		document.body.style.overflow = "hidden";
		dialog.focus();

		const containFocus = (event: FocusEvent) => {
			if (!dialog.contains(event.target as Node)) dialog.focus();
		};
		document.addEventListener("focusin", containFocus);
		return () => {
			document.removeEventListener("focusin", containFocus);
			document.body.style.overflow = priorOverflow;
			for (const [element, inert] of inertValues) element.inert = inert;
			(returnFocusTarget ?? previouslyFocused)?.focus();
		};
	}, [host, open, returnFocusRef]);

	if (!open || !host) return null;
	return createPortal(
		<div
			className="auth-processing-overlay-backdrop"
			onPointerDown={(event) => event.preventDefault()}
		>
			<div
				aria-describedby={descriptionId}
				aria-labelledby={titleId}
				aria-modal="true"
				className="auth-processing-overlay"
				onKeyDown={(event) => {
					if (event.key === "Escape" || event.key === "Tab") {
						event.preventDefault();
						dialogRef.current?.focus();
					}
				}}
				ref={dialogRef}
				role="dialog"
				tabIndex={-1}
			>
				<div aria-hidden="true" className="auth-processing-overlay-spinner" />
				<div className="auth-processing-overlay-content">
					<h2 id={titleId}>{title}</h2>
					<p id={descriptionId}>{description}</p>
				</div>
			</div>
		</div>,
		host,
	);
}
