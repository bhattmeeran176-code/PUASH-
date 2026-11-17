create or replace function public.enforce_order_pin_serviceability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_zone public.delivery_zones%rowtype;
  v_pin text;
  v_district text;
  v_pin_count integer;
begin
  v_pin := trim(coalesce(new.shipping_address->>'postal_code', ''));
  v_district := trim(coalesce(new.shipping_address->>'district', ''));

  if v_pin !~ '^[0-9]{6}$' then
    raise exception 'A valid 6-digit delivery PIN code is required';
  end if;

  select *
    into v_zone
    from public.delivery_zones
   where lower(district) = lower(v_district);

  if not found or not v_zone.is_serviceable then
    raise exception 'Delivery is not available for this district';
  end if;

  select count(*)
    into v_pin_count
    from public.delivery_zone_postal_codes
   where zone_id = v_zone.id;

  if v_pin_count > 0 and not exists (
    select 1
      from public.delivery_zone_postal_codes
     where zone_id = v_zone.id
       and postal_code = v_pin
  ) then
    raise exception 'Delivery is not available for this PIN code';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_order_pin_serviceability on public.orders;

create trigger enforce_order_pin_serviceability
before insert on public.orders
for each row
execute function public.enforce_order_pin_serviceability();

revoke all on function public.enforce_order_pin_serviceability() from public, anon, authenticated;
