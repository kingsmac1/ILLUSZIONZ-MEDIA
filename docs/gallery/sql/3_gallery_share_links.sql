-- Client gallery: private share links. Additive only.
-- Each gallery gets an unguessable key (64 hex characters, ~244 random bits). The emailed link is
-- /gallery/<id>/?k=<share_token>, which opens the gallery without signing in. Signing in with the gallery's email still
-- works without the key (the account area links), and the studio can reset the key from the dashboard to kill old links.
-- Only admins and the owning client can read it (existing RLS on public.galleries); the Edge Functions compare it.

alter table public.galleries
  add column if not exists share_token text not null
  default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

create unique index if not exists galleries_share_token_key on public.galleries (share_token);
