-- Daily clean-up of watermarked previews 30 days after finals are delivered.
-- scripts/gallery-go-live.sh runs this for you with the real values. Only paste it by hand if you must:
-- replace YOUR_PROJECT_REF, YOUR_ANON_KEY and YOUR_GALLERY_CRON_SECRET (the same value as the Edge Function secret GALLERY_CRON_SECRET).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'gallery-purge-previews';
select cron.schedule('gallery-purge-previews', '15 3 * * *', $job$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/gallery-purge-previews',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer YOUR_ANON_KEY', 'x-cron-secret', 'YOUR_GALLERY_CRON_SECRET'),
    body := '{}'::jsonb);
$job$);
