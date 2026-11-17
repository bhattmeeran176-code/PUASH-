create table if not exists public.seller_fulfillment_refunds (
 id uuid primary key default gen_random_uuid(),
 fulfillment_id uuid not null unique references public.seller_fulfillments(id) on delete restrict,
 order_id uuid not null references public.orders(id) on delete restrict,
 seller_application_id uuid not null references public.seller_applications(id) on delete restrict,
 customer_id uuid not null,
 payment_method text not null,
 refund_amount numeric(12,2),
 status text not null check(status in ('not_required','review_required','processing','completed','rejected')),
 payment_reference text,
 admin_note text,
 processed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint refund_amount_nonnegative check(refund_amount is null or refund_amount >= 0),
 constraint refund_completed_reference check(status <> 'completed' or (payment_reference is not null and length(trim(payment_reference)) > 0))
);
alter table public.seller_fulfillment_refunds enable row level security;
revoke all on public.seller_fulfillment_refunds from anon, authenticated;
create policy seller_fulfillment_refunds_admin_select on public.seller_fulfillment_refunds for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy seller_fulfillment_refunds_admin_update on public.seller_fulfillment_refunds for update to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create or replace function public.admin_cancel_seller_fulfillment(p_fulfillment_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare v_fulfillment public.seller_fulfillments%rowtype; v_customer uuid; v_method text;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception 'Admin access required'; end if;
 select * into v_fulfillment from public.seller_fulfillments where id=p_fulfillment_id for update;
 if not found then raise exception 'Seller fulfilment not found'; end if;
 if v_fulfillment.status='cancelled' then return true; end if;
 if v_fulfillment.status not in ('pending','confirmed','processing') then raise exception 'Only pending, confirmed or processing fulfilments can be cancelled'; end if;
 if exists(select 1 from public.seller_settlements s where s.fulfillment_id=p_fulfillment_id) then raise exception 'A settlement already exists; review settlement before cancellation'; end if;
 if v_fulfillment.inventory_restored_at is null then
  update public.products p set stock_quantity=p.stock_quantity+x.qty,updated_at=now() from (select oi.product_id,sum(oi.quantity)::integer qty from public.order_items oi join public.products p2 on p2.id=oi.product_id where oi.order_id=v_fulfillment.order_id and p2.seller_application_id=v_fulfillment.seller_application_id group by oi.product_id) x where p.id=x.product_id;
  update public.product_variants v set stock_quantity=v.stock_quantity+x.qty,updated_at=now() from (select oi.variant_id,sum(oi.quantity)::integer qty from public.order_items oi join public.products p2 on p2.id=oi.product_id where oi.order_id=v_fulfillment.order_id and p2.seller_application_id=v_fulfillment.seller_application_id and oi.variant_id is not null group by oi.variant_id) x where v.id=x.variant_id;
 end if;
 select o.user_id,o.payment_method into v_customer,v_method from public.orders o where o.id=v_fulfillment.order_id;
 update public.seller_fulfillments set status='cancelled',inventory_restored_at=coalesce(inventory_restored_at,now()),updated_at=now() where id=p_fulfillment_id;
 insert into public.seller_fulfillment_refunds(fulfillment_id,order_id,seller_application_id,customer_id,payment_method,status,admin_note) values(p_fulfillment_id,v_fulfillment.order_id,v_fulfillment.seller_application_id,v_customer,coalesce(v_method,'unknown'),case when lower(coalesce(v_method,'')) in ('cash_on_delivery','cod') then 'not_required' else 'review_required' end,case when lower(coalesce(v_method,'')) in ('cash_on_delivery','cod') then 'COD order: payment collection not confirmed; no refund initiated.' else 'Review actual payment capture and calculate eligible refund before processing.' end) on conflict(fulfillment_id) do nothing;
 return true;
end; $$;
revoke all on function public.admin_cancel_seller_fulfillment(uuid) from public,anon;
grant execute on function public.admin_cancel_seller_fulfillment(uuid) to authenticated;
create or replace function public.admin_update_seller_fulfillment_refund(p_refund_id uuid,p_status text,p_refund_amount numeric default null,p_payment_reference text default null,p_admin_note text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception 'Admin access required'; end if;
 if p_status not in ('review_required','processing','completed','rejected','not_required') then raise exception 'Invalid refund status'; end if;
 if p_refund_amount is not null and p_refund_amount<0 then raise exception 'Refund amount cannot be negative'; end if;
 if p_status='completed' and (p_refund_amount is null or coalesce(trim(p_payment_reference),'')='') then raise exception 'Completed refund requires amount and payment reference'; end if;
 update public.seller_fulfillment_refunds set status=p_status,refund_amount=p_refund_amount,payment_reference=nullif(trim(p_payment_reference),''),admin_note=nullif(trim(p_admin_note),''),processed_at=case when p_status='completed' then now() else null end,updated_at=now() where id=p_refund_id;
 if not found then raise exception 'Refund record not found'; end if; return true;
end; $$;
revoke all on function public.admin_update_seller_fulfillment_refund(uuid,text,numeric,text,text) from public,anon;
grant execute on function public.admin_update_seller_fulfillment_refund(uuid,text,numeric,text,text) to authenticated;