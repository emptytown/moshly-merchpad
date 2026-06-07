-- Enable Row Level Security on all public tables exposed via PostgREST.
--
-- This app authenticates via Moshly SSO (not Supabase Auth), so there is no
-- auth.uid() context in PostgREST requests. The server exclusively uses the
-- service_role key, which bypasses RLS automatically — so no permissive
-- policies are needed and server-side operations are unaffected.
--
-- Effect: all PostgREST access via anon/authenticated roles is denied by
-- default (deny-all when RLS is enabled with no permissive policies).
-- This resolves the Supabase security advisor "RLS Disabled in Public" and
-- "Sensitive Columns Exposed" advisories for all affected tables.

ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tally_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;

-- Explicit deny policies (optional — documented for clarity; RLS with no
-- permissive policies already denies all by default, but named policies make
-- intent auditable in the Supabase dashboard).

CREATE POLICY "deny_all_projects"          ON public.projects          AS RESTRICTIVE TO public USING (false);
CREATE POLICY "deny_all_products"          ON public.products          AS RESTRICTIVE TO public USING (false);
CREATE POLICY "deny_all_shows"             ON public.shows             AS RESTRICTIVE TO public USING (false);
CREATE POLICY "deny_all_sale_sessions"     ON public.sale_sessions     AS RESTRICTIVE TO public USING (false);
CREATE POLICY "deny_all_tally_batches"     ON public.tally_batches     AS RESTRICTIVE TO public USING (false);
CREATE POLICY "deny_all_stock_adjustments" ON public.stock_adjustments AS RESTRICTIVE TO public USING (false);
CREATE POLICY "deny_all_team_members"      ON public.team_members      AS RESTRICTIVE TO public USING (false);
CREATE POLICY "deny_all_settings"          ON public.settings          AS RESTRICTIVE TO public USING (false);
CREATE POLICY "deny_all_audit_log"         ON public.audit_log         AS RESTRICTIVE TO public USING (false);
