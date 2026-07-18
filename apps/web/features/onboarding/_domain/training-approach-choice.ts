export type TrainingApproach = "kaio_path" | "mode_z" | "kaioken";

export type ApproachEligibility = {
	approach: TrainingApproach;
	available: boolean;
	blocking_reason_codes: readonly string[];
};

export type TrainingApproachAssessment = {
	recommended_approach: "kaio_path" | "mode_z";
	approaches: readonly ApproachEligibility[];
	safety_restriction_codes: readonly string[];
};

export type ApproachChoice = {
	approach: TrainingApproach;
	name: string;
	description: string;
	available: boolean;
	blockingReasons: readonly string[];
};

const ORDER: readonly TrainingApproach[] = ["kaio_path", "mode_z", "kaioken"];
const COPY: Record<TrainingApproach, Pick<ApproachChoice, "name" | "description">> = {
	kaio_path: {
		name: "Camino Kaio",
		description: "Un enfoque progresivo para construir constancia y una base sólida.",
	},
	mode_z: {
		name: "Modo Z",
		description: "Un equilibrio exigente entre desarrollo, recuperación y continuidad.",
	},
	kaioken: {
		name: "Kaioken",
		description: "La opción de mayor intensidad para una preparación avanzada.",
	},
};

const BLOCKING_REASON_COPY: Record<string, string> = {
	recovering: "Estás en recuperación; este enfoque no está disponible ahora.",
	pain_affects_running: "El dolor o la limitación afecta a tu carrera.",
	physical_status_not_feeling_good: "Tu estado físico actual no permite este enfoque.",
	pain_or_limitation_present: "Has indicado dolor o una limitación.",
	insufficient_weekly_sessions: "Necesitas más sesiones semanales recientes.",
	insufficient_recent_consistency: "Necesitas mayor constancia reciente.",
	insufficient_volume_ratio: "Tu volumen reciente todavía es insuficiente.",
	insufficient_experience_ratio: "Tu experiencia previa todavía es insuficiente.",
	insufficient_long_run_ratio: "Tu salida larga reciente todavía es insuficiente.",
	insufficient_prior_modality_races: "Necesitas más experiencia en esta modalidad.",
	insufficient_mountain_experience: "Necesitas más experiencia en montaña.",
	insufficient_available_days: "Necesitas más días disponibles para entrenar.",
	insufficient_available_minutes: "Necesitas más tiempo semanal disponible.",
	insufficient_time_to_goal: "No queda tiempo suficiente hasta tu objetivo.",
};

export const SAFETY_RESTRICTION_COPY: Record<string, string> = {
	no_load_increase: "No aumentaremos la carga de entrenamiento.",
	no_demanding_sessions: "Evitaremos sesiones exigentes.",
	favor_recovery_rest_or_gentle_activity: "Priorizaremos recuperación, descanso o actividad suave.",
	no_compensation: "No compensaremos sesiones perdidas con más carga.",
	no_weekly_load_increase: "No aumentaremos la carga semanal.",
	reduce_demanding_session_intensity_or_duration: "Reduciremos la intensidad o duración de las sesiones exigentes.",
};

export function buildApproachChoices(assessment: TrainingApproachAssessment): ApproachChoice[] {
	return ORDER.map((approach) => {
		const eligibility = assessment.approaches.find((item) => item.approach === approach);
		return {
			approach,
			...COPY[approach],
			available: eligibility?.available === true,
			blockingReasons: (eligibility?.blocking_reason_codes ?? []).map(
				(code) => BLOCKING_REASON_COPY[code] ?? "Este enfoque no está disponible con tu situación actual.",
			),
		};
	});
}

export function previewBlockingReasons(
	reasons: readonly string[],
	expanded: boolean,
): { visible: readonly string[]; hiddenCount: number } {
	return expanded
		? { visible: reasons, hiddenCount: 0 }
		: { visible: reasons.slice(0, 3), hiddenCount: Math.max(0, reasons.length - 3) };
}

export function canSelectApproach(choice: ApproachChoice): boolean {
	return choice.available;
}

export function formatUtcCalendarDate(now = new Date()): string {
	return now.toISOString().slice(0, 10);
}
