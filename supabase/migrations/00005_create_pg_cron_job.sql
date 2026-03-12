-- Enable pg_cron extension and schedule sap-sync every 10 minutes
-- Note: pg_cron may need to be enabled in the Supabase dashboard first
create extension if not exists pg_cron;

-- Schedule the sap-sync Edge Function every 10 minutes
-- This calls the edge function via pg_net (HTTP extension)
create extension if not exists pg_net;

select cron.schedule(
  'sap-sync-cache',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sap-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
