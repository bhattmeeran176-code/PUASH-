create table if not exists public.order_cancellation_requests (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check (char_length(trim(reason)) between 3 and 80),
 details text,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 admin_note text,
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 constraint order_cancellation_requests_one_pending unique (order_id)
);
alter table public.order_cancellation_requests enable row level security;
revoke all on public.order_cancellation_requests from anon, public;
grant select,insert on public.order_cancellation_requests to authenticated;
drop policy if exists customer_read_own_cancellation_requests on public.order_cancellation_requests;
create policy customer_read_own_cancellation_requests on public.order_cancellation_requests for select to authenticated using (user_id=auth.uid());
drop policy if exists customer_create_own_cancellation_requests on public.order_cancellation_requests;
create policy customer_create_own_cancellation_requests on public.order_cancellation_requests for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid() and o.status in ('pending','confirmed','processing')));
drop policy if exists admin_read_cancellation_requests on public.order_cancellation_requests;
create policy admin_read_cancellation_requests on public.order_cancellation_requests for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create or replace function public.admin_review_order_cancellation(p_request_id uuid,p_decision text,p_admin_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_request public.order_cancellation_requests%rowtype; v_order public.orders%rowtype;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception 'Admin access required'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
 select * into v_request from public.order_cancellation_requests where id=p_request_id for update;
 if not found or v_request.status<>'pending' then raise exception 'Cancellation request is no longer pending'; end if;
 select * into v_order from public.orders where id=v_request.order_id for update;
 if p_decision='approved' then
  if v_order.status not in ('pending','confirmed','processing') then raise exception 'This order can no longer be cancelled'; end if;
  update public.orders set status='cancelled',updated_at=now() where id=v_order.id;
 end if;
 update public.order_cancellation_requests set status=p_decision,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),reviewed_at=now(),reviewed_by=auth.uid() where id=p_request_id;
end; $$;
revoke all on function public.admin_review_order_cancellation(uuid,text,text) from public,anon;
grant execute on function public.admin_review_order_cancellation(uuid,text,text) to authenticated;