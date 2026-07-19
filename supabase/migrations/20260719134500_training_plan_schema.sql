ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS block_focus text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.training_plans
    WHERE status IN ('active', 'archived')
      AND (start_date IS NULL OR end_date IS NULL OR block_focus IS NULL)
  ) THEN
    RAISE EXCEPTION
      'canonical training plan migration requires complete active and archived plans';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.training_plans'::regclass
      AND conname = 'training_plans_canonical_fields'
  ) THEN
    ALTER TABLE public.training_plans
      ADD CONSTRAINT training_plans_canonical_fields CHECK (
        (status = 'draft' AND start_date IS NULL AND end_date IS NULL AND block_focus IS NULL)
        OR (
          start_date IS NOT NULL
          AND end_date IS NOT NULL
          AND length(btrim(block_focus)) > 0
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.training_plans'::regclass
      AND conname = 'training_plans_date_range'
  ) THEN
    ALTER TABLE public.training_plans
      ADD CONSTRAINT training_plans_date_range CHECK (
        start_date IS NULL
        OR (end_date >= start_date AND end_date < start_date + 28)
      );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.training_plans (id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  scheduled_date date NOT NULL,
  session_type text NOT NULL,
  session_category text NOT NULL,
  planned_duration_minutes integer NOT NULL,
  planned_distance_kilometers numeric NOT NULL,
  planned_elevation_meters integer NOT NULL,
  intensity_description text NOT NULL,
  target_rpe_min integer NOT NULL,
  target_rpe_max integer NOT NULL,
  instructions text NOT NULL,
  purpose text NOT NULL,
  session_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_sessions_week_number CHECK (week_number BETWEEN 1 AND 4),
  CONSTRAINT training_sessions_category CHECK (
    session_category IN ('run', 'strength', 'recovery', 'cross_training')
  ),
  CONSTRAINT training_sessions_duration CHECK (planned_duration_minutes > 0),
  CONSTRAINT training_sessions_distance CHECK (planned_distance_kilometers >= 0),
  CONSTRAINT training_sessions_elevation CHECK (planned_elevation_meters >= 0),
  CONSTRAINT training_sessions_rpe CHECK (
    target_rpe_min BETWEEN 1 AND 10
    AND target_rpe_max BETWEEN 1 AND 10
    AND target_rpe_min <= target_rpe_max
  ),
  CONSTRAINT training_sessions_order CHECK (session_order > 0),
  CONSTRAINT training_sessions_nonblank_text CHECK (
    length(btrim(session_type)) > 0
    AND length(btrim(intensity_description)) > 0
    AND length(btrim(instructions)) > 0
    AND length(btrim(purpose)) > 0
  ),
  CONSTRAINT training_sessions_plan_week_order UNIQUE (
    plan_id, week_number, session_order
  )
);

CREATE OR REPLACE FUNCTION public.validate_training_session_schedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  plan_start date;
  plan_end date;
BEGIN
  SELECT start_date, end_date
  INTO plan_start, plan_end
  FROM public.training_plans
  WHERE id = NEW.plan_id;

  IF NOT FOUND THEN
    RAISE foreign_key_violation USING MESSAGE = 'training session plan does not exist';
  END IF;

  IF plan_start IS NULL OR plan_end IS NULL THEN
    RAISE check_violation USING MESSAGE = 'training sessions require a dated plan';
  END IF;

  IF NEW.scheduled_date < plan_start OR NEW.scheduled_date > plan_end THEN
    RAISE check_violation USING MESSAGE = 'training session date is outside plan range';
  END IF;

  IF NEW.week_number <> ((NEW.scheduled_date - plan_start) / 7) + 1 THEN
    RAISE check_violation USING MESSAGE = 'training session week is incoherent with date';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_training_session_schedule ON public.training_sessions;
CREATE TRIGGER validate_training_session_schedule
BEFORE INSERT OR UPDATE OF plan_id, week_number, scheduled_date
ON public.training_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_training_session_schedule();

CREATE OR REPLACE FUNCTION public.validate_training_plan_schedule_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.training_sessions session
    WHERE session.plan_id = NEW.id
      AND (
        NEW.start_date IS NULL
        OR NEW.end_date IS NULL
        OR session.scheduled_date < NEW.start_date
        OR session.scheduled_date > NEW.end_date
        OR session.week_number <> ((session.scheduled_date - NEW.start_date) / 7) + 1
      )
  ) THEN
    RAISE check_violation USING MESSAGE = 'plan dates conflict with training sessions';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_training_plan_schedule_update ON public.training_plans;
CREATE TRIGGER validate_training_plan_schedule_update
BEFORE UPDATE OF start_date, end_date
ON public.training_plans
FOR EACH ROW EXECUTE FUNCTION public.validate_training_plan_schedule_update();

REVOKE ALL ON public.training_sessions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_sessions TO kaito_api_login;
