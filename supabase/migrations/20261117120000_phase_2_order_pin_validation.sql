-- PUASH Phase 2: enforce a valid six-digit PIN on every newly created order.
-- A trigger is used so all order creation paths receive the same server-side check.
create or replace function public.validate_order_shipping_pin()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_postal_code text;
begin
  v_postal_code := coalesce(new.shipping_address ->> 'postal_code', '');
  if v_postal_code !~ '^[0-9]{6}$' then
    raise exception 'Please update your saved address with a valid 6-digit PIN code';
  end if;
  return new;
end;
$function$;

drop trigger if exists validate_order_shipping_pin_before_insert on public.orders;
create trigger validate_order_shipping_pin_before_insert
before insert on public.orders
for each row execute function public.validate_order_shipping_pin();

revoke all on function public.validate_order_shipping_pin() from public, anon, authenticated;
