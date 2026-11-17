-- Enforce the return/refund workflow at the database boundary.
-- UI already offers these steps; this prevents direct API updates from skipping them.
create or replace function public.guard_order_return_request_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    return new;
  elsif old.status = 'approved' and new.status = 'item_received' then
    return new;
  elsif old.status = 'item_received' and new.status = 'refunded' then
    return new;
  elsif old.status in ('rejected', 'refunded') then
    raise exception 'This return request is closed and its status cannot be changed';
  end if;

  raise exception 'Invalid return request status transition: % to %', old.status, new.status;
end;
$function$;

drop trigger if exists guard_order_return_request_status_before_update on public.order_return_requests;
create trigger guard_order_return_request_status_before_update
before update of status on public.order_return_requests
for each row execute function public.guard_order_return_request_status();
