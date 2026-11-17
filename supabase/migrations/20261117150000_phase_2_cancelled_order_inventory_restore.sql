-- Restore inventory exactly once when an order is cancelled before dispatch.
alter table public.orders
  add column if not exists inventory_restored_at timestamptz;

create or replace function public.guard_order_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened; create a new order instead';
  end if;

  if new.status = 'cancelled'
     and old.status <> 'cancelled'
     and old.status not in ('pending', 'confirmed', 'processing') then
    raise exception 'Only pending, confirmed or processing orders can be cancelled';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_order_cancellation() from public, anon, authenticated;

drop trigger if exists guard_order_cancellation_before_update on public.orders;
create trigger guard_order_cancellation_before_update
before update of status on public.orders
for each row
execute function public.guard_order_cancellation();

create or replace function public.restore_cancelled_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'cancelled'
     and new.status = 'cancelled'
     and new.inventory_restored_at is null then

    -- Restore base product stock for every line.
    update public.products p
       set stock_quantity = p.stock_quantity + restored.quantity,
           updated_at = now()
      from (
        select oi.product_id, sum(oi.quantity)::integer as quantity
          from public.order_items oi
         where oi.order_id = new.id
         group by oi.product_id
      ) restored
     where p.id = restored.product_id;

    -- Restore the exact option stock where the option still exists.
    update public.product_variants v
       set stock_quantity = v.stock_quantity + restored.quantity,
           updated_at = now()
      from (
        select oi.variant_id, sum(oi.quantity)::integer as quantity
          from public.order_items oi
         where oi.order_id = new.id
           and oi.variant_id is not null
         group by oi.variant_id
      ) restored
     where v.id = restored.variant_id;

    update public.orders
       set inventory_restored_at = now()
     where id = new.id
       and inventory_restored_at is null;
  end if;

  return new;
end;
$$;

revoke all on function public.restore_cancelled_order_inventory() from public, anon, authenticated;

drop trigger if exists restore_cancelled_order_inventory_after_update on public.orders;
create trigger restore_cancelled_order_inventory_after_update
after update of status on public.orders
for each row
execute function public.restore_cancelled_order_inventory();
