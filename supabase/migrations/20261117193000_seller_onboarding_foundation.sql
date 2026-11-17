create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_name text not null check (char_length(trim(shop_name)) between 2 and 120),
  contact_name text not null check (char_length(trim(contact_name)) between 2 and 120),
  phone text not null check (char_length(trim(phone)) between 7 and 20),
  category text not null check (char_length(trim(category)) between 2 and 80),
  pickup_address text not null check (char_length(trim(pickup_address)) between 8 and 300),
  city text not null check (char_length(trim(city)) between 2 and 100),
  district text not null check (char_length(trim(district)) between 2 and 100),
  postal_code text not null check (postal_code ~ '^[0-9]{6}$'),
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists seller_applications_status_created_idx
  on public.seller_applications(status, created_at desc);
alter table public.seller_applications enable row level security;
grant select, insert, update on public.seller_applications to authenticated;

drop policy if exists "Applicants can read their own application" on public.seller_applications;
create policy "Applicants can read their own application"
  on public.seller_applications for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Applicants can submit their own application" on public.seller_applications;
create policy "Applicants can submit their own application"
  on public.seller_applications for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending'
    and admin_note is null and reviewed_at is null and reviewed_by is null);

drop policy if exists "Applicants can edit pending applications" on public.seller_applications;
create policy "Applicants can edit pending applications"
  on public.seller_applications for update to authenticated
  using ((select auth.uid()) = user_id and status = 'pending')
  with check ((select auth.uid()) = user_id and status = 'pending'
    and admin_note is null and reviewed_at is null and reviewed_by is null);

drop policy if exists "Admins manage seller applications" on public.seller_applications;
create policy "Admins manage seller applications"
  on public.seller_applications for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
