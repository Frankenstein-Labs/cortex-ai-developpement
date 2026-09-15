-- Resolve opaque CORTEX web-session hashes without exposing session tokens to the database.
BEGIN;
CREATE FUNCTION app_resolve_web_session(candidate_hash BYTEA)
RETURNS TABLE (session_id UUID, user_id UUID, email CITEXT, email_verified BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT s.id, u.id, u.email, (u.email_verified_at IS NOT NULL)
  FROM public.web_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = candidate_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND u.disabled_at IS NULL
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_resolve_web_session(BYTEA) FROM PUBLIC;
COMMIT;
