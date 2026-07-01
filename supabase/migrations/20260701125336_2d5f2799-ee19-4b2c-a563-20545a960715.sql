-- 1) Rotate the webhook secret into Vault (no literal committed to version control).
do $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'feedback_webhook_secret';
  if v_id is null then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'feedback_webhook_secret',
      'MockMate feedback webhook shared secret'
    );
  else
    perform vault.update_secret(v_id, encode(gen_random_bytes(32), 'hex'));
  end if;
end $$;

-- 2) Trigger function reads the secret from Vault instead of a hardcoded literal.
create or replace function public.notify_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'feedback_webhook_secret';

  perform net.http_post(
    url := 'https://project--ded93034-1a06-4f46-9234-007919bbec0e-dev.lovable.app/api/public/feedback-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'feedback',
      'record', row_to_json(NEW)
    )
  );
  return NEW;
end;
$$;

-- 3) Remove the verifier that embedded the hardcoded secret literal.
drop function if exists public.verify_feedback_webhook_secret(text);

-- 4) Tighten the feedback INSERT policy: replace WITH CHECK (true) with real
--    validation while still permitting anonymous submissions.
drop policy if exists "Anyone can submit feedback" on public.feedback;
create policy "Anyone can submit feedback"
on public.feedback
for insert
to anon, authenticated
with check (
  rating between 1 and 5
  and (text is null or char_length(text) <= 2000)
);
