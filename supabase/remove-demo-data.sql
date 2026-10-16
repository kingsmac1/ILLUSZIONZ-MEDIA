-- Removes everything created by supabase/demo-data.sql. Run this BEFORE going live.
-- Real data is untouched: demo rows are recognised by the demo.illuszionz.test address domain and the "[DEMO]" markers.
delete from public.email_log where to_email like '%@demo.illuszionz.test' or campaign_id in (select id from public.email_campaigns where name like '[DEMO]%');
delete from public.email_campaigns where name like '[DEMO]%';
delete from public.email_sections where name like '[DEMO]%';
delete from public.segments where name like '[DEMO]%';
delete from public.promo_codes where description like '[DEMO]%';
delete from public.expenses where note like '[DEMO]%';
delete from public.other_income where note like '[DEMO]%';
delete from public.submissions where email like '%@demo.illuszionz.test';
delete from public.bookings where email like '%@demo.illuszionz.test';      -- cascades payments; deals keep going until the contact is removed
delete from public.contacts where email like '%@demo.illuszionz.test';      -- cascades deals, activities, tasks
delete from public.tasks where contact_id is null and title like '%DEMO%';
delete from public.companies where notes like '[DEMO]%';
