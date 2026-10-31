-- Client gallery: "all unedited images" + feedback on the final photos. Additive only.
--   galleries.unedited_price     proof gallery: price of the "I want all unedited images" option (null = not offered)
--   galleries.wants_unedited     proof gallery: the client ticked it when submitting their selection
--   galleries.unedited_included  finals gallery: the client gets every unedited image (paid in their package, or ticked)
--   galleries.feedback_sent_at   finals gallery: when the client last sent their feedback to the studio
--   gallery_images.image_set     finals gallery: 'edited' (default) or 'unedited'
--   gallery_feedback             thumbs up / down + a comment per final photo, per client

alter table public.galleries add column if not exists unedited_price numeric(10,2) check (unedited_price is null or unedited_price >= 0);
alter table public.galleries add column if not exists wants_unedited boolean not null default false;
alter table public.galleries add column if not exists unedited_included boolean not null default false;
alter table public.galleries add column if not exists feedback_sent_at timestamptz;

alter table public.gallery_images add column if not exists image_set text not null default 'edited';
do $$ begin
  alter table public.gallery_images add constraint gallery_images_image_set_check check (image_set in ('edited', 'unedited'));
exception when duplicate_object then null; end $$;
create index if not exists gallery_images_set_idx on public.gallery_images (gallery_id, image_set);

create table if not exists public.gallery_feedback (
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  image_id uuid not null references public.gallery_images(id) on delete cascade,
  client_email text not null check (client_email = lower(client_email)),
  reaction smallint check (reaction in (-1, 1)),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (image_id, client_email)
);
create index if not exists gallery_feedback_gallery_idx on public.gallery_feedback (gallery_id);

alter table public.gallery_feedback enable row level security;
drop policy if exists "admin all" on public.gallery_feedback;
create policy "admin all" on public.gallery_feedback for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "client read own feedback" on public.gallery_feedback;
create policy "client read own feedback" on public.gallery_feedback for select to authenticated
  using (client_email = (select public.current_email()));
-- clients write feedback only through the gallery-feedback Edge Function (it checks the private link or account)

drop trigger if exists gallery_feedback_touch on public.gallery_feedback;
create trigger gallery_feedback_touch before update on public.gallery_feedback for each row execute function public.touch_updated_at();
