revoke all on function public.seller_order_dashboard() from public, anon;
revoke all on function public.customer_order_fulfillments(uuid[]) from public, anon;
revoke all on function public.update_seller_fulfillment_status(uuid, text) from public, anon;

grant execute on function public.seller_order_dashboard() to authenticated;
grant execute on function public.customer_order_fulfillments(uuid[]) to authenticated;
grant execute on function public.update_seller_fulfillment_status(uuid, text) to authenticated;
