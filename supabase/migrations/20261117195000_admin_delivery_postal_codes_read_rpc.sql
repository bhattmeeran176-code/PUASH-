create or replace function public.get_delivery_zone_postal_codes()
returns table(zone_id uuid, postal_code text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select d.zone_id, d.postal_code
  from public.delivery_zone_postal_codes d
  order by d.zone_id, d.postal_code;
end;
$$;

revoke all on function public.get_delivery_zone_postal_codes() from public, anon;
grant execute on function public.get_delivery_zone_postal_codes() to authenticated;