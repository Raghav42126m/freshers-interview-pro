-- Verifier reads the rotated secret from Vault and compares — no literal in code.
create or replace function public.verify_feedback_webhook_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select candidate = (
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'feedback_webhook_secret'
  )
$$;

revoke all on function public.verify_feedback_webhook_secret(text) from public;
grant execute on function public.verify_feedback_webhook_secret(text) to anon, authenticated, service_role;
