ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backend owners select training sessions" ON public.training_sessions;
CREATE POLICY "backend owners select training sessions"
ON public.training_sessions FOR SELECT TO kaito_api_login
USING (
  EXISTS (
    SELECT 1
    FROM public.training_plans AS plan
    WHERE plan.id = training_sessions.plan_id
      AND plan.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "backend owners insert training sessions" ON public.training_sessions;
CREATE POLICY "backend owners insert training sessions"
ON public.training_sessions FOR INSERT TO kaito_api_login
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.training_plans AS plan
    WHERE plan.id = training_sessions.plan_id
      AND plan.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "backend owners update training sessions" ON public.training_sessions;
CREATE POLICY "backend owners update training sessions"
ON public.training_sessions FOR UPDATE TO kaito_api_login
USING (
  EXISTS (
    SELECT 1
    FROM public.training_plans AS plan
    WHERE plan.id = training_sessions.plan_id
      AND plan.owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.training_plans AS plan
    WHERE plan.id = training_sessions.plan_id
      AND plan.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "backend owners delete training sessions" ON public.training_sessions;
CREATE POLICY "backend owners delete training sessions"
ON public.training_sessions FOR DELETE TO kaito_api_login
USING (
  EXISTS (
    SELECT 1
    FROM public.training_plans AS plan
    WHERE plan.id = training_sessions.plan_id
      AND plan.owner_id = (SELECT auth.uid())
  )
);
