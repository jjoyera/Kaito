DO $$
DECLARE parent_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kaito_api_login') THEN
    CREATE ROLE kaito_api_login NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
      NOCREATEROLE NOCREATEDB NOREPLICATION;
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kaito_api_login'
    AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreaterole
      OR rolcreatedb OR rolreplication)) OR EXISTS (
    SELECT 1 FROM pg_auth_members membership JOIN pg_roles member ON member.oid = membership.member
    WHERE member.rolname = 'kaito_api_login'
      AND (membership.roleid <> (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
        OR membership.inherit_option OR NOT membership.set_option
        OR membership.admin_option)
  ) THEN
    RAISE EXCEPTION 'unsafe kaito_api_login role configuration';
  END IF;
END
$$;

GRANT authenticated TO kaito_api_login WITH INHERIT FALSE, SET TRUE;

CREATE TABLE IF NOT EXISTS public.onboarding_snapshots (
  owner_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_snapshots_object' AND conrelid = 'public.onboarding_snapshots'::regclass) THEN
    ALTER TABLE public.onboarding_snapshots ADD CONSTRAINT onboarding_snapshots_object
      CHECK (jsonb_typeof(snapshot) = 'object');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_snapshots_version' AND conrelid = 'public.onboarding_snapshots'::regclass) THEN
    ALTER TABLE public.onboarding_snapshots ADD CONSTRAINT onboarding_snapshots_version
      CHECK (COALESCE(snapshot ? 'contract_version' AND snapshot->>'contract_version' = '1', false));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_snapshots_state' AND conrelid = 'public.onboarding_snapshots'::regclass) THEN
    ALTER TABLE public.onboarding_snapshots ADD CONSTRAINT onboarding_snapshots_state
      CHECK (COALESCE(snapshot ? 'state' AND snapshot->>'state' IN ('incomplete', 'completed'), false));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_onboarding_snapshot_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_onboarding_snapshot_updated_at ON public.onboarding_snapshots;
CREATE TRIGGER set_onboarding_snapshot_updated_at
BEFORE UPDATE ON public.onboarding_snapshots
FOR EACH ROW EXECUTE FUNCTION public.set_onboarding_snapshot_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_snapshots TO authenticated;
REVOKE ALL ON public.onboarding_snapshots FROM kaito_api_login, PUBLIC;
ALTER TABLE public.onboarding_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated owners select onboarding snapshots" ON public.onboarding_snapshots;
CREATE POLICY "authenticated owners select onboarding snapshots"
ON public.onboarding_snapshots FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "authenticated owners insert onboarding snapshots" ON public.onboarding_snapshots;
CREATE POLICY "authenticated owners insert onboarding snapshots"
ON public.onboarding_snapshots FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "authenticated owners update onboarding snapshots" ON public.onboarding_snapshots;
CREATE POLICY "authenticated owners update onboarding snapshots"
ON public.onboarding_snapshots FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = owner_id) WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "authenticated owners delete onboarding snapshots" ON public.onboarding_snapshots;
CREATE POLICY "authenticated owners delete onboarding snapshots"
ON public.onboarding_snapshots FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = owner_id);
