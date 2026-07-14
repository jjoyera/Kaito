import { selectReturnDestination } from "../_domain/return-destination";
import type { PrivateApiErrorKind } from "../../../shared/adapters/private-fetch";

type SessionRecoveryDependencies = {
	currentPath: string;
	signOut(): Promise<void>;
	replace(destination: string): void;
};

export function createSessionRecoveryController({
	currentPath,
	signOut,
	replace,
}: SessionRecoveryDependencies) {
	return {
		async recover(kind: PrivateApiErrorKind): Promise<void> {
			if (kind !== "auth_required" && kind !== "auth_rejected") {
				return;
			}

			try {
				await signOut();
			} catch {
				// Explicit recovery must remain available during provider failures.
			}
			const returnTo = selectReturnDestination(currentPath);
			replace(`/login?${new URLSearchParams({ returnTo })}`);
		},
	};
}
