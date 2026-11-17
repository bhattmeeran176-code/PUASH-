-- PUASH Phase 2 district delivery zones.
-- The matching database migration was applied to the connected Supabase project.
alter table public.customer_addresses add column if not exists district text;
alter table public.orders add column if not exists delivery_district text;
alter table public.orders add column if not exists estimated_delivery_days integer;

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  district text not null unique,
  is_serviceable boolean not null default true,
  delivery_fee numeric(10,2) not null default 49 check (delivery_fee >= 0),
  free_delivery_threshold numeric(10,2) not null default 999 check (free_delivery_threshold >= 0),
  min_delivery_days integer not null default 3 check (min_delivery_days >= 0),
  max_delivery_days integer not null default 7 check (max_delivery_days >= min_delivery_days),
  updated_at timestamptz not null default now()
);
alter table public.delivery_zones enable row level security;
drop policy if exists "Anyone can view serviceable delivery zones" on public.delivery_zones;
create policy "Anyone can view serviceable delivery zones" on public.delivery_zones
  for select to anon, authenticated using (is_serviceable = true);
drop policy if exists "Admins manage delivery zones" on public.delivery_zones;
create policy "Admins manage delivery zones" on public.delivery_zones
  for all to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

insert into public.delivery_zones (district,is_serviceable,delivery_fee,free_delivery_threshold,min_delivery_days,max_delivery_days) values
('Anantnag',true,49,999,3,7),('Bandipora',true,59,999,4,8),('Baramulla',true,49,999,3,7),
('Budgam',true,49,999,3,7),('Doda',true,69,1299,5,9),('Ganderbal',true,49,999,3,7),
('Jammu',true,39,999,2,5),('Kathua',true,49,999,3,6),('Kishtwar',true,79,1299,6,10),
('Kulgam',true,59,999,4,8),('Kupwara',true,69,999,4,9),('Poonch',true,79,1299,6,10),
('Pulwama',true,49,999,3,7),('Rajouri',true,69,1299,5,9),('Ramban',true,69,1299,5,9),
('Reasi',true,69,1299,5,9),('Samba',true,49,999,3,6),('Shopian',true,59,999,4,8),
('Srinagar',true,39,999,2,5),('Udhampur',true,59,999,4,7)
on conflict (district) do nothing;

-- place_customer_order(uuid,jsonb,text,text) was replaced in the same deployment.
-- It reads the selected address district, rejects non-serviceable districts,
-- computes delivery_fee on the server, and snapshots delivery district and
-- max_delivery_days on the order. Execute the deployed function definition
-- from the Phase 2 deployment when recreating this environment.
