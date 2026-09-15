-- Revoke opaque CORTEX sessions server-side during logout.
BEGIN;
CREATE FUNCTION app_revoke_web_session(candidate_hash BYTEA)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  UPDATE public.web_sessions
  SET revoked_at = now()
  WHERE token_hash = candidate_hash AND revoked_at IS NULL
$$;
REVOKE ALL ON FUNCTION app_revoke_web_session(BYTEA) FROM PUBLIC;
COMMIT;
