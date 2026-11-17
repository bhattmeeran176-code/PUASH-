-- The legacy BEFORE trigger restored base product stock only.
-- The newer AFTER trigger restores both product and selected-variant stock,
-- guarded by inventory_restored_at. Keeping both would double-restock products.
drop trigger if exists puash_order_status_stock on public.orders;
