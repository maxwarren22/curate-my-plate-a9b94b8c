-- Enable the pg_cron extension if not already enabled
create extension if not exists pg_cron with schema "extensions";

-- Grant usage to the postgres role
grant usage on schema cron to postgres;

-- WARNING: The service_role key is very powerful and should be handled with care.
-- We are using a security definer function to securely access the key from the Vault.
create or replace function "public"."invoke_send_weekly_plan"()
returns json
language plpgsql
security definer as $$
declare
  project_url text;
  service_key text;
  res json;
begin
  -- Securely get the project URL and service_role key from the Supabase Vault
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';

  -- If secrets are not in Vault, you can uncomment and set them manually, but this is less secure.
  -- project_url := 'https://YOUR_PROJECT_REF.supabase.co';
  -- service_key := 'YOUR_SERVICE_ROLE_KEY';

  -- Invoke the Edge Function
  select
      net.http_post(
          url := project_url || '/functions/v1/send-weekly-plan',
          headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || service_key
          ),
          body := '{}'::jsonb -- Empty body, or add parameters if your function needs them
      )
  into res;

  return res;
end;
$$;

-- Schedule the function to run every Sunday at 5:00 AM UTC
select
  cron.schedule(
    'weekly-plan-email',
    '0 5 * * sun',
    $$
      select public.invoke_send_weekly_plan();
    $$
  );