import { FormEvent, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, BarChart3, ClipboardList, LogOut, Package, Plus, RefreshCw, Save, ShieldCheck, X, AlertTriangle, TrendingUp } from 'lucide-react';

type Category = { id: string; name: string };
type OrderItem = { id: string; product_name: string; unit_price: number; quantity: number };
type Order = { id: string; user_id: string; status: string; total_amount: number; subtotal_amount: number | null; delivery_fee: number; payment_method: string; shipping_address: any; customer_note: string | null; created_at: string; order_items: OrderItem[] };
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'orders'>('sales');
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
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

  const loadOrders = async () => {
    const { data, error } = await supabase.from('orders')
      .select('id,user_id,status,total_amount,subtotal_amount,delivery_fee,payment_method,shipping_address,customer_note,created_at,order_items(id,product_name,unit_price,quantity)')
      .order('created_at', { ascending: false });
    if (error) setMessage('Orders load nahi hue: ' + error.message);
    else setOrders((data || []) as Order[]);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!['pending','confirmed','processing','shipped','delivered','cancelled'].includes(status)) return;
    setOrderBusy(orderId); setMessage('');
    const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
    setOrderBusy(null);
    if (error) setMessage('Order status update nahi hua: ' + error.message);
    else { setMessage('Order status update ho gaya.'); await loadOrders(); }
  };

  useEffect(() => { if (isAdmin) { loadData(); loadOrders(); } }, [isAdmin]);

  const resetForm = () => {
    setEditing(null); setName(''); setDescription(''); setPrice('');
    setComparePrice(''); setStock('1'); setImageUrl(''); setImageFile(null);
    setActive(true); if (categories[0]) setCategoryId(categories[0].id);
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
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) { setMessage('Stock quantity 0 ya usse zyada whole number honi chahiye.'); return; }
    if (imageFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024)) { setMessage('Image JPG, PNG ya WebP ho aur 5 MB se chhoti ho.'); return; }
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
      ? await supabase.from('products').update(payload).eq('id', editing)
      : await supabase.from('products').insert(payload);
    setBusy(false);
    if (result.error) {
      if (uploadedImagePath) await supabase.storage.from('product-images').remove([uploadedImagePath]);
      setMessage('Save nahi hua: ' + result.error.message);
      return;
    }
    setMessage(editing ? 'Product update ho gaya.' : 'Product add ho gaya.');
    resetForm(); await loadData();
  };

  const editProduct = (p: Product) => {
    setEditing(p.id); setName(p.name); setDescription(p.description || '');
    setPrice(String(p.price)); setComparePrice(p.compare_at_price ? String(p.compare_at_price) : '');
    setStock(String(p.stock_quantity)); setCategoryId(p.category_id || categories[0]?.id || '');
    setImageUrl(p.image_url || ''); setImageFile(null); setActive(p.is_active);
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
  const lowStockProducts = products.filter(product => product.stock_quantity <= 5).sort((a,b) => a.stock_quantity - b.stock_quantity);

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
      <div className="admin-title-row"><div><div className="admin-kicker">STORE CONTROL</div><h1>{activeTab === 'sales' ? 'Sales dashboard' : activeTab === 'products' ? 'Products' : 'Orders'}</h1><p>{activeTab === 'sales' ? 'Your store performance at a glance.' : activeTab === 'products' ? 'Add, edit and publish products on your PUASH store.' : 'Review customer orders and update their fulfilment status.'}</p></div><button className="admin-refresh" onClick={() => { loadData(); loadOrders(); }}><RefreshCw size={16}/> Refresh</button></div>
      <nav className="admin-tabs"><button className={activeTab === 'sales' ? 'active' : ''} onClick={() => setActiveTab('sales')}><BarChart3 size={16}/> Dashboard</button><button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}><Package size={16}/> Products <span>{products.length}</span></button><button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}><ClipboardList size={16}/> Orders <span>{genuineOrders.length}</span></button></nav>
      {message && <div className="admin-message">{message}<button onClick={()=>setMessage('')}><X size={14}/></button></div>}
      {activeTab === 'sales' ? <section className="admin-sales-dashboard">
        <div className="admin-sales-note">Figures exclude internal test orders. Sales total below counts delivered orders only.</div>
        <div className="admin-sales-metrics">
          <article><span><ClipboardList size={17}/> Total orders</span><strong>{genuineOrders.length}</strong><small>Including cancelled orders</small></article>
          <article><span><TrendingUp size={17}/> Delivered sales</span><strong>{money(deliveredSales)}</strong><small>{deliveredOrders.length} delivered orders</small></article>
          <article><span><Package size={17}/> Order value</span><strong>{money(orderValue)}</strong><small>All non-cancelled orders</small></article>
          <article><span><BarChart3 size={17}/> Units ordered</span><strong>{unitsSold}</strong><small>Across non-cancelled orders</small></article>
        </div>
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
      </section> : activeTab === 'products' ? <>
<section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Package size={17}/></span><strong>{editing ? 'Edit product' : 'Add a product'}</strong></div>{editing && <button className="admin-link" onClick={resetForm}>Cancel edit</button>}</div>
        <form className="admin-form admin-product-form" onSubmit={saveProduct}>
          <label>Product name<input value={name} onChange={e=>setName(e.target.value)} required placeholder="e.g. Pashmina stole"/></label>
          <label>Category<select value={categoryId} onChange={e=>setCategoryId(e.target.value)} required><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Price (₹)<input type="number" min="1" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} required placeholder="999"/></label>
          <label>MRP / Compare price (₹)<input type="number" min="0" step="0.01" value={comparePrice} onChange={e=>setComparePrice(e.target.value)} placeholder="Optional"/></label>
          <label>Stock quantity<input type="number" min="0" step="1" value={stock} onChange={e=>setStock(e.target.value)} required/></label>
          <label className="admin-wide">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Product details…"/></label>
          <label className="admin-wide">Product image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setImageFile(e.target.files?.[0] || null)}/><small>JPG, PNG or WebP · Maximum 5 MB</small></label>
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
            <div className="admin-row-actions"><button onClick={()=>editProduct(p)}>Edit</button><button onClick={()=>toggleActive(p)}>{p.is_active ? 'Hide' : 'Publish'}</button></div>
          </article>)}</div>}
      </section>
    
      </> : <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-icon"><ClipboardList size={17}/></span><strong>Customer orders <small>({orders.length})</small></strong></div><button className="admin-link" onClick={loadOrders}>Refresh list</button></div>
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
            <div className="admin-order-actions"><span className={'admin-status ' + (order.status === 'delivered' ? 'live' : '')}>{order.status}</span><select value={order.status} disabled={orderBusy === order.id} onChange={e => updateOrderStatus(order.id,e.target.value)} aria-label="Update order status">{['pending','confirmed','processing','shipped','delivered','cancelled'].map(status => <option key={status} value={status}>{status.charAt(0).toUpperCase()+status.slice(1)}</option>)}</select>{orderBusy === order.id && <small>Saving…</small>}</div>
          </article>;
        })}</div>}
        {orders.length > 0 && orders.filter(order => { const address=order.shipping_address || {}; const haystack=[order.id,address.full_name,address.phone,address.postal_code,address.city].join(' ').toLowerCase(); return (orderStatusFilter==='all'||order.status===orderStatusFilter)&&haystack.includes(orderSearch.trim().toLowerCase()); }).length===0 && <div className="admin-empty">Is search ya status ke liye koi order nahi mila.</div>}
      </section>}</main>
  </div>;
}
