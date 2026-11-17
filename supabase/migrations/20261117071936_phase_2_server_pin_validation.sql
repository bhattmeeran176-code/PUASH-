-- Server-side 6-digit PIN validation for district-based checkout.
-- Preserves variant stock, coupon, COD and server-calculated delivery logic.
CREATE OR REPLACE FUNCTION public.place_customer_order(p_address_id uuid, p_items jsonb, p_customer_note text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user_id uuid := auth.uid();
 v_address public.customer_addresses%rowtype;
 v_zone public.delivery_zones%rowtype;
 v_item jsonb;
 v_product public.products%rowtype;
 v_variant public.product_variants%rowtype;
 v_variant_id uuid;
 v_product_id uuid;
 v_quantity integer;
 v_subtotal numeric(12,2) := 0;
 v_delivery numeric(12,2) := 0;
 v_discount numeric(12,2) := 0;
 v_total numeric(12,2) := 0;
 v_order_id uuid;
 v_coupon public.coupons%rowtype;
begin
 if v_user_id is null then raise exception 'Please sign in before placing an order'; end if;
 if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Your cart is empty'; end if;
 if jsonb_array_length(p_items)>30 then raise exception 'Too many different products in one order'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) as x(item) group by (x.item->>'product_id'), coalesce(x.item->>'variant_id','') having count(*)>1) then raise exception 'Duplicate cart items are not allowed'; end if;
 select * into v_address from public.customer_addresses where id=p_address_id and user_id=v_user_id;
 if not found then raise exception 'Please choose one of your saved delivery addresses'; end if;
 select * into v_zone from public.delivery_zones where lower(district)=lower(trim(coalesce(v_address.district,'')));
 if not found or not v_zone.is_serviceable then raise exception 'Delivery is not available for this district yet'; end if;
 if coalesce(trim(v_address.postal_code),'') !~ '^[0-9]{6}$' then raise exception 'Please update your saved address with a valid 6-digit PIN code'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
   begin
     v_product_id := (v_item->>'product_id')::uuid;
     v_quantity := (v_item->>'quantity')::integer;
     v_variant_id := nullif(v_item->>'variant_id','')::uuid;
   exception when others then raise exception 'Invalid cart item'; end;
   if v_quantity is null or v_quantity<1 or v_quantity>20 then raise exception 'Each product quantity must be between 1 and 20'; end if;
   select * into v_product from public.products where id=v_product_id and is_active=true for update;
   if not found then raise exception 'A product in your cart is no longer available'; end if;
   if v_variant_id is not null then
     select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and is_active=true for update;
     if not found then raise exception 'A selected product option is no longer available'; end if;
     if v_variant.stock_quantity<v_quantity then raise exception 'Not enough stock for % (%)',v_product.name,v_variant.label; end if;
     v_subtotal := v_subtotal+(coalesce(v_variant.price,v_product.price)*v_quantity);
   else
     if exists(select 1 from public.product_variants where product_id=v_product_id and is_active=true) then raise exception 'Please select an option for %',v_product.name; end if;
     if v_product.stock_quantity<v_quantity then raise exception 'Not enough stock for %',v_product.name; end if;
     v_subtotal := v_subtotal+(v_product.price*v_quantity);
   end if;
 end loop;
 v_delivery := case when v_subtotal>=v_zone.free_delivery_threshold then 0 else v_zone.delivery_fee end;
 if nullif(trim(coalesce(p_coupon_code,'')),'') is not null then
   select * into v_coupon from public.coupons where code=upper(trim(p_coupon_code)) and is_active=true for update;
   if not found then raise exception 'Coupon code is invalid or inactive'; end if;
   if v_coupon.starts_at is not null and now()<v_coupon.starts_at then raise exception 'This coupon is not active yet'; end if;
   if v_coupon.expires_at is not null and now()>v_coupon.expires_at then raise exception 'This coupon has expired'; end if;
   if v_subtotal<v_coupon.min_order_amount then raise exception 'Minimum order amount for this coupon is Ã¢ÂÂ¹%',v_coupon.min_order_amount; end if;
   if v_coupon.usage_limit is not null and v_coupon.usage_count>=v_coupon.usage_limit then raise exception 'This coupon usage limit has been reached'; end if;
   if (select count(*) from public.coupon_redemptions where coupon_id=v_coupon.id and user_id=v_user_id)>=v_coupon.per_user_limit then raise exception 'You have already used this coupon the maximum number of times'; end if;
   if v_coupon.discount_type='percentage' then
     if v_coupon.discount_value>100 then raise exception 'Coupon configuration is invalid'; end if;
     v_discount:=round(v_subtotal*v_coupon.discount_value/100,2);
   else v_discount:=least(v_coupon.discount_value,v_subtotal); end if;
   if v_coupon.max_discount is not null then v_discount:=least(v_discount,v_coupon.max_discount); end if;
   v_discount:=least(v_discount,v_subtotal);
 end if;
 v_total:=greatest(0,v_subtotal+v_delivery-v_discount);
 insert into public.orders(user_id,status,total_amount,subtotal_amount,delivery_fee,payment_method,shipping_address,customer_note,coupon_id,coupon_code,discount_amount,delivery_district,estimated_delivery_days)
 values(v_user_id,'pending',v_total,v_subtotal,v_delivery,'cash_on_delivery',
 jsonb_build_object('label',v_address.label,'full_name',v_address.full_name,'phone',v_address.phone,'line1',v_address.line1,'line2',v_address.line2,'city',v_address.city,'district',v_address.district,'state',v_address.state,'postal_code',v_address.postal_code,'country',v_address.country),
 nullif(left(coalesce(p_customer_note,''),500),''),v_coupon.id,v_coupon.code,v_discount,v_zone.district,v_zone.max_delivery_days)
 returning id into v_order_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_product_id:=(v_item->>'product_id')::uuid;
   v_quantity:=(v_item->>'quantity')::integer;
   select * into v_product from public.products where id=v_product_id for update;
   v_variant_id:=nullif(v_item->>'variant_id','')::uuid;
   if v_variant_id is not null then
     select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and is_active=true for update;
     if not found or v_variant.stock_quantity<v_quantity then raise exception 'Selected option is unavailable or out of stock'; end if;
     insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,variant_id,variant_label)
     values(v_order_id,v_product.id,v_product.name || ' ÃÂ· ' || v_variant.label,coalesce(v_variant.price,v_product.price),v_quantity,v_variant.id,v_variant.label);
     update public.product_variants set stock_quantity=stock_quantity-v_quantity,updated_at=now() where id=v_variant_id;
     update public.products set stock_quantity=greatest(0,stock_quantity-v_quantity),updated_at=now() where id=v_product_id;
   else
     insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,variant_id,variant_label)
     values(v_order_id,v_product.id,v_product.name,v_product.price,v_quantity,null,null);
     update public.products set stock_quantity=stock_quantity-v_quantity,updated_at=now() where id=v_product_id;
   end if;
 end loop;
 if v_coupon.id is not null then
   insert into public.coupon_redemptions(coupon_id,order_id,user_id,discount_amount) values(v_coupon.id,v_order_id,v_user_id,v_discount);
   update public.coupons set usage_count=usage_count+1,updated_at=now() where id=v_coupon.id;
 end if;
 return jsonb_build_object('order_id',v_order_id,'status','pending','subtotal',v_subtotal,'delivery_fee',v_delivery,'discount_amount',v_discount,'coupon_code',v_coupon.code,'total',v_total,'payment_method','cash_on_delivery','delivery_district',v_zone.district,'estimated_delivery_days',v_zone.max_delivery_days);
end;
$function$

