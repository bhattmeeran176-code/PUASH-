import { FormEvent, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, BarChart3, ClipboardList, LogOut, Package, Plus, RefreshCw, Save, ShieldCheck, X, AlertTriangle, TrendingUp, Users, UserRound, ChevronDown, ChevronUp, Download, Activity, Truck } from 'lucide-react';

type Category = { id: string; name: string };
type OrderItem = { id: string; product_id?: string | null; product_name: string; unit_price: number; quantity: number };
type Order = { id: string; user_id: string; status: string; total_amount: number; subtotal_amount: number | null; delivery_fee: number; payment_method: string; shipping_address: any; customer_note: string | null; created_at: string; coupon_code: string | null; discount_amount: number; courier_name: string | null; tracking_number: string | null; shipped_at: string | null; delivered_at: string | null; order_items: OrderItem[] };
type Customer = { customer_id: string; email: string | null; full_name: string | null; joined_at: string; order_count: number; delivered_spend: number };
type ActivityLog = { id:string; actor_id:string|null; actor_name:string; action:string; entity_type:string; entity_id:string|null; entity_label:string; summary:string; old_data:Record<string,any>; new_data:Record<string,any>; created_at:string };
type StockMovement = { id:string; product_id:string|null; product_name:string; previous_stock:number; new_stock:number; change_quantity:number; movement_type:string; actor_id:string|null; created_at:string };
type Coupon = { id:string; code:string; discount_type:'percentage'|'fixed'; discount_value:number; min_order_amount:number; max_discount:number|null; starts_at:string|null; expires_at:string|null; usage_limit:number|null; per_user_limit:number; usage_count:number; is_active:boolean };
type ReturnRequest = { id: string; order_id: string; user_id: string; reason: string; details: string | null; status: string; admin_note: string | null; requested_at: string; orders?: { total_amount: number; shipping_address: any } | null };
type DeliveryZone = { id:string; district:string; is_serviceable:boolean; delivery_fee:number; free_delivery_threshold:number; min_delivery_days:number; max_delivery_days:number; postal_codes:string; };
type ProductVariant = { id:string; product_id:string; label:string; price:number|null; stock_quantity:number; is_active:boolean; sort_order:number; };
type Product = {
  id: string; name: string; slug: string; description: string | null;
  price: number; compare_at_price: number | null; image_url: string | null;
  stock_quantity: number; is_active: boolean; category_id: string | null;
  categories?: { name: string } | null;
};

const money = (value: number) => '₹' + Number(value || 0).toLocaleString('en-IN');
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function Admin() {
  const [sessionReady, setSessionReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [managedVariantProduct, setManagedVariantProduct] = useState<string | null>(null);
  const [managedVariants, setManagedVariants] = useState<ProductVariant[]>([]);
  const [variantLabel, setVariantLabel] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantStock, setVariantStock] = useState('0');
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [stockDrafts, setStockDrafts] = useState<Record<string,string>>({});
  const [stockHistoryBusy, setStockHistoryBusy] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<'percentage'|'fixed'>('percentage');
  const [couponValue, setCouponValue] = useState('10');
  const [couponMinimum, setCouponMinimum] = useState('0');
  const [couponMaximum, setCouponMaximum] = useState('');
  const [couponExpiry, setCouponExpiry] = useState('');
  const [couponLimit, setCouponLimit] = useState('');
  const [couponPerUser, setCouponPerUser] = useState('1');
  const [returnNotes, setReturnNotes] = useState<Record<string,string>>({});
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'analytics' | 'products' | 'orders' | 'customers' | 'returns' | 'coupons' | 'inventory' | 'activity' | 'delivery'>('sales');
  const [analyticsRange, setAnalyticsRange] = useState<'7'|'30'|'90'|'365'>('30');
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [shippingDrafts, setShippingDrafts] = useState<Record<string, { courier: string; tracking: string }>>({});
  const [productSearch, setProductSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [comparePrice, setComparePrice] = useState('');
  const [stock, setStock] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    let alive = true;
    const checkUser = async (current: any) => {
      if (!alive) return;
      setUser(current);
      if (!current) { setIsAdmin(false); setSessionReady(true); return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', current.id).maybeSingle();
      if (!alive) return;
      setIsAdmin(data?.role === 'admin');
      setSessionReady(true);
    };
    supabase.auth.getSession().then(({ data }) => checkUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUser(session?.user ?? null);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!imageFile) { setImagePreview(''); return; }
    const preview = URL.createObjectURL(imageFile);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [imageFile]);

  const loadDeliveryZones = async () => {
    const [{ data, error }, { data: pinRows, error: pinError }] = await Promise.all([
      supabase.from('delivery_zones').select('id,district,is_serviceable,delivery_fee,free_delivery_threshold,min_delivery_days,max_delivery_days').order('district'),
      supabase.rpc('get_delivery_zone_postal_codes'),
    ]);
    if (error) { setMessage('Delivery zones load nahi hue: ' + error.message); return; }
    if (pinError) { setMessage('PIN-code settings load nahi hui: ' + pinError.message); return; }
    const pinsByZone = new Map<string,string[]>();
    (pinRows || []).forEach((row:any) => pinsByZone.set(row.zone_id,[...(pinsByZone.get(row.zone_id)||[]),row.postal_code]));
    setDeliveryZones((data || []).map((zone:any) => ({...zone,postal_codes:(pinsByZone.get(zone.id)||[]).join('\n')})) as DeliveryZone[]);
  };

  const saveDeliveryZone = async (zone: DeliveryZone) => {
    if (zone.delivery_fee < 0 || zone.free_delivery_threshold < 0 || zone.min_delivery_days < 0 || zone.max_delivery_days < zone.min_delivery_days) {
      setMessage('Delivery fee, free threshold aur delivery days ki values check karein.'); return;
    }
    const pins = [...new Set(zone.postal_codes.split(/[\s,;]+/).map(pin=>pin.trim()).filter(Boolean))];
    if (pins.some(pin=>!/^\d{6}$/.test(pin))) { setMessage('Har PIN code exactly 6 digits ka hona chahiye.'); return; }
    if (pins.length > 1000) { setMessage('Ek district mein maximum 1000 PIN codes add kar sakte hain.'); return; }
    setOrderBusy(zone.id); setMessage('');
    const { error } = await supabase.from('delivery_zones').update({
      is_serviceable: zone.is_serviceable, delivery_fee: zone.delivery_fee,
      free_delivery_threshold: zone.free_delivery_threshold,
      min_delivery_days: zone.min_delivery_days, max_delivery_days: zone.max_delivery_days,
      updated_at: new Date().toISOString(),
    }).eq('id', zone.id);
    const pinResult = error ? null : await supabase.rpc('set_delivery_zone_postal_codes',{p_zone_id:zone.id,p_postal_codes:pins});
    setOrderBusy(null);
    const finalError = error || pinResult?.error;
    setMessage(finalError ? 'Delivery settings save nahi hui: ' + finalError.message : zone.district + ' settings aur ' + pins.length + ' PIN codes save ho gaye.');
    if (!finalError) await loadDeliveryZones();
  };

  const loadData = async () => {
    setBusy(true);
    const [p, c] = await Promise.all([
      supabase.from('products').select('id,name,slug,description,price,compare_at_price,image_url,stock_quantity,is_active,category_id,categories(name)').order('created_at', { ascending: false }),
      supabase.from('categories').select('id,name').eq('is_active', true).order('name')
    ]);
    if (p.error) setMessage('Products load nahi hue: ' + p.error.message);
    else setProducts((p.data || []) as Product[]);
    if (c.error) setMessage('Categories load nahi hui: ' + c.error.message);
    else {
      setCategories(c.data || []);
      if (!categoryId && c.data?.length) setCategoryId(c.data[0].id);
    }
    setBusy(false);
  };

  const exportOrdersCsv = () => {
    const rows = orders.filter(order => {
      if ((order.customer_note || '').startsWith('INTERNAL TEST ORDER')) return false;
      const address = order.shipping_address || {};
      const haystack = [order.id, address.full_name, address.phone, address.postal_code, address.city].join(' ').toLowerCase();
      return (orderStatusFilter === 'all' || order.status === orderStatusFilter) && haystack.includes(orderSearch.trim().toLowerCase());
    });
    const quote = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const header = ['Order ID','Date','Status','Subtotal','Delivery Fee','Coupon','Discount','Total','Payment Method','Items'];
    const lines = rows.map(order => [
      order.id,
      new Date(order.created_at).toLocaleString('en-IN'),
      order.status,
      order.subtotal_amount ?? order.total_amount,
      order.delivery_fee,
      order.coupon_code || '',
      order.discount_amount || 0,
      order.total_amount,
      order.payment_method,
      (order.order_items || []).map(item => item.product_name + ' x ' + item.quantity).join('; ')
    ].map(quote).join(','));
    const csv = '\uFEFF' + [header.map(quote).join(','), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'puash-orders-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(rows.length + ' orders CSV mein export hue.');
  };

  const loadOrders = async () => {
    const { data, error } = await supabase.from('orders')
      .select('id,user_id,status,total_amount,subtotal_amount,delivery_fee,payment_method,shipping_address,customer_note,created_at,coupon_code,discount_amount,courier_name,tracking_number,shipped_at,delivered_at,order_items(id,product_id,product_name,unit_price,quantity)')
      .order('created_at', { ascending: false });
    if (error) setMessage('Orders load nahi hue: ' + error.message);
    else setOrders((data || []) as Order[]);
  };

  const loadActivityLogs = async () => {
    setActivityBusy(true);
    const { data, error } = await supabase.from('admin_activity_logs')
      .select('id,actor_id,actor_name,action,entity_type,entity_id,entity_label,summary,old_data,new_data,created_at')
      .order('created_at',{ascending:false}).limit(200);
    if(error) setMessage('Activity logs load nahi hue: '+error.message);
    else setActivityLogs((data||[]) as ActivityLog[]);
    setActivityBusy(false);
  };

  const loadStockMovements = async () => {
    setStockHistoryBusy(true);
    const {data,error}=await supabase.from('stock_movements')
      .select('id,product_id,product_name,previous_stock,new_stock,change_quantity,movement_type,actor_id,created_at')
      .order('created_at',{ascending:false}).limit(100);
    if(error) setMessage('Stock history load nahi hui: '+error.message);
    else setStockMovements((data||[]) as StockMovement[]);
    setStockHistoryBusy(false);
  };

  const setStockLevel = async (product:Product) => {
    const raw=stockDrafts[product.id];
    const next=Number(raw);
    if(raw===undefined || !Number.isInteger(next) || next<0 || next>1000000) {setMessage('Stock 0 se 10,00,000 ke beech whole number hona chahiye.');return;}
    if(next===product.stock_quantity) {setMessage('Stock mein koi change nahi hai.');return;}
    setOrderBusy(product.id);setMessage('');
    const {error}=await supabase.from('products').update({stock_quantity:next,updated_at:new Date().toISOString()}).eq('id',product.id);
    setOrderBusy(null);
    if(error) setMessage('Stock update nahi hua: '+error.message);
    else {
      setProducts(current=>current.map(item=>item.id===product.id?{...item,stock_quantity:next}:item));
      setStockDrafts(current=>({...current,[product.id]:String(next)}));
      setMessage(product.name+' ka stock update ho gaya.');
      await loadStockMovements();
    }
  };

  const loadCoupons = async () => {
    setBusy(true);
    const { data, error } = await supabase.from('coupons').select('*').order('created_at',{ascending:false});
    if(error) setMessage('Coupons load nahi hue: '+error.message);
    else setCoupons((data||[]) as Coupon[]);
    setBusy(false);
  };

  const createCoupon = async (event: FormEvent) => {
    event.preventDefault();
    const code=couponCode.trim().toUpperCase();
    const value=Number(couponValue), minimum=Number(couponMinimum||0), perUser=Number(couponPerUser||1);
    if(!/^[A-Z0-9_-]{3,32}$/.test(code)) { setMessage('Coupon code 3–32 characters ka hona chahiye (A-Z, 0-9, _ or -).'); return; }
    if(!Number.isFinite(value)||value<=0||(couponType==='percentage'&&value>100)||!Number.isFinite(minimum)||minimum<0||!Number.isInteger(perUser)||perUser<1) { setMessage('Coupon values check karein.'); return; }
    setBusy(true); setMessage('');
    const {error}=await supabase.from('coupons').insert({
      code,discount_type:couponType,discount_value:value,min_order_amount:minimum,
      max_discount:couponMaximum?Number(couponMaximum):null,
      expires_at:couponExpiry?new Date(couponExpiry).toISOString():null,
      usage_limit:couponLimit?Number(couponLimit):null,per_user_limit:perUser
    });
    setBusy(false);
    if(error) setMessage('Coupon create nahi hua: '+error.message);
    else {setMessage('Coupon '+code+' create ho gaya.');setCouponCode('');setCouponValue('10');setCouponMinimum('0');setCouponMaximum('');setCouponExpiry('');setCouponLimit('');setCouponPerUser('1');await loadCoupons();}
  };

  const toggleCoupon = async (coupon:Coupon) => {
    setOrderBusy(coupon.id);
    const {error}=await supabase.from('coupons').update({is_active:!coupon.is_active,updated_at:new Date().toISOString()}).eq('id',coupon.id);
    setOrderBusy(null);
    if(error) setMessage('Coupon update nahi hua: '+error.message); else {setMessage('Coupon status update ho gaya.');await loadCoupons();}
  };

  const loadReturnRequests = async () => {
    setBusy(true);
    const { data, error } = await supabase.from('order_return_requests')
      .select('id,order_id,user_id,reason,details,status,admin_note,requested_at,orders(total_amount,shipping_address)')
      .order('requested_at', { ascending: false });
    if (error) setMessage('Return requests load nahi hui: ' + error.message);
    else setReturnRequests((data || []) as ReturnRequest[]);
    setBusy(false);
  };

  const updateReturnRequest = async (requestId: string, status: string) => {
    if (!['approved','rejected','item_received','refunded'].includes(status)) return;
    setOrderBusy(requestId); setMessage('');
    const { error } = await supabase.from('order_return_requests')
      .update({ status, admin_note: returnNotes[requestId]?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', requestId);
    setOrderBusy(null);
    if (error) setMessage('Return request update nahi hui: ' + error.message);
    else { setMessage('Return request update ho gayi.'); await loadReturnRequests(); }
  };

  const loadCustomers = async () => {
    setCustomerLoading(true);
    const { data, error } = await supabase.rpc('admin_customer_directory');
    if (error) setMessage('Customers load nahi hue: ' + error.message);
    else setCustomers((data || []) as Customer[]);
    setCustomerLoading(false);
  };

  const saveShippingDetails = async (order: Order) => {
    const draft = shippingDrafts[order.id] || { courier: order.courier_name || '', tracking: order.tracking_number || '' };
    setOrderBusy(order.id); setMessage('');
    const { error } = await supabase.from('orders').update({
      courier_name: draft.courier.trim() || null,
      tracking_number: draft.tracking.trim() || null,
    }).eq('id', order.id);
    setOrderBusy(null);
    if (error) setMessage('Shipping details save nahi hue: ' + error.message);
    else { setMessage('Shipping details save ho gaye.'); await loadOrders(); }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!['pending','confirmed','processing','shipped','delivered','cancelled'].includes(status)) return;
    setOrderBusy(orderId); setMessage('');
    const now = new Date().toISOString();
    const orderUpdate: Record<string, any> = { status, updated_at: now };
    if (status === 'shipped') orderUpdate.shipped_at = now;
    if (status === 'delivered') orderUpdate.delivered_at = now;
    const { error } = await supabase.from('orders').update(orderUpdate).eq('id', orderId);
    setOrderBusy(null);
    if (error) setMessage('Order status update nahi hua: ' + error.message);
    else { setMessage('Order status update ho gaya.'); await loadOrders(); }
  };

  useEffect(() => { if (isAdmin) { loadData(); loadOrders(); } }, [isAdmin]);

  const openVariantManager = async (productId: string) => {
    if (managedVariantProduct === productId) { setManagedVariantProduct(null); return; }
    setManagedVariantProduct(productId); setVariantLabel(''); setVariantPrice(''); setVariantStock('0'); setEditingVariantId(null);
    const { data, error } = await supabase.from('product_variants').select('id,product_id,label,price,stock_quantity,is_active,sort_order').eq('product_id', productId).order('sort_order').order('created_at');
    if (error) { setMessage('Product options load nahi huye: ' + error.message); return; }
    setManagedVariants((data || []) as ProductVariant[]);
  };

  const saveVariant = async (event: FormEvent) => {
    event.preventDefault();
    if (!managedVariantProduct || !variantLabel.trim() || !Number.isInteger(Number(variantStock)) || Number(variantStock) < 0 || Number(variantStock) > 1000000 || (variantPrice && (!Number.isFinite(Number(variantPrice)) || Number(variantPrice) < 0))) {
      setMessage('Option label, price valid honi chahiye aur stock 0 se 10,00,000 whole number ke beech hona chahiye.'); return;
    }
    const normalizedLabel = variantLabel.trim().toLocaleLowerCase();
    if (managedVariants.some(item => item.id !== editingVariantId && item.label.trim().toLocaleLowerCase() === normalizedLabel)) {
      setMessage('Is product ke liye yeh option label pehle se maujood hai.'); return;
    }
    setVariantBusy(true); setMessage('');
    const payload = {
      label: variantLabel.trim(),
      price: variantPrice.trim() ? Number(variantPrice) : null,
      stock_quantity: Number(variantStock),
      updated_at: new Date().toISOString(),
    };
    const result = editingVariantId
      ? await supabase.from('product_variants').update(payload).eq('id', editingVariantId).select('id,product_id,label,price,stock_quantity,is_active,sort_order').single()
      : await supabase.from('product_variants').insert({ ...payload, product_id: managedVariantProduct, sort_order: Math.max(-1, ...managedVariants.map(item => item.sort_order ?? -1)) + 1 }).select('id,product_id,label,price,stock_quantity,is_active,sort_order').single();
    setVariantBusy(false);
    if (result.error) { setMessage('Option save nahi hua: ' + result.error.message); return; }
    setManagedVariants(current => editingVariantId
      ? current.map(item => item.id === editingVariantId ? result.data as ProductVariant : item)
      : [...current, result.data as ProductVariant]);
    setVariantLabel(''); setVariantPrice(''); setVariantStock('0'); setEditingVariantId(null);
    setMessage(editingVariantId ? 'Product option update ho gaya.' : 'Product option add ho gaya.');
  };

  const editVariant = (variant: ProductVariant) => {
    setEditingVariantId(variant.id);
    setVariantLabel(variant.label);
    setVariantPrice(variant.price === null ? '' : String(variant.price));
    setVariantStock(String(variant.stock_quantity));
  };

  const removeVariant = async (variant: ProductVariant) => {
    setVariantBusy(true);
    const { error } = await supabase.from('product_variants').delete().eq('id', variant.id);
    setVariantBusy(false);
    if (error) { setMessage('Option remove nahi hua: ' + error.message); return; }
    setManagedVariants(current => current.filter(item => item.id !== variant.id));
    if (editingVariantId === variant.id) { setEditingVariantId(null); setVariantLabel(''); setVariantPrice(''); setVariantStock('0'); }
    setMessage('Product option remove ho gaya.');
  };

  const resetForm = () => {
    setEditing(null); setName(''); setDescription(''); setPrice('');
    setComparePrice(''); setStock('1'); setImageUrl(''); setImageFile(null);
    setGalleryFiles([]); setActive(true); if (categories[0]) setCategoryId(categories[0].id);
  };

  const authenticate = async (event: FormEvent) => {
    event.preventDefault(); setAuthBusy(true); setMessage('');
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: 'https://puash.pages.dev/admin' } });
    setAuthBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (authMode === 'signup' && !result.data.session) setMessage('Account request create ho gayi. Email confirmation complete karke sign in karein.');
    else if (authMode === 'signup') setMessage('Account create ho gaya. Admin access activate hone ke baad dashboard open hoga.');
  };

  const adjustStock = async (product: Product, change: number) => {
    const nextStock = Math.max(0, product.stock_quantity + change);
    if (nextStock > 1000000) { setMessage('Stock 10,00,000 se zyada nahi ho sakta.'); return; }
    setOrderBusy(product.id);
    setMessage('');
    const { error } = await supabase.from('products')
      .update({ stock_quantity: nextStock, updated_at: new Date().toISOString() })
      .eq('id', product.id);
    setOrderBusy(null);
    if (error) setMessage('Stock update nahi hua: ' + error.message);
    else {
      setProducts(current => current.map(item => item.id === product.id ? { ...item, stock_quantity: nextStock } : item));
      setMessage('Stock update ho gaya.');
    }
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !price || !Number.isFinite(Number(price)) || Number(price) <= 0) { setMessage('Product name aur valid price required hain.'); return; }
    if (comparePrice && (!Number.isFinite(Number(comparePrice)) || Number(comparePrice) < Number(price))) { setMessage('MRP compare price, selling price se zyada ya barabar hona chahiye.'); return; }
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0 || Number(stock) > 1000000) { setMessage('Stock quantity 0 se 10,00,000 ke beech whole number honi chahiye.'); return; }
    if (imageFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024)) { setMessage('Image JPG, PNG ya WebP ho aur 5 MB se chhoti ho.'); return; }
    if (galleryFiles.length > 8 || galleryFiles.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { setMessage('Gallery mein maximum 8 images add karein. Har image JPG, PNG ya WebP aur 5 MB se chhoti honi chahiye.'); return; }
    setBusy(true); setMessage('');
    let finalImage = imageUrl.trim() || null;
    let uploadedImagePath: string | null = null;
    if (imageFile) {
      const safeName = imageFile.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
      const path = Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '-' + safeName;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: false, contentType: imageFile.type });
      if (uploadError) { setBusy(false); setMessage('Image upload failed: ' + uploadError.message); return; }
      uploadedImagePath = path;
      finalImage = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }
    const payload = {
      name: name.trim(), slug: slugify(name) + (editing ? '-' + editing.slice(0, 6) : '-' + Date.now().toString().slice(-6)),
      description: description.trim() || null, price: Number(price),
      compare_at_price: comparePrice ? Number(comparePrice) : null,
      stock_quantity: Math.max(0, Math.floor(Number(stock) || 0)),
      category_id: categoryId || null, image_url: finalImage, is_active: active
    };
    const result = editing
      ? await supabase.from('products').update(payload).eq('id', editing).select('id').single()
      : await supabase.from('products').insert(payload).select('id').single();
    if (result.error) {
      setBusy(false);
      if (uploadedImagePath) await supabase.storage.from('product-images').remove([uploadedImagePath]);
      setMessage('Save nahi hua: ' + result.error.message);
      return;
    }
    const savedProductId = editing || result.data?.id;
    if (savedProductId && galleryFiles.length) {
      const { data: existingGallery, error: existingGalleryError } = await supabase.from('product_images').select('id,sort_order').eq('product_id', savedProductId);
      if (existingGalleryError) { setBusy(false); setMessage('Existing product gallery load nahi hui: ' + existingGalleryError.message); await loadData(); return; }
      if ((existingGallery?.length || 0) + galleryFiles.length > 8) { setBusy(false); setMessage('Ek product ke liye maximum 8 additional gallery images allowed hain.'); return; }
      const nextSortOrder = Math.max(0, ...(existingGallery || []).map((item: any) => Number(item.sort_order) || 0)) + 1;
      const galleryRows: { product_id: string; image_url: string; storage_path: string; alt_text: string; sort_order: number }[] = [];
      const uploadedGalleryPaths: string[] = [];
      for (let index = 0; index < galleryFiles.length; index++) {
        const file = galleryFiles[index];
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
        const path = 'gallery/' + savedProductId + '/' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '-' + safeName;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) {
          if (uploadedGalleryPaths.length) await supabase.storage.from('product-images').remove(uploadedGalleryPaths);
          setBusy(false); setMessage('Product save ho gaya, lekin gallery upload ruk gaya: ' + uploadError.message); await loadData(); return;
        }
        uploadedGalleryPaths.push(path);
        galleryRows.push({ product_id: savedProductId, image_url: supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl, storage_path: path, alt_text: name.trim(), sort_order: nextSortOrder + index });
      }
      const { error: galleryError } = await supabase.from('product_images').insert(galleryRows);
      if (galleryError) {
        await supabase.storage.from('product-images').remove(uploadedGalleryPaths);
        setBusy(false); setMessage('Product save ho gaya, lekin gallery record save nahi hua: ' + galleryError.message); await loadData(); return;
      }
    }
    setBusy(false);
    setMessage(editing ? 'Product update ho gaya.' : 'Product add ho gaya.');
    resetForm(); await loadData();
  };

  const editProduct = (p: Product) => {
    setEditing(p.id); setName(p.name); setDescription(p.description || '');
    setPrice(String(p.price)); setComparePrice(p.compare_at_price ? String(p.compare_at_price) : '');
    setStock(String(p.stock_quantity)); setCategoryId(p.category_id || categories[0]?.id || '');
    setImageUrl(p.image_url || ''); setImageFile(null); setGalleryFiles([]); setActive(p.is_active);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) setMessage(error.message); else await loadData();
  };

  const genuineOrders = orders.filter(order => !(order.customer_note || '').startsWith('INTERNAL TEST ORDER'));
  const nonCancelledOrders = genuineOrders.filter(order => order.status !== 'cancelled');
  const deliveredOrders = genuineOrders.filter(order => order.status === 'delivered');
  const deliveredSales = deliveredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const orderValue = nonCancelledOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const unitsSold = nonCancelledOrders.reduce((sum, order) => sum + (order.order_items || []).reduce((n, item) => n + Number(item.quantity || 0), 0), 0);
  const statusCounts = ['pending','confirmed','processing','shipped','delivered','cancelled'].map(status => ({
    status, count: genuineOrders.filter(order => order.status === status).length,
  }));
  const bestSellers = Object.values(nonCancelledOrders.flatMap(order => order.order_items || []).reduce((acc: Record<string, {name:string; quantity:number; revenue:number}>, item) => {
    const key = item.product_name;
    if (!acc[key]) acc[key] = { name: key, quantity: 0, revenue: 0 };
    acc[key].quantity += Number(item.quantity || 0);
    acc[key].revenue += Number(item.unit_price || 0) * Number(item.quantity || 0);
    return acc;
  }, {})).sort((a,b) => b.quantity - a.quantity).slice(0,5);
  const lowStockProducts = products.filter(product => product.is_active && product.stock_quantity <= 5).sort((a,b) => a.stock_quantity - b.stock_quantity);
  const monthlySales = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (5 - index));
    const year = date.getFullYear();
    const month = date.getMonth();
    const amount = deliveredOrders.filter(order => {
      const created = new Date(order.created_at);
      return created.getFullYear() === year && created.getMonth() === month;
    }).reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    return { key: year + '-' + String(month + 1).padStart(2, '0'), label: date.toLocaleDateString('en-IN', { month: 'short' }), amount };
  });
  const maxMonthlySales = Math.max(1, ...monthlySales.map(item => item.amount));

  const analyticsDays = Number(analyticsRange);
  const analyticsEnd = new Date();
  const analyticsStart = new Date(analyticsEnd.getTime() - analyticsDays * 86400000);
  const previousStart = new Date(analyticsStart.getTime() - analyticsDays * 86400000);
  const inAnalyticsRange = (order: Order, start: Date, end: Date) => {
    const created = new Date(order.created_at).getTime();
    return created >= start.getTime() && created < end.getTime();
  };
  const analyticsOrders = genuineOrders.filter(order => inAnalyticsRange(order, analyticsStart, analyticsEnd));
  const previousAnalyticsOrders = genuineOrders.filter(order => inAnalyticsRange(order, previousStart, analyticsStart));
  const analyticsDelivered = analyticsOrders.filter(order => order.status === 'delivered');
  const previousDelivered = previousAnalyticsOrders.filter(order => order.status === 'delivered');
  const analyticsRevenue = analyticsDelivered.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const previousRevenue = previousDelivered.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const analyticsAov = analyticsDelivered.length ? analyticsRevenue / analyticsDelivered.length : 0;
  const previousAov = previousDelivered.length ? previousRevenue / previousDelivered.length : 0;
  const analyticsUnits = analyticsOrders.filter(order => order.status !== 'cancelled').reduce((sum, order) => sum + (order.order_items || []).reduce((n,item) => n + Number(item.quantity || 0),0),0);
  const analyticsCancelled = analyticsOrders.filter(order => order.status === 'cancelled').length;
  const analyticsCancellationRate = analyticsOrders.length ? analyticsCancelled / analyticsOrders.length * 100 : 0;
  const percentChange = (current:number, previous:number) => previous > 0 ? ((current-previous)/previous)*100 : current > 0 ? 100 : 0;
  const analyticsProductRows = Object.values(analyticsDelivered.flatMap(order=>order.order_items||[]).reduce((acc:Record<string,{name:string;units:number;revenue:number}>,item)=>{
    const key=item.product_id||item.product_name;
    if(!acc[key]) acc[key]={name:item.product_name,units:0,revenue:0};
    acc[key].units+=Number(item.quantity||0);
    acc[key].revenue+=Number(item.unit_price||0)*Number(item.quantity||0);
    return acc;
  },{})).sort((a,b)=>b.revenue-a.revenue).slice(0,8);
  const analyticsCategoryRows = Object.values(analyticsDelivered.flatMap(order=>order.order_items||[]).reduce((acc:Record<string,{name:string;units:number;revenue:number}>,item)=>{
    const product=products.find(p=>p.id===item.product_id);
    const key=product?.categories?.name||'Category unavailable';
    if(!acc[key]) acc[key]={name:key,units:0,revenue:0};
    acc[key].units+=Number(item.quantity||0);
    acc[key].revenue+=Number(item.unit_price||0)*Number(item.quantity||0);
    return acc;
  },{})).sort((a,b)=>b.revenue-a.revenue);
  const exportAnalyticsCsv = () => {
    const quote=(value:unknown)=>'"'+String(value??'').replace(/"/g,'""')+'"';
    const header=['Order ID','Created At','Status','Subtotal','Discount','Delivery Fee','Total','Items'];
    const lines=analyticsOrders.map(order=>[order.id,order.created_at,order.status,order.subtotal_amount??order.total_amount,order.discount_amount||0,order.delivery_fee,order.total_amount,(order.order_items||[]).map(item=>item.product_name+' x '+item.quantity).join('; ')].map(quote).join(','));
    const csv='\uFEFF'+[header.map(quote).join(','),...lines].join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download='puash-analytics-'+analyticsRange+'-days-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    setMessage(analyticsOrders.length+' analytics orders CSV mein export hue.');
  };



  if (!sessionReady) return <div className="admin-screen"><div className="admin-loading">PUASH Admin load ho raha hai…</div></div>;

  if (!user || !isAdmin) return (
    <div className="admin-screen">
      <div className="admin-auth-card">
        <a className="admin-back" href="/"><ArrowLeft size={16}/> PUASH store par wapas</a>
        <div className="admin-brand"><span>PUASH.</span><small>STORE MANAGEMENT</small></div>
        <div className="admin-shield"><ShieldCheck size={25}/></div>
        <h1>{!user ? (authMode === 'login' ? 'Admin sign in' : 'Create your account') : 'Admin access pending'}</h1>
        <p>{!user ? 'Apne store dashboard mein secure sign in karein.' : 'Aapka account abhi customer role par hai. Admin access activate hone ke baad yahan se products manage kar sakenge.'}</p>
        {!user && <form onSubmit={authenticate} className="admin-form">
          <label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label>
          <label>Password<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required placeholder="At least 8 characters"/></label>
          <button className="admin-primary" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="admin-link" onClick={()=>{setAuthMode(authMode === 'login' ? 'signup' : 'login');setMessage('')}}>{authMode === 'login' ? 'New here? Create account' : 'Already have an account? Sign in'}</button>
        </form>}
        {message && <div className="admin-message">{message}</div>}
        {user && <button className="admin-primary" onClick={()=>supabase.auth.signOut()}>Sign out</button>}
      </div>
    </div>
  );

  return <div className="admin-screen">
    <header className="admin-header"><a href="/" className="admin-brand"><span>PUASH.</span><small>ADMIN</small></a><button className="admin-logout" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sign out</button></header>
    <main className="admin-main">
      <div className="admin-title-row"><div><div className="admin-kicker">STORE CONTROL</div><h1>{activeTab === 'sales' ? 'Sales dashboard' : activeTab === 'analytics' ? 'Advanced analytics' : activeTab === 'products' ? 'Products' : activeTab === 'inventory' ? 'Inventory management' : activeTab === 'delivery' ? 'Delivery settings' : activeTab === 'activity' ? 'Admin activity logs' : activeTab === 'coupons' ? 'Coupons & discounts' : activeTab === 'returns' ? 'Returns' : activeTab === 'customers' ? 'Customers' : 'Orders'}</h1><p>{activeTab === 'sales' ? 'Your store performance at a glance.' : activeTab === 'analytics' ? 'Date-wise revenue, order trends and product performance.' : activeTab === 'products' ? 'Add, edit and publish products on your PUASH store.' : activeTab === 'inventory' ? 'Track stock levels and review every recorded stock movement.' : activeTab === 'delivery' ? 'Set district-wise serviceability, delivery charges and estimated delivery windows.' : activeTab === 'activity' ? 'Review important changes made by store administrators.' : activeTab === 'coupons' ? 'Create and manage customer discount codes.' : activeTab === 'returns' ? 'Review and manage customer return requests.' : activeTab === 'customers' ? 'View customer accounts and order history.' : 'Review customer orders and update their fulfilment status.'}</p></div><button className="admin-refresh" onClick={() => { loadData(); loadOrders(); }}><RefreshCw size={16}/> Refresh</button></div>
      <nav className="admin-tabs"><button className={activeTab === 'sales' ? 'active' : ''} onClick={() => setActiveTab('sales')}><BarChart3 size={16}/> Dashboard</button><button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}><TrendingUp size={16}/> Analytics</button><button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}><Package size={16}/> Products <span>{products.length}</span></button><button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}><ClipboardList size={16}/> Orders <span>{genuineOrders.length}</span></button><button className={activeTab === 'customers' ? 'active' : ''} onClick={() => { setActiveTab('customers'); loadCustomers(); }}><Users size={16}/> Customers <span>{customers.length}</span></button><button className={activeTab === 'returns' ? 'active' : ''} onClick={() => { setActiveTab('returns'); loadReturnRequests(); }}><RefreshCw size={16}/> Returns <span>{returnRequests.filter(item=>item.status==='pending').length}</span></button><button className={activeTab === 'coupons' ? 'active' : ''} onClick={() => { setActiveTab('coupons'); loadCoupons(); }}><Save size={16}/> Coupons <span>{coupons.filter(c=>c.is_active).length}</span></button><button className={activeTab === 'inventory' ? 'active' : ''} onClick={() => { setActiveTab('inventory'); loadStockMovements(); }}><ClipboardList size={16}/> Inventory <span>{products.filter(p=>p.is_active && p.stock_quantity<=5).length}</span></button><button className={activeTab === 'activity' ? 'active' : ''} onClick={() => { setActiveTab('activity'); loadActivityLogs(); }}><Activity size={16}/> Activity <span>{activityLogs.length}</span></button><button className={activeTab === 'delivery' ? 'active' : ''} onClick={() => { setActiveTab('delivery'); loadDeliveryZones(); }}><Truck size={16}/> Delivery zones <span>{deliveryZones.length}</span></button></nav>
      {message && <div className="admin-message">{message}<button onClick={()=>setMessage('')}><X size={14}/></button></div>}
      {activeTab === 'delivery' ? <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Truck size={17}/></span><strong>Jammu & Kashmir delivery zones</strong></div><small>{deliveryZones.filter(z=>z.is_serviceable).length} serviceable districts</small></div>
        <p className="admin-shipping-help">Har district ke liye delivery availability, fee, free-delivery threshold aur estimated delivery days configure karein. Changes checkout par server-side apply honge.</p>
        <div className="admin-delivery-zone-list">{deliveryZones.map(zone=><article className="admin-delivery-zone" key={zone.id}>
          <div className="admin-delivery-zone-title"><strong>{zone.district}</strong><label><input type="checkbox" checked={zone.is_serviceable} onChange={e=>setDeliveryZones(items=>items.map(item=>item.id===zone.id?{...item,is_serviceable:e.target.checked}:item))}/> Deliver here</label></div>
          <div className="admin-delivery-zone-fields">
            <label>Delivery fee (₹)<input type="number" min="0" value={zone.delivery_fee} onChange={e=>setDeliveryZones(items=>items.map(item=>item.id===zone.id?{...item,delivery_fee:Number(e.target.value)}:item))}/></label>
            <label>Free delivery above (₹)<input type="number" min="0" value={zone.free_delivery_threshold} onChange={e=>setDeliveryZones(items=>items.map(item=>item.id===zone.id?{...item,free_delivery_threshold:Number(e.target.value)}:item))}/></label>
            <label>Min days<input type="number" min="0" value={zone.min_delivery_days} onChange={e=>setDeliveryZones(items=>items.map(item=>item.id===zone.id?{...item,min_delivery_days:Number(e.target.value)}:item))}/></label>
            <label>Max days<input type="number" min="0" value={zone.max_delivery_days} onChange={e=>setDeliveryZones(items=>items.map(item=>item.id===zone.id?{...item,max_delivery_days:Number(e.target.value)}:item))}/></label>
          </div>
          <label className="admin-delivery-pin-list">Allowed PIN codes <small>Comma, space ya new line se separate karein. Empty chhorne par poora district eligible rahega.</small><textarea rows={3} value={zone.postal_codes} onChange={e=>setDeliveryZones(items=>items.map(item=>item.id===zone.id?{...item,postal_codes:e.target.value}:item))} placeholder="190001, 190002, 190003" /></label>
          <button className="admin-primary admin-zone-save" disabled={orderBusy===zone.id} onClick={()=>saveDeliveryZone(zone)}>{orderBusy===zone.id?'Saving…':'Save district settings'}</button>
        </article>)}</div>
      </section> : activeTab === 'sales' ? <section className="admin-sales-dashboard">
        <div className="admin-sales-note">Figures exclude internal test orders. Sales total below counts delivered orders only.</div>
        <div className="admin-sales-metrics">
          <article><span><ClipboardList size={17}/> Total orders</span><strong>{genuineOrders.length}</strong><small>Including cancelled orders</small></article>
          <article><span><TrendingUp size={17}/> Delivered sales</span><strong>{money(deliveredSales)}</strong><small>{deliveredOrders.length} delivered orders</small></article>
          <article><span><Package size={17}/> Order value</span><strong>{money(orderValue)}</strong><small>All non-cancelled orders</small></article>
          <article><span><BarChart3 size={17}/> Units ordered</span><strong>{unitsSold}</strong><small>Across non-cancelled orders</small></article>
        </div>
        <section className="admin-panel admin-monthly-panel">
          <div className="admin-panel-heading"><div><span className="admin-panel-icon"><TrendingUp size={17}/></span><strong>Monthly sales</strong></div><small>Last 6 months · Delivered orders</small></div>
          <div className="admin-monthly-chart" role="img" aria-label="Monthly delivered sales for the last six months">
            {monthlySales.map(item => <div className="admin-month-column" key={item.key}>
              <strong>{item.amount > 0 ? money(item.amount) : '₹0'}</strong>
              <div className="admin-month-track"><div className="admin-month-bar" style={{ height: (item.amount / maxMonthlySales * 100) + '%' }} /></div>
              <span>{item.label}</span>
            </div>)}
          </div>
          <p className="admin-sales-footnote">Sales month-wise order creation date ke basis par calculate hoti hain. Sirf delivered orders count hote hain.</p>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span className="admin-panel-icon"><ClipboardList size={17}/></span><strong>Order status overview</strong></div></div>
          <div className="admin-status-grid">{statusCounts.map(item=><div key={item.status}><span>{item.status.charAt(0).toUpperCase()+item.status.slice(1)}</span><strong>{item.count}</strong></div>)}</div>
        </section>
        <div className="admin-sales-columns">
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="admin-panel-icon"><TrendingUp size={17}/></span><strong>Best-selling products</strong></div></div>
            {bestSellers.length===0 ? <div className="admin-empty">Abhi sales data available nahi hai.</div> : <div className="admin-sales-list">{bestSellers.map((item,index)=><div key={item.name}><span className="admin-sales-rank">{index+1}</span><div><strong>{item.name}</strong><small>{item.quantity} units ordered</small></div><b>{money(item.revenue)}</b></div>)}</div>}
          </section>
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="admin-panel-icon"><AlertTriangle size={17}/></span><strong>Low-stock products</strong></div><span className="admin-low-count">{lowStockProducts.length}</span></div>
            {lowStockProducts.length===0 ? <div className="admin-empty">Koi low-stock product nahi hai.</div> : <div className="admin-sales-list">{lowStockProducts.slice(0,8).map(product=><div key={product.id}><span className="admin-low-dot"><AlertTriangle size={14}/></span><div><strong>{product.name}</strong><small>{product.is_active ? 'Published' : 'Hidden'}</small></div><b>{product.stock_quantity} left</b></div>)}</div>}
            {lowStockProducts.length>8 && <p className="admin-sales-footnote">Aur {lowStockProducts.length-8} products low stock mein hain. Products tab mein full list dekhein.</p>}
          </section>
        </div>
      </section> : activeTab === 'analytics' ? <section className="admin-analytics">
        <div className="admin-panel">
          <div className="admin-panel-heading"><div><span className="admin-panel-icon"><TrendingUp size={17}/></span><strong>Performance report</strong></div><button className="admin-link" onClick={exportAnalyticsCsv}><Download size={14}/> Export report CSV</button></div>
          <div className="analytics-controls"><label>Report period<select value={analyticsRange} onChange={e=>setAnalyticsRange(e.target.value as '7'|'30'|'90'|'365')}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 365 days</option></select></label><span>{analyticsStart.toLocaleDateString('en-IN')} – {analyticsEnd.toLocaleDateString('en-IN')}</span></div>
          <p className="admin-shipping-help">Revenue sirf delivered orders se calculate hoti hai. Comparison pichhle same-length period ke saath hai. Orders ki date creation date par based hai.</p>
          <div className="analytics-metrics">
            <article><small>Delivered revenue</small><strong>{money(analyticsRevenue)}</strong><span className={percentChange(analyticsRevenue,previousRevenue)>=0?'analytics-up':'analytics-down'}>{percentChange(analyticsRevenue,previousRevenue)>=0?'+':''}{percentChange(analyticsRevenue,previousRevenue).toFixed(1)}% vs previous</span></article>
            <article><small>Delivered orders</small><strong>{analyticsDelivered.length}</strong><span>{previousDelivered.length} previous period</span></article>
            <article><small>Average order value</small><strong>{money(analyticsAov)}</strong><span className={percentChange(analyticsAov,previousAov)>=0?'analytics-up':'analytics-down'}>{percentChange(analyticsAov,previousAov)>=0?'+':''}{percentChange(analyticsAov,previousAov).toFixed(1)}% vs previous</span></article>
            <article><small>Units ordered</small><strong>{analyticsUnits}</strong><span>{analyticsOrders.length} total orders in period</span></article>
          </div>
          <div className="analytics-secondary"><div><small>Cancellation rate</small><strong>{analyticsCancellationRate.toFixed(1)}%</strong><span>{analyticsCancelled} cancelled orders</span></div><div><small>Non-delivered orders</small><strong>{analyticsOrders.filter(o=>o.status!=='delivered'&&o.status!=='cancelled').length}</strong><span>Pending, confirmed, processing or shipped</span></div></div>
        </div>
        <div className="analytics-columns">
          <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-panel-icon"><Package size={17}/></span><strong>Top products by revenue</strong></div></div>
            {analyticsProductRows.length===0?<div className="admin-empty">Is period mein delivered sales data nahi hai.</div>:<div className="analytics-ranking">{analyticsProductRows.map((item,index)=><div key={item.name}><span>{index+1}</span><div><strong>{item.name}</strong><small>{item.units} units sold</small></div><b>{money(item.revenue)}</b></div>)}</div>}
          </section>
          <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-panel-icon"><BarChart3 size={17}/></span><strong>Category performance</strong></div></div>
            {analyticsCategoryRows.length===0?<div className="admin-empty">Category sales abhi available nahi hain.</div>:<div className="analytics-ranking">{analyticsCategoryRows.map((item,index)=><div key={item.name}><span>{index+1}</span><div><strong>{item.name}</strong><small>{item.units} units sold</small></div><b>{money(item.revenue)}</b></div>)}</div>}
            <p className="admin-sales-footnote">Category current product catalogue se identify hoti hai. Deleted ya re-categorised products ki historical category unavailable ho sakti hai.</p>
          </section>
        </div>
        <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-panel-icon"><ClipboardList size={17}/></span><strong>Order status breakdown</strong></div></div>
          <div className="analytics-status">{['pending','confirmed','processing','shipped','delivered','cancelled'].map(status=><div key={status}><span>{status.charAt(0).toUpperCase()+status.slice(1)}</span><strong>{analyticsOrders.filter(o=>o.status===status).length}</strong></div>)}</div>
        </section>
      </section> : activeTab === 'products' ? <>
<section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Package size={17}/></span><strong>{editing ? 'Edit product' : 'Add a product'}</strong></div>{editing && <button className="admin-link" onClick={resetForm}>Cancel edit</button>}</div>
        <form className="admin-form admin-product-form" onSubmit={saveProduct}>
          <label>Product name<input value={name} onChange={e=>setName(e.target.value)} required placeholder="e.g. Pashmina stole"/></label>
          <label>Category<select value={categoryId} onChange={e=>setCategoryId(e.target.value)} required><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Price (₹)<input type="number" min="1" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} required placeholder="999"/></label>
          <label>MRP / Compare price (₹)<input type="number" min="0" step="0.01" value={comparePrice} onChange={e=>setComparePrice(e.target.value)} placeholder="Optional"/></label>
          <label>Stock quantity<input type="number" min="0" max="1000000" step="1" value={stock} onChange={e=>setStock(e.target.value)} required/></label>
          <label className="admin-wide">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Product details…"/></label>
          <label className="admin-wide">Main product image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImageFile(e.target.files?.[0] || null)}/><small>JPG, PNG or WebP · Maximum 5 MB</small></label>
           <label className="admin-wide">Additional gallery images<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e=>setGalleryFiles(Array.from(e.target.files || []))}/><small>Up to 8 extra images · Each maximum 5 MB. Existing gallery images are kept when editing.</small></label>
           {galleryFiles.length > 0 && <p className="admin-help-text">{galleryFiles.length} additional image(s) selected.</p>}
          {(imagePreview || imageUrl) && <div className="admin-image-preview"><img src={imagePreview || imageUrl} alt="Product preview" onError={e=>{e.currentTarget.style.display='none';}}/><span>Image preview</span></div>}
          <label className="admin-wide">Or image URL<input type="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://…"/></label>
          <label className="admin-check"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Publish product on store</label>
          <button className="admin-primary admin-save" disabled={busy}><Save size={16}/>{busy ? 'Saving…' : editing ? 'Save changes' : <><Plus size={16}/> Add product</>}</button>
        </form>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Package size={17}/></span><strong>Store catalogue <small>({products.length})</small></strong></div><button className="admin-link" onClick={loadData}>Refresh list</button></div>
        <input className="admin-product-search" value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Search products by name or category…" aria-label="Search products"/>
        {busy && products.length === 0 ? <div className="admin-empty">Loading products…</div> : products.length === 0 ? <div className="admin-empty">Abhi koi product nahi hai. Upar form se pehla product add karein.</div> :
          <div className="admin-product-list">{products.filter(p => (p.name + ' ' + (p.categories?.name || '')).toLowerCase().includes(productSearch.toLowerCase())).map(p=><article className="admin-product-row" key={p.id}>
            <div className="admin-thumb">{p.image_url ? <img src={p.image_url} alt=""/> : <Package size={22}/>}</div>
            <div className="admin-product-copy"><strong>{p.name}</strong><small>{p.categories?.name || 'Uncategorised'}</small><b>{money(p.price)} {p.compare_at_price ? <del>{money(p.compare_at_price)}</del> : null}</b>
              <div className="admin-stock-control"><span className={p.stock_quantity <= 5 ? 'admin-stock-low' : ''}>Stock: {p.stock_quantity}{p.stock_quantity <= 5 ? ' · Low stock' : ''}</span><button disabled={orderBusy===p.id || p.stock_quantity<=0} onClick={()=>adjustStock(p,-1)} aria-label="Decrease stock">−</button><button disabled={orderBusy===p.id} onClick={()=>adjustStock(p,1)} aria-label="Increase stock">+</button></div>
            </div>
            <span className={p.is_active ? 'admin-status live' : 'admin-status'}>{p.is_active ? 'Live' : 'Hidden'}</span>
            <div className="admin-row-actions"><button onClick={()=>editProduct(p)}>Edit</button><button onClick={()=>openVariantManager(p.id)}>Options</button><button onClick={()=>toggleActive(p)}>{p.is_active ? 'Hide' : 'Publish'}</button></div>
            {managedVariantProduct === p.id && <div className="admin-variant-manager">
              <strong>Size / colour options for {p.name}</strong>
              <p className="admin-shipping-help">Use labels such as “Size M · Blue” or “500 g”. Leave price blank to use the base product price.</p>
              {managedVariants.map(variant=><div className="admin-variant-row" key={variant.id}><span>{variant.label}</span><small>{variant.price===null?'Base price':money(Number(variant.price))} · Stock {variant.stock_quantity}</small><button type="button" disabled={variantBusy} onClick={()=>editVariant(variant)}>Edit</button><button type="button" disabled={variantBusy} onClick={()=>void removeVariant(variant)}>Remove</button></div>)}
              <form className="admin-variant-form" onSubmit={saveVariant}>
                <label>Option label<input value={variantLabel} onChange={e=>setVariantLabel(e.target.value)} maxLength={120} required placeholder="Size M · Blue"/></label>
                <label>Price (₹, optional)<input type="number" min="0" step="0.01" value={variantPrice} onChange={e=>setVariantPrice(e.target.value)} placeholder="Use base price"/></label>
                <label>Option stock<input type="number" min="0" max="1000000" step="1" value={variantStock} onChange={e=>setVariantStock(e.target.value)} required/></label>
                <button className="admin-primary" disabled={variantBusy}>{variantBusy?'Saving…':editingVariantId?'Update option':'Add option'}</button>
                {editingVariantId && <button type="button" onClick={()=>{setEditingVariantId(null);setVariantLabel('');setVariantPrice('');setVariantStock('0');}}>Cancel edit</button>}
              </form>
            </div>}
          </article>)}</div>}
      </section>
    
      </> : activeTab === 'inventory' ? <>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Package size={17}/></span><strong>Inventory overview</strong></div><button className="admin-link" onClick={()=>{loadData();loadStockMovements();}}><RefreshCw size={13}/> Refresh</button></div>
          <div className="inventory-summary">
            <article><small>Active products</small><strong>{products.filter(p=>p.is_active).length}</strong></article>
            <article><small>Low stock (1–5)</small><strong>{products.filter(p=>p.is_active&&p.stock_quantity>0&&p.stock_quantity<=5).length}</strong></article>
            <article><small>Out of stock</small><strong>{products.filter(p=>p.is_active&&p.stock_quantity===0).length}</strong></article>
            <article><small>Total units</small><strong>{products.filter(p=>p.is_active).reduce((sum,p)=>sum+p.stock_quantity,0)}</strong></article>
          </div>
          <p className="admin-shipping-help">Stock changes made here, in product edits, and during customer orders are automatically recorded in the movement history.</p>
          <div className="inventory-stock-list">
            {products.filter(p=>p.is_active).sort((a,b)=>a.stock_quantity-b.stock_quantity).map(p=><article className="inventory-stock-row" key={p.id}>
              <div className="inventory-product"><strong>{p.name}</strong><small>{p.categories?.name||'Uncategorised'}</small></div>
              <span className={p.stock_quantity===0?'inventory-out':p.stock_quantity<=5?'inventory-low':'inventory-ok'}>{p.stock_quantity===0?'Out of stock':p.stock_quantity<=5?'Low stock':'In stock'} · {p.stock_quantity}</span>
              <div className="inventory-set-stock"><input aria-label={'Set stock for '+p.name} type="number" min="0" max="1000000" step="1" value={stockDrafts[p.id]??String(p.stock_quantity)} onChange={e=>setStockDrafts(current=>({...current,[p.id]:e.target.value}))}/><button disabled={orderBusy===p.id} onClick={()=>setStockLevel(p)}>{orderBusy===p.id?'Saving…':'Set stock'}</button></div>
            </article>)}
            {products.filter(p=>p.is_active).length===0&&<div className="admin-empty">No active products.</div>}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span className="admin-panel-icon"><RefreshCw size={17}/></span><strong>Stock movement history</strong></div><button className="admin-link" onClick={loadStockMovements}><RefreshCw size={13}/> Refresh</button></div>
          <p className="admin-shipping-help">Latest 100 stock changes. Older activity is retained in the database.</p>
          {stockHistoryBusy?<div className="admin-empty">Loading stock history…</div>:stockMovements.length===0?<div className="admin-empty">No stock movements recorded yet. New stock changes will appear here.</div>:<div className="inventory-history">{stockMovements.map(m=><article className="inventory-history-row" key={m.id}>
            <div><strong>{m.product_name}</strong><small>{new Date(m.created_at).toLocaleString('en-IN')}</small></div>
            <span className={m.change_quantity>0?'inventory-increase':'inventory-decrease'}>{m.change_quantity>0?'+':''}{m.change_quantity} units</span>
            <small>{m.previous_stock} → {m.new_stock}</small>
          </article>)}</div>}
        </section>
      </> : activeTab === 'activity' ? <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Activity size={17}/></span><strong>Admin activity <small>({activityLogs.length})</small></strong></div><button className="admin-link" onClick={loadActivityLogs}><RefreshCw size={13}/> Refresh logs</button></div>
        <p className="admin-shipping-help">Important product, stock, order, return aur coupon changes ka record. Customer addresses, payment details ya passwords yahan store nahi hote.</p>
        <div className="admin-activity-filters">
          <input value={activitySearch} onChange={e=>setActivitySearch(e.target.value)} placeholder="Search action or item…" aria-label="Search activity logs"/>
          <select value={activityFilter} onChange={e=>setActivityFilter(e.target.value)} aria-label="Filter activity type">
            <option value="all">All activity</option><option value="product">Products</option><option value="order">Orders</option><option value="return">Returns</option><option value="coupon">Coupons</option>
          </select>
        </div>
        {activityBusy ? <div className="admin-empty">Activity logs load ho rahe hain…</div> :
          activityLogs.filter(log => (activityFilter==='all'||log.entity_type===activityFilter) && [log.actor_name,log.action,log.entity_label,log.summary].join(' ').toLowerCase().includes(activitySearch.trim().toLowerCase())).length===0 ?
          <div className="admin-empty">Abhi koi matching admin activity record nahi hai. Naye admin changes yahan automatically log honge.</div> :
          <div className="admin-activity-list">{activityLogs.filter(log => (activityFilter==='all'||log.entity_type===activityFilter) && [log.actor_name,log.action,log.entity_label,log.summary].join(' ').toLowerCase().includes(activitySearch.trim().toLowerCase())).map(log=><article className="admin-activity-row" key={log.id}>
            <div className="admin-activity-icon"><Activity size={15}/></div>
            <div className="admin-activity-content"><div className="admin-activity-top"><strong>{log.entity_label}</strong><span className={'admin-activity-type activity-'+log.entity_type}>{log.entity_type}</span></div>
              <p>{log.summary}</p><small>{log.actor_name} · {new Date(log.created_at).toLocaleString('en-IN')}</small>
            </div>
            <code>{log.action}</code>
          </article>)}</div>}
        <p className="admin-shipping-help">Showing the latest 200 records. Full history remains stored in the database.</p>
      </section> : activeTab === 'coupons' ? <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Save size={17}/></span><strong>Coupons & discounts</strong></div><button className="admin-link" onClick={loadCoupons}><RefreshCw size={13}/> Refresh</button></div>
        <form className="admin-coupon-form" onSubmit={createCoupon}>
          <strong>Create a coupon</strong>
          <label>Coupon code<input required minLength={3} maxLength={32} value={couponCode} onChange={e=>setCouponCode(e.target.value.toUpperCase())} placeholder="e.g. PUASH10"/></label>
          <div className="admin-coupon-grid">
            <label>Discount type<select value={couponType} onChange={e=>setCouponType(e.target.value as 'percentage'|'fixed')}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (₹)</option></select></label>
            <label>Discount value<input type="number" min="0.01" step="0.01" max={couponType==='percentage'?100:undefined} required value={couponValue} onChange={e=>setCouponValue(e.target.value)}/></label>
            <label>Minimum order (₹)<input type="number" min="0" step="0.01" value={couponMinimum} onChange={e=>setCouponMinimum(e.target.value)}/></label>
            <label>Maximum discount (₹)<input type="number" min="0.01" step="0.01" value={couponMaximum} onChange={e=>setCouponMaximum(e.target.value)} placeholder="No cap"/></label>
            <label>Usage limit<input type="number" min="1" step="1" value={couponLimit} onChange={e=>setCouponLimit(e.target.value)} placeholder="Unlimited"/></label>
            <label>Uses per customer<input type="number" min="1" step="1" required value={couponPerUser} onChange={e=>setCouponPerUser(e.target.value)}/></label>
            <label>Expiry date<input type="datetime-local" value={couponExpiry} onChange={e=>setCouponExpiry(e.target.value)}/></label>
          </div>
          <button className="admin-link" type="submit" disabled={busy}><Plus size={14}/> Create coupon</button>
        </form>
        <div className="admin-coupon-list">
          {busy ? <div className="admin-empty">Coupons load ho rahe hain…</div> : coupons.length===0 ? <div className="admin-empty">Abhi koi coupon nahi bana.</div> : coupons.map(c=><article className="admin-coupon-card" key={c.id}>
            <div><strong>{c.code}</strong><small>{c.discount_type==='percentage'?c.discount_value+'% off':money(Number(c.discount_value))+' off'} · Min. {money(Number(c.min_order_amount))}</small><small>{c.usage_count}{c.usage_limit===null?'': ' / '+c.usage_limit} uses · {c.per_user_limit} per customer</small>{c.expires_at&&<small>Expires {new Date(c.expires_at).toLocaleString('en-IN')}</small>}</div>
            <button className="admin-link" disabled={orderBusy===c.id} onClick={()=>toggleCoupon(c)}>{c.is_active?'Deactivate':'Activate'}</button>
            <span className={'admin-customer-order-status '+(c.is_active?'status-delivered':'status-cancelled')}>{c.is_active?'Active':'Inactive'}</span>
          </article>)}
        </div>
      </section> : activeTab === 'returns' ? <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><RefreshCw size={17}/></span><strong>Return requests <small>({returnRequests.length})</small></strong></div><button className="admin-link" onClick={loadReturnRequests}><RefreshCw size={13}/> Refresh</button></div>
        <p className="admin-shipping-help">Review customer requests. Approving a return does not automatically issue a refund; payment/refund must be handled separately.</p>
        {busy ? <div className="admin-empty">Return requests load ho rahi hain…</div> : returnRequests.length===0 ? <div className="admin-empty">Abhi koi return request nahi hai.</div> : <div className="admin-customer-list">{returnRequests.map(item=><article className="admin-customer-card" key={item.id}>
          <div className="admin-customer-summary"><span className="admin-customer-avatar"><Package size={18}/></span><span className="admin-customer-identity"><strong>Order #{item.order_id.slice(0,8).toUpperCase()}</strong><small>{item.reason.replaceAll('_',' ')} · {new Date(item.requested_at).toLocaleString('en-IN')}</small><small>{item.orders?.shipping_address?.full_name || 'Customer'} · {money(Number(item.orders?.total_amount || 0))}</small></span><span className={'admin-customer-order-status status-'+item.status}>{item.status.replaceAll('_',' ')}</span></div>
          {item.details && <p className="admin-shipping-help">Customer note: {item.details}</p>}
          <textarea className="admin-return-note" value={returnNotes[item.id] ?? item.admin_note ?? ''} onChange={e=>setReturnNotes(prev=>({...prev,[item.id]:e.target.value}))} placeholder="Internal/customer response note (optional)" maxLength={1500}/>
          <div className="admin-return-actions">
            {item.status==='pending' && <><button className="admin-link" disabled={orderBusy===item.id} onClick={()=>updateReturnRequest(item.id,'approved')}>Approve return</button><button className="admin-link" disabled={orderBusy===item.id} onClick={()=>updateReturnRequest(item.id,'rejected')}>Reject</button></>}
            {item.status==='approved' && <button className="admin-link" disabled={orderBusy===item.id} onClick={()=>updateReturnRequest(item.id,'item_received')}>Mark item received</button>}
            {item.status==='item_received' && <button className="admin-link" disabled={orderBusy===item.id} onClick={()=>updateReturnRequest(item.id,'refunded')}>Mark refunded</button>}
            {orderBusy===item.id && <small>Saving…</small>}
          </div>
        </article>)}</div>}
      </section> : activeTab === 'customers' ? <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Users size={17}/></span><strong>Customer directory <small>({customers.length})</small></strong></div><button className="admin-link" onClick={loadCustomers}><RefreshCw size={13}/> Refresh list</button></div>
        <input className="admin-product-search" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Search customer name or email…" aria-label="Search customers"/>
        {customerLoading ? <div className="admin-empty">Customers load ho rahe hain…</div> : customers.filter(customer => (customer.full_name || '').toLowerCase().includes(customerSearch.toLowerCase()) || (customer.email || '').toLowerCase().includes(customerSearch.toLowerCase())).length === 0 ? <div className="admin-empty">Koi customer nahi mila.</div> :
          <div className="admin-customer-list">{customers.filter(customer => (customer.full_name || '').toLowerCase().includes(customerSearch.toLowerCase()) || (customer.email || '').toLowerCase().includes(customerSearch.toLowerCase())).map(customer => {
            const customerOrders = genuineOrders.filter(order => order.user_id === customer.customer_id).sort((x,y)=>new Date(y.created_at).getTime()-new Date(x.created_at).getTime());
            const expanded = selectedCustomerId === customer.customer_id;
            return <article className="admin-customer-card" key={customer.customer_id}>
              <button className="admin-customer-summary" onClick={()=>setSelectedCustomerId(expanded ? null : customer.customer_id)} aria-expanded={expanded}>
                <span className="admin-customer-avatar"><UserRound size={18}/></span>
                <span className="admin-customer-identity"><strong>{customer.full_name || 'Customer'}</strong><small>{customer.email || 'Email not available'}</small><small>Joined {new Date(customer.joined_at).toLocaleDateString('en-IN')}</small></span>
                <span className="admin-customer-stats"><strong>{customer.order_count} orders</strong><small>{money(Number(customer.delivered_spend || 0))} delivered</small></span>
                {expanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
              </button>
              {expanded && <div className="admin-customer-history">
                <strong>Order history</strong>
                {customerOrders.length === 0 ? <p>Is customer ka abhi koi order nahi hai.</p> : customerOrders.map(order=><div className="admin-customer-order" key={order.id}><span><b>#{order.id.slice(0,8).toUpperCase()}</b><small>{new Date(order.created_at).toLocaleDateString('en-IN')}</small></span><span><b>{money(Number(order.total_amount))}</b><small className={'admin-customer-order-status status-'+order.status}>{order.status}</small></span></div>)}
              </div>}
            </article>;
          })}</div>}
      </section> : <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><ClipboardList size={17}/></span><strong>Customer orders <small>({orders.length})</small></strong></div><div className="admin-order-tools"><button className="admin-link" onClick={exportOrdersCsv}><Download size={13}/> Export CSV</button><button className="admin-link" onClick={loadOrders}>Refresh list</button></div></div>
        <div className="admin-order-filters">
          <input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Search order ID, customer, phone or PIN…" aria-label="Search orders"/>
          <select value={orderStatusFilter} onChange={e=>setOrderStatusFilter(e.target.value)} aria-label="Filter by order status">
            <option value="all">All statuses</option>
            {['pending','confirmed','processing','shipped','delivered','cancelled'].map(status=><option key={status} value={status}>{status.charAt(0).toUpperCase()+status.slice(1)}</option>)}
          </select>
        </div>
        {orders.length === 0 ? <div className="admin-empty">Abhi koi real customer order nahi hai. Jab customer checkout karega, orders yahan dikhne lagenge.</div> : <div className="admin-order-list">{orders.filter(order => {
          const address = order.shipping_address || {};
          const haystack = [order.id,address.full_name,address.phone,address.postal_code,address.city].join(' ').toLowerCase();
          return (orderStatusFilter === 'all' || order.status === orderStatusFilter) && haystack.includes(orderSearch.trim().toLowerCase());
        }).map(order => {
          const address = order.shipping_address || {};
          return <article className="admin-order-card" key={order.id}>
            <div className="admin-order-top"><div><strong>Order #{order.id.slice(0, 8).toUpperCase()}</strong><small>{new Date(order.created_at).toLocaleString('en-IN')}</small></div><strong>{money(Number(order.total_amount))}</strong></div>
            <div className="admin-order-address"><strong>{address.full_name || 'Customer'}</strong><span>{address.phone || 'No phone'} · {address.label || 'Address'}</span><span>{[address.line1,address.line2,address.city,address.state,address.postal_code,address.country].filter(Boolean).join(', ') || 'No delivery address saved'}</span></div>
            <div className="admin-order-items">{(order.order_items || []).map(item => <div key={item.id}><span>{item.product_name} × {item.quantity}</span><strong>{money(Number(item.unit_price) * item.quantity)}</strong></div>)}</div>
            <div className="admin-order-summary">
              <span>Subtotal <b>{money(Number(order.subtotal_amount ?? order.total_amount))}</b></span>
              <span>Delivery <b>{Number(order.delivery_fee || 0) === 0 ? 'Free' : money(Number(order.delivery_fee))}</b></span>
              <span>Payment <b>{order.payment_method === 'cash_on_delivery' ? 'Cash on Delivery' : order.payment_method}</b></span>
            </div>
            {order.customer_note && (order.customer_note.startsWith('INTERNAL TEST ORDER') ? <p className="admin-order-note admin-test-order"><strong>INTERNAL TEST ORDER — DO NOT FULFIL</strong><span>{order.customer_note}</span></p> : <p className="admin-order-note">Note: {order.customer_note}</p>)}
            <div className="admin-order-actions"><span className={'admin-status ' + (order.status === 'delivered' ? 'live' : '')}>{order.status}</span><select value={order.status} disabled={orderBusy === order.id || order.status === 'delivered' || order.status === 'cancelled'} onChange={e => updateOrderStatus(order.id,e.target.value)} aria-label="Update order status">{[order.status,...(order.status === 'pending' ? ['confirmed','cancelled'] : order.status === 'confirmed' ? ['processing','cancelled'] : order.status === 'processing' ? ['shipped','cancelled'] : order.status === 'shipped' ? ['delivered'] : [])].map(status => <option key={status} value={status}>{status.charAt(0).toUpperCase()+status.slice(1)}</option>)}</select>{orderBusy === order.id && <small>Saving…</small>}</div>
            <div className="admin-shipping-editor">
              <strong>Shipping details</strong>
              <div className="admin-shipping-fields">
                <input value={(shippingDrafts[order.id]?.courier ?? order.courier_name) || ''} onChange={e=>setShippingDrafts(prev=>({...prev,[order.id]:{courier:e.target.value,tracking:prev[order.id]?.tracking ?? order.tracking_number ?? ''}}))} placeholder="Courier / delivery partner" aria-label="Courier name"/>
                <input value={(shippingDrafts[order.id]?.tracking ?? order.tracking_number) || ''} onChange={e=>setShippingDrafts(prev=>({...prev,[order.id]:{courier:prev[order.id]?.courier ?? order.courier_name ?? '',tracking:e.target.value}}))} placeholder="Tracking / AWB number" aria-label="Tracking number"/>
              </div>
              <button className="admin-link" disabled={orderBusy===order.id} onClick={()=>saveShippingDetails(order)}><Save size={13}/> Save shipping details</button>
              {(order.shipped_at || order.delivered_at) && <small>{order.shipped_at ? 'Dispatched: '+new Date(order.shipped_at).toLocaleString('en-IN') : ''}{order.delivered_at ? ' · Delivered: '+new Date(order.delivered_at).toLocaleString('en-IN') : ''}</small>}
            </div>
          </article>;
        })}</div>}
        {orders.length > 0 && orders.filter(order => { const address=order.shipping_address || {}; const haystack=[order.id,address.full_name,address.phone,address.postal_code,address.city].join(' ').toLowerCase(); return (orderStatusFilter==='all'||order.status===orderStatusFilter)&&haystack.includes(orderSearch.trim().toLowerCase()); }).length===0 && <div className="admin-empty">Is search ya status ke liye koi order nahi mila.</div>}
      </section>}</main>
  </div>;
}
