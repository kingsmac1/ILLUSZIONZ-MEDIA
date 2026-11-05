-- Packages added to Photography services (booking_services): their own add-ons, and how many looks a client can ask for.
-- Every look-based booking is priced for one look; the client says how many looks they want and the studio agrees the
-- price for the extra looks on WhatsApp. Only adds things; safe to run again.

-- the most looks a client can choose on this package's booking form (1 = no looks counter)
alter table public.booking_services add column if not exists max_looks integer not null default 5 check (max_looks between 1 and 20);
-- the package's own add-ons: [{ "label": "Gown hire", "note": "per gown", "price": 30, "max": 3 }]; max empty = a tick box
alter table public.booking_services add column if not exists extras jsonb not null default '[]'::jsonb check (jsonb_typeof(extras) = 'array');
-- whether the usual photo add-ons (extra edited pictures, express turnaround …) are offered too
alter table public.booking_services add column if not exists standard_extras boolean not null default true;
