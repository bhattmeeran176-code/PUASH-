create or replace function public.update_seller_fulfillment_status(p_fulfillment_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_status not in ('confirmed','processing','shipped','cancelled') then
    raise exception 'Invalid seller order status. Delivery must be confirmed by PUASH admin.';
  end if;

  update public.seller_fulfillments sf
     set status = p_status,
         updated_at = now()
   where sf.id = p_fulfillment_id
     and exists (
       select 1
         from public.seller_applications sa
        where sa.id = sf.seller_application_id
          and sa.user_id = auth.uid()
          and sa.status = 'approved'
     )
     and (
       (sf.status = 'pending' and p_status in ('confirmed','cancelled'))
       or (sf.status = 'confirmed' and p_status in ('processing','cancelled'))
       or (sf.status = 'processing' and p_status in ('shipped','cancelled'))
     );

  if not found then
    raise exception 'Order not found, access denied, or invalid fulfilment status transition';
  end if;

  return true;
end;
$function$;
