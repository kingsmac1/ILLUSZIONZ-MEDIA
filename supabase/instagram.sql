-- =====================================================================
-- Instagram -> homepage gallery sync (see supabase/INSTAGRAM_SYNC.md)
-- Run once in Supabase -> SQL Editor. Safe to run again.
-- =====================================================================
alter table public.site_images add column if not exists source text not null default 'manual';   -- manual | instagram
alter table public.site_images add column if not exists ext_id text;                              -- the Instagram post id
alter table public.site_images add column if not exists link text not null default '';            -- the post on instagram.com
create unique index if not exists site_images_ext_idx on public.site_images (section, ext_id) where ext_id is not null;

-- No scheduler needed: the homepage asks the site to check Instagram every time it is opened.
