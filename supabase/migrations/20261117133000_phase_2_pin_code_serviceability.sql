create table if not exists public.delivery_zone_postal_codes (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.delivery_zones(id) on delete cascade,
  postal_code text not null check (postal_code ~ '^[0-9]{6}$'),
  created_at timestamptz not null default now(),
  unique (zone_id, postal_code)
);
alter table public.delivery_zone_postal_codes enable row level security;
drop policy if exists "Admins manage delivery zone postal codes" on public.delivery_zone_postal_codes;
create policy "Admins manage delivery zone postal codes"
on public.delivery_zone_postal_codes for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
revoke all on public.delivery_zone_postal_codes from anon, public;
grant select, insert, update, delete on public.delivery_zone_postal_codes to authenticated;

create or replace function public.set_delivery_zone_postal_codes(p_zone_id uuid, p_postal_codes text[])
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_code text; v_codes text[] := coalesce(p_postal_codes, array[]::text[]);
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
    raise exception 'Admin access required';
  end if;
  if not exists (select 1 from public.delivery_zones z where z.id=p_zone_id) then raise exception 'Delivery zone not found'; end if;
  if cardinality(v_codes) > 1000 then raise exception 'Maximum 1000 PIN codes per district'; end if;
  foreach v_code in array v_codes loop
    if v_code !~ '^[0-9]{6}$' then raise exception 'Every PIN code must contain exactly 6 digits'; end if;
  end loop;
  delete from public.delivery_zone_postal_codes where zone_id=p_zone_id;
  insert into public.delivery_zone_postal_codes(zone_id,postal_code)
  select p_zone_id, x from (select distinct unnest(v_codes) as x) codes;
  return jsonb_build_object('saved',true,'count',(select count(*) from public.delivery_zone_postal_codes where zone_id=p_zone_id));
end;
$$;
revoke all on function public.set_delivery_zone_postal_codes(uuid,text[]) from public, anon;
grant execute on function public.set_delivery_zone_postal_codes(uuid,text[]) to authenticated;

create or replace function public.get_delivery_quote(p_address_id uuid, p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_address public.customer_addresses%rowtype; v_zone public.delivery_zones%rowtype; v_pin text; v_count integer; v_fee numeric;
begin
  if auth.uid() is null then raise exception 'Please sign in to check delivery'; end if;
  select * into v_address from public.customer_addresses where id=p_address_id and user_id=auth.uid();
  if not found then raise exception 'Please choose one of your saved delivery addresses'; end if;
  v_pin := trim(coalesce(v_address.postal_code,''));
  if v_pin !~ '^[0-9]{6}$' then return jsonb_build_object('serviceable',false,'reason','Please update this address with a valid 6-digit PIN code'); end if;
  select * into v_zone from public.delivery_zones where lower(district)=lower(trim(coalesce(v_address.district,'')));
  if not found or not v_zone.is_serviceable then return jsonb_build_object('serviceable',false,'reason','Delivery is not available for this district yet'); end if;
  select count(*) into v_count from public.delivery_zone_postal_codes where zone_id=v_zone.id;
  if v_count > 0 and not exists (select 1 from public.delivery_zone_postal_codes where zone_id=v_zone.id and postal_code=v_pin) then
    return jsonb_build_object('serviceable',false,'reason','Delivery is not available for this PIN code yet','district',v_zone.district);
  end if;
  v_fee := case when coalesce(p_subtotal,0)>=v_zone.free_delivery_threshold then 0 else v_zone.delivery_fee end;
  return jsonb_build_object('serviceable',true,'district',v_zone.district,'delivery_fee',v_fee,'min_delivery_days',v_zone.min_delivery_days,'max_delivery_days',v_zone.max_delivery_days,'free_delivery_threshold',v_zone.free_delivery_threshold);
end;
$$;
revoke all on function public.get_delivery_quote(uuid,numeric) from public, anon;
grant execute on function public.get_delivery_quote(uuid,numeric) to authenticated;

create or replace function public.enforce_order_delivery_pin_allowlist()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_zone_id uuid; v_count integer; v_pin text := trim(coalesce(new.shipping_address->>'postal_code',''));
begin
  if v_pin !~ '^[0-9]{6}$' then raise exception 'Please update your saved address with a valid 6-digit PIN code'; end if;
  select id into v_zone_id from public.delivery_zones where lower(district)=lower(trim(coalesce(new.delivery_district,''))) and is_serviceable=true;
  if v_zone_id is null then raise exception 'Delivery is not available for this district yet'; end if;
  select count(*) into v_count from public.delivery_zone_postal_codes where zone_id=v_zone_id;
  if v_count > 0 and not exists (select 1 from public.delivery_zone_postal_codes where zone_id=v_zone_id and postal_code=v_pin) then
    raise exception 'Delivery is not available for this PIN code yet';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_order_delivery_pin_allowlist() from public, anon, authenticated;
drop trigger if exists enforce_order_delivery_pin_allowlist_before_insert on public.orders;
create trigger enforce_order_delivery_pin_allowlist_before_insert
before insert on public.orders
for each row execute function public.enforce_order_delivery_pin_allowlist();
