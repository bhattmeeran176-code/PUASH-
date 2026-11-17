-- Delivery PIN allowlists are accessed only through the validated SECURITY DEFINER admin RPC.
-- Keep the table inaccessible through direct PostgREST table operations.
revoke all on table public.delivery_zone_postal_codes from anon, authenticated;
