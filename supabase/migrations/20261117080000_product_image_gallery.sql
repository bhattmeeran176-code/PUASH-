create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  storage_path text,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_sort_idx
  on public.product_images(product_id, sort_order, created_at);
alter table public.product_images enable row level security;
drop policy if exists "Product images are visible for storefront" on public.product_images;
create policy "Product images are visible for storefront" on public.product_images
for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and p.is_active = true)
  or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
);
drop policy if exists "Admins manage product images" on public.product_images;
create policy "Admins manage product images" on public.product_images
for all to authenticated using (
  exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
) with check (
  exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
);
