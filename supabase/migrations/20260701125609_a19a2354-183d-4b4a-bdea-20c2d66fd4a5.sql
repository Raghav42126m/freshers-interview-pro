revoke execute on function public.verify_feedback_webhook_secret(text) from anon, authenticated;
revoke all on function public.verify_feedback_webhook_secret(text) from public;
grant execute on function public.verify_feedback_webhook_secret(text) to service_role;
