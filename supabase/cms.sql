-- =====================================================================
-- Illuszionz Media — website CMS (blog, store, testimonials, images, banner, page SEO)
-- Run AFTER schema.sql (needs is_admin()). Safe to run more than once.
-- Public pages never read these tables directly: Cloudflare Pages Functions use the service-role key.
-- =====================================================================

-- ---------- Blog ----------
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  content text not null default '',               -- HTML written in the dashboard editor
  cover_url text not null default '',
  cover_alt text not null default '',
  category text not null default '',
  tags text[] not null default '{}',
  author text not null default 'Illuszionz Media',
  published boolean not null default false,
  published_at timestamptz,
  seo_title text not null default '',             -- <title> (falls back to the post title)
  seo_description text not null default '',       -- meta description (falls back to the excerpt)
  og_image text not null default '',              -- social share image (falls back to the cover)
  noindex boolean not null default false,
  read_minutes integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blog_posts_pub_idx on public.blog_posts (published, published_at desc);

-- ---------- Store products ----------
create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  bullets text[] not null default '{}',
  image_url text not null default '',
  price text not null default '',                 -- shown as typed, e.g. "£25"
  price_note text not null default '',            -- e.g. "45 minute session"
  cta text not null default 'Buy now',
  flow_id text not null default '',               -- '' = external link; 'store' = the built-in booking form
  option_id text not null default '',
  buy_url text not null default '',               -- e.g. a Selar link (used when flow_id is empty)
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Testimonials (home page slider) ----------
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null,
  author text not null,
  role text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Managed image sets: home-hero, home-gallery, wedding-gallery ----------
create table if not exists public.site_images (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  url text not null,
  thumb_url text not null default '',
  alt text not null default '',
  width integer not null default 0,
  height integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists site_images_section_idx on public.site_images (section, sort_order);

-- ---------- Per-page SEO overrides (applied at the edge on top of the built-in tags) ----------
create table if not exists public.page_seo (
  path text primary key,                          -- e.g. /wedding/
  title text not null default '',
  description text not null default '',
  og_image text not null default '',
  noindex boolean not null default false,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['blog_posts','store_products','testimonials','site_images','page_seo']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Which website parts are now managed from the dashboard (until a part is managed, the site keeps its built-in content)
-- and the site-wide banner. Edited from Dashboard -> Website.
insert into public.settings (key, value) values
  ('cms_managed', '{"store":false,"testimonials":false,"home-hero":false,"home-gallery":false,"wedding-gallery":false}'),
  ('notice', '{"enabled":false,"text":"","link":"","label":"","tone":"dark"}')
on conflict (key) do nothing;

-- ---------- Uploads for the CMS (public bucket, admin-only writes) ----------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true) on conflict (id) do nothing;
    drop policy if exists "site media public read" on storage.objects;
    create policy "site media public read" on storage.objects for select to anon, authenticated using (bucket_id = 'site-media');
    drop policy if exists "site media admin write" on storage.objects;
    create policy "site media admin write" on storage.objects for all to authenticated using (bucket_id = 'site-media' and public.is_admin()) with check (bucket_id = 'site-media' and public.is_admin());
  end if;
end $$;

-- ---------- Starter blog posts (edit or delete them in Dashboard -> Blog) ----------
insert into public.blog_posts (slug, title, excerpt, content, cover_url, cover_alt, category, tags, published, published_at, seo_title, seo_description, read_minutes) values
('how-to-prepare-for-your-portrait-photography-session',
 'How to Prepare for Your Portrait Photography Session',
 'Simple, practical tips on outfits, hair, makeup and posing so you walk into your portrait session relaxed and walk out with pictures you love.',
 $p$<p>A great portrait is a mix of good light, a good photographer and a client who feels comfortable. You can only control one of those three — so here is how to make sure you show up ready and relaxed.</p>
<h2>1. Plan your looks in advance</h2>
<p>Choose outfits that you already feel confident in. Solid colours and simple textures photograph better than busy patterns or large logos. If your package includes more than one look, pick outfits that contrast in colour or mood so each set of pictures feels fresh.</p>
<ul><li>Bring your outfit steamed or ironed.</li><li>Pack a backup top and a pair of neutral shoes.</li><li>Think about the background: darker clothes pop against light walls and vice versa.</li></ul>
<h2>2. Keep hair and makeup natural but polished</h2>
<p>Book your hair appointment two or three days before, not the morning of, so everything has time to settle. For makeup, a little more definition than you would wear day-to-day works well because cameras soften features. Matte products help control shine under studio lights.</p>
<h2>3. Get the small things right</h2>
<ol><li>Sleep well and drink water the day before.</li><li>Avoid new skincare products in the week leading up.</li><li>Moisturise lips and hands — close-ups show everything.</li></ol>
<h2>4. Bring a mood, not a script</h2>
<p>Send us a few inspiration images or a Pinterest board when you book. We use them to understand the feeling you want, then adapt the lighting and posing to suit you. You do not need to know how to pose — we guide you through every shot.</p>
<h2>5. Arrive on time and relax</h2>
<p>Sessions run to a strict timetable so every client gets their full slot, so please arrive a few minutes early. Once you are in front of the camera, breathe, take your time and enjoy it.</p>
<p>Ready to book? Explore our <a href="/photography-services/">portrait photography packages</a> or <a href="/contact/">get in touch</a> and we will help you choose.</p>$p$,
 '/images/ILU6151.webp', 'A portrait session in the Illuszionz Media studio', 'Photography tips', array['portrait','tips','studio'], true, now() - interval '21 days',
 'How to Prepare for a Portrait Photography Session | Illuszionz Media', 'Outfit, hair, makeup and posing tips from a London portrait studio — everything you need to prepare for a relaxed, confident portrait session.', 3),

('wedding-photography-timeline-how-to-plan-your-day',
 'Wedding Photography Timeline: How to Plan Your Day',
 'A relaxed, realistic timeline for your wedding day so there is time for every important photograph — and time to enjoy the day itself.',
 $p$<p>Your wedding photographs are one of the few things that last long after the day is over. A simple timeline protects the time you need for them without taking over the celebration.</p>
<h2>Getting ready (60–90 minutes)</h2>
<p>This is where the story begins: the dress, the details, the nerves and the laughter. Make sure the room is tidy and well lit, and gather rings, invitations, shoes and jewellery in one place so we can photograph them together.</p>
<h2>First look and couple portraits (45–60 minutes)</h2>
<p>If you choose a first look, you will have calm, private portraits before the guests arrive. If you prefer to wait, schedule your couple portraits straight after the ceremony while the light is still good.</p>
<h2>The ceremony</h2>
<p>We stay discreet and capture the moments that matter: the entrance, the vows, the rings and the first kiss. Check with your venue or place of worship about photography rules beforehand.</p>
<h2>Family and group photographs (30 minutes)</h2>
<p>Write a short list of the groupings you want and give it to a confident friend who knows the family. A clear list keeps this part quick and stress-free.</p>
<h2>Reception and celebration</h2>
<ul><li>Cake cutting and speeches</li><li>First dance</li><li>Candid moments with your guests</li></ul>
<h2>Plan for golden hour</h2>
<p>If your timeline allows, step out for ten minutes around sunset for dreamy, warm portraits. It is often the favourite set of pictures.</p>
<p>Our <a href="/wedding/">Silver, Gold, Diamond and Traditional wedding packages</a> include planning support — tell us your date and we will help you shape the day.</p>$p$,
 '/images/ILU6217.webp', 'Couple portrait at a wedding photographed by Illuszionz Media', 'Weddings', array['wedding','planning','timeline'], true, now() - interval '14 days',
 'Wedding Photography Timeline: Plan Your Day | Illuszionz Media', 'A realistic wedding day photography timeline: getting ready, first look, ceremony, family photos and golden hour — plan the day with confidence.', 3),

('maternity-photoshoot-guide-when-to-book-and-what-to-wear',
 'Maternity Photoshoot Guide: When to Book and What to Wear',
 'The best time to book your maternity session, what to wear, and how to feel comfortable and confident in front of the camera.',
 $p$<p>A maternity session is a chance to celebrate this chapter and keep it forever. Here is everything you need to know before you book.</p>
<h2>When is the best time to book?</h2>
<p>Most mums-to-be photograph beautifully between <strong>28 and 36 weeks</strong>, when the bump is rounded and you still feel comfortable. Book a few weeks ahead so we can find a date that suits you, and keep a little flexibility in case the baby has other plans.</p>
<h2>What to wear</h2>
<ul><li><strong>Fitted dresses</strong> that show the shape of your bump — stretchy fabrics work best.</li><li><strong>Flowing gowns</strong> for dramatic, movement-filled pictures.</li><li><strong>A simple white shirt and jeans</strong> for relaxed, natural images.</li></ul>
<p>Bring a couple of options and a few accessories. We are happy to help you decide on the day.</p>
<h2>Partner and family</h2>
<p>Our couple package includes your partner, and we can include children for warm family pictures. Tell us who is joining when you book so we can plan the poses.</p>
<h2>How to feel comfortable</h2>
<p>Eat beforehand, wear comfortable underwear and bring water. Take breaks whenever you need one — we work around you, not the other way round.</p>
<h2>What happens after</h2>
<p>You choose your favourites and we deliver the edited pictures in a private online gallery. Frames and photobooks are available if you would like something to hold.</p>
<p>View our <a href="/photography-services/">maternity photography packages</a> or <a href="/contact/">message us</a> with your due date and we will find the perfect slot.</p>$p$,
 '/images/ILU6433.webp', 'Maternity portrait in soft natural light', 'Photography tips', array['maternity','family','guide'], true, now() - interval '9 days',
 'Maternity Photoshoot Guide: When to Book & What to Wear | Illuszionz Media', 'When to book your maternity photoshoot, what to wear and how to feel confident on the day — a practical guide from our London studio.', 3),

('how-to-choose-a-videographer-for-your-event',
 'How to Choose a Videographer for Your Event',
 'Six questions to ask before you hire a videographer for a wedding, party or corporate event — and the red flags to avoid.',
 $p$<p>Video captures what photographs cannot: the sound of the speeches, the music, the movement. Choosing the right videographer makes all the difference to the final film.</p>
<h2>1. Watch full films, not just highlight reels</h2>
<p>A 60-second teaser can hide weak storytelling. Ask to see a complete film from a similar event and pay attention to sound quality and pacing.</p>
<h2>2. Ask what is included</h2>
<ul><li>Hours of coverage and number of cameras</li><li>Drone footage (and whether it is licensed to fly at your venue)</li><li>Edit length and number of revisions</li><li>Delivery time and format</li></ul>
<h2>3. Check audio</h2>
<p>Speeches and vows are priceless. Ask how they record audio — a clip-on microphone at the ceremony and a feed from the venue sound system make a huge difference.</p>
<h2>4. Talk about style</h2>
<p>Cinematic, documentary, fast-paced social cut-downs? Be clear about the look you want so the final film feels like yours.</p>
<h2>5. Understand the pricing</h2>
<p>Video is quoted around your needs: coverage hours, crew size, extras such as live streaming or same-day edits. A good videographer explains the quote clearly and does not hide extra charges.</p>
<h2>6. Trust your instincts</h2>
<p>You will spend a whole day with this person. Choose someone calm, professional and easy to talk to.</p>
<p>See our <a href="/videography-services/">videography services</a> — wedding films, event coverage, drone, live streaming and more — and request a tailored quote.</p>$p$,
 '/images/ILU6448.webp', 'Videographer filming an event', 'Videography', array['videography','events','hiring'], true, now() - interval '4 days',
 'How to Choose a Videographer for Your Event | Illuszionz Media', 'Six questions to ask before hiring a videographer for a wedding or event — what to look for in the work, audio, pricing and style.', 3)
on conflict (slug) do nothing;
