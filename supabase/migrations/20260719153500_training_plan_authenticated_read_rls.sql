GRANT SELECT ON public.training_sessions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.training_sessions FROM authenticated;

REVOKE ALL ON public.training_plans FROM anon;
REVOKE ALL ON public.training_sessions FROM anon;
REVOKE ALL ON public.training_plans FROM PUBLIC;
REVOKE ALL ON public.training_sessions FROM PUBLIC;

DROP POLICY IF EXISTS "authenticated owners select active training sessions"
ON public.training_sessions;
CREATE POLICY "authenticated owners select active training sessions"
ON public.training_sessions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.training_plans AS plan
    WHERE plan.id = training_sessions.plan_id
      AND plan.owner_id = (SELECT auth.uid())
      AND plan.status = 'active'
  )
);
