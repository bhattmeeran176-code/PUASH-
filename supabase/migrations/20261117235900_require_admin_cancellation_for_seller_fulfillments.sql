create or replace function public.update_seller_fulfillment_status(p_fulfillment_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_status not in ('confirmed','processing','shipped') then
    raise exception 'Invalid seller order status. Cancellation and delivery confirmation require PUASH admin review.';
  end if;

  update public.seller_fulfillments sf
     set status = p_status,
         updated_at = now()
   where sf.id = p_fulfillment_id
     and exists (
       select 1 from public.seller_applications sa
        where sa.id = sf.seller_application_id
          and sa.user_id = auth.uid()
          and sa.status = 'approved'
     )
     and (
       (sf.status = 'pending' and p_status = 'confirmed')
       or (sf.status = 'confirmed' and p_status = 'processing')
       or (sf.status = 'processing' and p_status = 'shipped')
     );

  if not found then
    raise exception 'Order not found, access denied, or invalid fulfilment status transition';
  end if;
  return true;
end;
$function$;
