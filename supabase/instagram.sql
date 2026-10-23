-- =====================================================================
-- Instagram -> homepage gallery sync (see supabase/INSTAGRAM_SYNC.md)
-- Run once in Supabase -> SQL Editor. Safe to run again.
-- =====================================================================
alter table public.site_images add column if not exists source text not null default 'manual';   -- manual | instagram
alter table public.site_images add column if not exists ext_id text;                              -- the Instagram post id
alter table public.site_images add column if not exists link text not null default '';            -- the post on instagram.com
create unique index if not exists site_images_ext_idx on public.site_images (section, ext_id) where ext_id is not null;

-- Checks Instagram every hour (the site only actually syncs when the interval you chose in the dashboard has passed).
-- Needs the pg_cron + pg_net extensions (Database -> Extensions). Replace YOUR_CRON_SECRET with the same CRON_SECRET you used for the email scheduler.
select cron.schedule('illuszionz-instagram', '7 * * * *', $job$
  select net.http_post(
    url := 'https://illuszionzmedia.com/api/instagram',
    headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);
