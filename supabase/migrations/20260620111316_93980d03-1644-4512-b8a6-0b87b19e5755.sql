-- Enable pg_net for outbound HTTP from the database
create extension if not exists pg_net with schema extensions;

-- Trigger function: POST each new feedback row to the secured webhook endpoint
create or replace function public.notify_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://project--ded93034-1a06-4f46-9234-007919bbec0e-dev.lovable.app/api/public/feedback-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '48cd909827a6d1a05ec493e7f55de3740e36d873013170cd47f7abfa37f1a517'
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

-- Fire on every INSERT to feedback
drop trigger if exists on_feedback_insert on public.feedback;
create trigger on_feedback_insert
after insert on public.feedback
for each row execute function public.notify_feedback_insert();