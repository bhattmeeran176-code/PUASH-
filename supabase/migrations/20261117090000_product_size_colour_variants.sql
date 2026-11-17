-- Product options (size, colour, pack size) and option-aware checkout.
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 120),
  sku text,
  price numeric(12,2) check (price is null or price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, label)
);
create index if not exists product_variants_product_idx on public.product_variants(product_id, sort_order, created_at);
alter table public.product_variants enable row level security;
drop policy if exists "Active product variants visible to shoppers" on public.product_variants;
create policy "Active product variants visible to shoppers" on public.product_variants
for select to anon, authenticated using (
  is_active = true and exists (select 1 from public.products p where p.id = product_id and p.is_active = true)
);
drop policy if exists "Admins manage product variants" on public.product_variants;
create policy "Admins manage product variants" on public.product_variants
for all to authenticated using (
  exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
) with check (
  exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
);
alter table public.order_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
alter table public.order_items add column if not exists variant_label text;
create index if not exists order_items_variant_idx on public.order_items(variant_id);

-- Extend the existing secure order RPC without changing its address, coupon or COD flow.
do $$
declare
  v_def text;
  v_old text;
begin
  select pg_get_functiondef('public.place_customer_order(uuid,jsonb,text,text)'::regprocedure) into v_def;
  v_old := v_def;
  v_def := replace(v_def,
    ' v_product public.products%rowtype;' || chr(10) || ' v_product_id uuid;',
    ' v_product public.products%rowtype;' || chr(10) || ' v_variant public.product_variants%rowtype;' || chr(10) || ' v_variant_id uuid;' || chr(10) || ' v_product_id uuid;');
  v_def := replace(v_def,
    'group by (x.item->>''product_id'') having count(*)>1',
    'group by (x.item->>''product_id''), coalesce(x.item->>''variant_id'','''') having count(*)>1');
  v_def := replace(v_def,
    '     v_quantity := (v_item->>''quantity'')::integer;',
    '     v_quantity := (v_item->>''quantity'')::integer;' || chr(10) || '     v_variant_id := nullif(v_item->>''variant_id'','''')::uuid;');
  v_def := replace(v_def,
    '   if v_product.stock_quantity<v_quantity then raise exception ''Not enough stock for %'',v_product.name; end if;' || chr(10) || '   v_subtotal := v_subtotal+(v_product.price*v_quantity);',
    '   if v_variant_id is not null then' || chr(10) ||
    '     select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and is_active=true for update;' || chr(10) ||
    '     if not found then raise exception ''A selected product option is no longer available''; end if;' || chr(10) ||
    '     if v_variant.stock_quantity<v_quantity then raise exception ''Not enough stock for % (%)'',v_product.name,v_variant.label; end if;' || chr(10) ||
    '     v_subtotal := v_subtotal+(coalesce(v_variant.price,v_product.price)*v_quantity);' || chr(10) ||
    '   else' || chr(10) ||
    '     if exists(select 1 from public.product_variants where product_id=v_product_id and is_active=true) then raise exception ''Please select an option for %'',v_product.name; end if;' || chr(10) ||
    '     if v_product.stock_quantity<v_quantity then raise exception ''Not enough stock for %'',v_product.name; end if;' || chr(10) ||
    '     v_subtotal := v_subtotal+(v_product.price*v_quantity);' || chr(10) ||
    '   end if;');
  v_def := replace(v_def,
    '   insert into public.order_items(order_id,product_id,product_name,unit_price,quantity)' || chr(10) ||
    '   values(v_order_id,v_product.id,v_product.name,v_product.price,v_quantity);' || chr(10) ||
    '   update public.products set stock_quantity=stock_quantity-v_quantity,updated_at=now() where id=v_product_id;',
    '   v_variant_id:=nullif(v_item->>''variant_id'','''')::uuid;' || chr(10) ||
    '   if v_variant_id is not null then' || chr(10) ||
    '     select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and is_active=true for update;' || chr(10) ||
    '     if not found or v_variant.stock_quantity<v_quantity then raise exception ''Selected option is unavailable or out of stock''; end if;' || chr(10) ||
    '     insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,variant_id,variant_label)' || chr(10) ||
    '     values(v_order_id,v_product.id,v_product.name || '' · '' || v_variant.label,coalesce(v_variant.price,v_product.price),v_quantity,v_variant.id,v_variant.label);' || chr(10) ||
    '     update public.product_variants set stock_quantity=stock_quantity-v_quantity,updated_at=now() where id=v_variant_id;' || chr(10) ||
    '     update public.products set stock_quantity=greatest(0,stock_quantity-v_quantity),updated_at=now() where id=v_product_id;' || chr(10) ||
    '   else' || chr(10) ||
    '     insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,variant_id,variant_label)' || chr(10) ||
    '     values(v_order_id,v_product.id,v_product.name,v_product.price,v_quantity,null,null);' || chr(10) ||
    '     update public.products set stock_quantity=stock_quantity-v_quantity,updated_at=now() where id=v_product_id;' || chr(10) ||
    '   end if;');
  if v_def = v_old or position('v_variant public.product_variants' in v_def)=0
     or position('v_variant.stock_quantity<v_quantity' in v_def)=0
     or position('variant_label' in v_def)=0 then
    raise exception 'Checkout function transformation did not apply completely; original function retained';
  end if;
  execute v_def;
end $$;
