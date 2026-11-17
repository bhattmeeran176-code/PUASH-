create or replace function public.customer_order_refund_statuses(p_order_ids uuid[])
returns table(order_id uuid,shop_name text,status text,refund_amount numeric,created_at timestamptz,processed_at timestamptz)
language sql
security definer
set search_path=''
as $$
  select r.order_id,sa.shop_name,r.status,r.refund_amount,r.created_at,r.processed_at
  from public.seller_fulfillment_refunds r
  join public.orders o on o.id=r.order_id
  join public.seller_applications sa on sa.id=r.seller_application_id
  where o.user_id=auth.uid()
    and r.customer_id=auth.uid()
    and r.order_id = any(coalesce(p_order_ids,'{}'::uuid[]))
  order by r.created_at desc;
$$;
revoke all on function public.customer_order_refund_statuses(uuid[]) from public,anon;
grant execute on function public.customer_order_refund_statuses(uuid[]) to authenticated;