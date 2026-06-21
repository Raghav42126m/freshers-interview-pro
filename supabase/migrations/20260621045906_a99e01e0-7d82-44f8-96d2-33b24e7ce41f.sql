-- Database-side verifier so the webhook secret never depends on a hand-entered value.
-- The trigger function and this verifier share the exact same literal, guaranteeing a match.
CREATE OR REPLACE FUNCTION public.verify_feedback_webhook_secret(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate = '48cd909827a6d1a05ec493e7f55de3740e36d873013170cd47f7abfa37f1a517'
$$;

REVOKE ALL ON FUNCTION public.verify_feedback_webhook_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_feedback_webhook_secret(text) TO service_role;