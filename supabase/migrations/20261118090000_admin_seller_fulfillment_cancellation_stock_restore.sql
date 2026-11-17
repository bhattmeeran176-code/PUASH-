alter table public.seller_fulfillments
  add column if not exists inventory_restored_at timestamptz;

create or replace function public.admin_cancel_seller_fulfillment(p_fulfillment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fulfillment public.seller_fulfillments%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Admin access required';
  end if;

  select * into v_fulfillment
  from public.seller_fulfillments
  where id = p_fulfillment_id
  for update;

  if not found then raise exception 'Seller fulfilment not found'; end if;
  if v_fulfillment.status = 'cancelled' then return true; end if;
  if v_fulfillment.status not in ('pending','confirmed','processing') then
    raise exception 'Only pending, confirmed or processing fulfilments can be cancelled';
  end if;
  if exists (select 1 from public.seller_settlements s where s.fulfillment_id = p_fulfillment_id) then
    raise exception 'A settlement already exists; review settlement before cancellation';
  end if;

  if v_fulfillment.inventory_restored_at is null then
    update public.products p
       set stock_quantity = p.stock_quantity + x.qty,
           updated_at = now()
      from (
        select oi.product_id, sum(oi.quantity)::integer qty
        from public.order_items oi
        join public.products p2 on p2.id = oi.product_id
        where oi.order_id = v_fulfillment.order_id
          and p2.seller_application_id = v_fulfillment.seller_application_id
        group by oi.product_id
      ) x
     where p.id = x.product_id;

    update public.product_variants v
       set stock_quantity = v.stock_quantity + x.qty,
           updated_at = now()
      from (
        select oi.variant_id, sum(oi.quantity)::integer qty
        from public.order_items oi
        join public.products p2 on p2.id = oi.product_id
        where oi.order_id = v_fulfillment.order_id
          and p2.seller_application_id = v_fulfillment.seller_application_id
          and oi.variant_id is not null
        group by oi.variant_id
      ) x
     where v.id = x.variant_id;
  end if;

  update public.seller_fulfillments
     set status = 'cancelled',
         inventory_restored_at = coalesce(inventory_restored_at, now()),
         updated_at = now()
   where id = p_fulfillment_id;
  return true;
end;
$$;

revoke all on function public.admin_cancel_seller_fulfillment(uuid) from public, anon;
grant execute on function public.admin_cancel_seller_fulfillment(uuid) to authenticated;