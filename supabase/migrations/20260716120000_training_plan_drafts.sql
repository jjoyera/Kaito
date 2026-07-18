CREATE TABLE IF NOT EXISTS public.training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  plan_approach text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_plans_status CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT training_plans_approach CHECK (plan_approach IN ('kaio_path', 'mode_z', 'kaioken'))
);

CREATE UNIQUE INDEX IF NOT EXISTS training_plans_one_draft_per_owner
  ON public.training_plans (owner_id) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS training_plans_one_active_per_owner
  ON public.training_plans (owner_id) WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.set_training_plan_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.plan_approach IS DISTINCT FROM OLD.plan_approach THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_training_plan_updated_at ON public.training_plans;
CREATE TRIGGER set_training_plan_updated_at
BEFORE UPDATE ON public.training_plans
FOR EACH ROW EXECUTE FUNCTION public.set_training_plan_updated_at();

GRANT SELECT ON public.training_plans TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.training_plans FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_plans TO kaito_api_login;
REVOKE ALL ON public.training_plans FROM PUBLIC;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated owners select training plans" ON public.training_plans;
CREATE POLICY "authenticated owners select training plans"
ON public.training_plans FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "authenticated owners insert training plans" ON public.training_plans;
DROP POLICY IF EXISTS "authenticated owners update training plans" ON public.training_plans;
DROP POLICY IF EXISTS "authenticated owners delete training plans" ON public.training_plans;

DROP POLICY IF EXISTS "backend owners write training plans" ON public.training_plans;
CREATE POLICY "backend owners write training plans"
ON public.training_plans FOR ALL TO kaito_api_login
USING ((SELECT auth.uid()) = owner_id) WITH CHECK ((SELECT auth.uid()) = owner_id);
