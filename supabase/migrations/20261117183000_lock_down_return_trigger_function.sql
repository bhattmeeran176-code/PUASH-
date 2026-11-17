-- Trigger-only function: it must not be callable through the exposed PostgREST RPC surface.
-- Trigger execution does not require client roles to have EXECUTE permission.
alter function public.guard_order_return_request_status() security invoker;
revoke all on function public.guard_order_return_request_status() from public, anon, authenticated;
