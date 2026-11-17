revoke all on function public.place_customer_order(uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.place_customer_order(uuid, jsonb, text, text, uuid) from public, anon;
grant execute on function public.place_customer_order(uuid, jsonb, text, text, uuid) to authenticated;
