-- Enforce a sequential order lifecycle at the database boundary.
-- Cancellation remains available only before dispatch; terminal states cannot be reopened.
create or replace function public.guard_order_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('confirmed', 'cancelled') then
    return new;
  elsif old.status = 'confirmed' and new.status in ('processing', 'cancelled') then
    return new;
  elsif old.status = 'processing' and new.status in ('shipped', 'cancelled') then
    return new;
  elsif old.status = 'shipped' and new.status = 'delivered' then
    return new;
  elsif old.status in ('delivered', 'cancelled') then
    raise exception 'This order is closed and its status cannot be changed';
  end if;

  raise exception 'Invalid order status transition: % to %', old.status, new.status;
end;
$function$;
