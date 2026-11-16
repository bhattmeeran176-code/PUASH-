import { FormEvent, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, CheckCircle2, LogOut, MapPin, Plus, ShieldCheck, Trash2, UserRound, X, Package, RefreshCw } from 'lucide-react';

type CustomerOrder = {
  id: string;
  status: string;
  total_amount: number;
  subtotal_amount: number | null;
  delivery_fee: number;
  payment_method: string;
  shipping_address: any;
  created_at: string;
  order_items: { id: string; product_name: string; unit_price: number; quantity: number }[];
};

type Address = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

const blankAddress = {
  label: 'Home', full_name: '', phone: '', line1: '', line2: '',
  city: '', state: 'Jammu and Kashmir', postal_code: '', country: 'India',
  is_default: false,
};

export default function Account() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const ordersRef = useRef<CustomerOrder[]>([]);
  const [ordersBusy, setOrdersBusy] = useState(false);
  const [statusNotification, setStatusNotification] = useState('');
  const [addressForm, setAddressForm] = useState(blankAddress);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const loadProfile = async (current: any) => {
    setUser(current);
    if (current) {
      const [{ data, error: profileError }, { data: addressData, error: addressError }, { data: orderData, error: orderError }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', current.id).maybeSingle(),
        supabase.from('customer_addresses').select('*').eq('user_id', current.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('orders').select('id,status,total_amount,subtotal_amount,delivery_fee,payment_method,shipping_address,created_at,order_items(id,product_name,unit_price,quantity)').eq('user_id', current.id).order('created_at', { ascending: false }).limit(30),
      ]);
      if (profileError) setError('Profile load nahi hua: ' + profileError.message);
      if (addressError) setError('Address book load nahi hua: ' + addressError.message);
      if (orderError) setError('Orders load nahi huye: ' + orderError.message);
      const name = data?.full_name || current.user_metadata?.full_name || '';
      setFullName(name);
      setSavedName(name);
      setAddresses((addressData || []) as Address[]);
      ordersRef.current = (orderData || []) as CustomerOrder[];
      setOrders(ordersRef.current);
    } else {
      setAddresses([]);
      ordersRef.current = [];
      setOrders([]);
    }
    setReady(true);
  };

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) loadProfile(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) window.setTimeout(() => { if (alive) loadProfile(session?.user ?? null); }, 0);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('puash-customer-orders-' + user.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: 'user_id=eq.' + user.id,
      }, (payload) => {
        const changed = payload.new as { id: string; status: string };
        const oldOrder = ordersRef.current.find(order => order.id === changed.id);
        if (!oldOrder || oldOrder.status === changed.status) return;
        const labels: Record<string, string> = {
          pending: 'Order received', confirmed: 'Confirmed',
          processing: 'Preparing', shipped: 'Shipped',
          delivered: 'Delivered', cancelled: 'Cancelled',
        };
        setStatusNotification(
          'Your PUASH order #' + changed.id.slice(0, 8).toUpperCase() +
          ' is now: ' + (labels[changed.status] || changed.status) + '.'
        );
        ordersRef.current = ordersRef.current.map(order => order.id === changed.id
          ? { ...order, status: changed.status }
          : order
        );
        setOrders(ordersRef.current);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const authenticate = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: 'https://puash.pages.dev/account' }
        });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else if (mode === 'signup' && !result.data.session) setMessage('Account ban gaya! Email confirmation link par tap karein, phir yahan sign in karein.');
    else setMessage(mode === 'signup' ? 'Account create ho gaya.' : 'Welcome back!');
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true); setError(''); setMessage('');
    const { error: saveError } = await supabase.from('profiles')
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setBusy(false);
    if (saveError) setError('Profile save nahi hua: ' + saveError.message);
    else { setSavedName(fullName.trim()); setMessage('Profile update ho gaya.'); }
  };

  const saveAddress = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setAddressBusy(true); setError(''); setMessage('');
    if (addressForm.is_default) {
      const { error: clearError } = await supabase.from('customer_addresses').update({ is_default: false }).eq('user_id', user.id);
      if (clearError) { setAddressBusy(false); setError('Default address update nahi hua: ' + clearError.message); return; }
    }
    const payload = { ...addressForm, user_id: user.id, line2: addressForm.line2.trim() || null };
    const result = editingAddress
      ? await supabase.from('customer_addresses').update(payload).eq('id', editingAddress).eq('user_id', user.id)
      : await supabase.from('customer_addresses').insert(payload);
    setAddressBusy(false);
    if (result.error) { setError('Address save nahi hua: ' + result.error.message); return; }
    setMessage(editingAddress ? 'Address update ho gaya.' : 'Address save ho gaya.');
    setAddressForm(blankAddress); setEditingAddress(null); setShowAddressForm(false);
    await refreshAddresses();
  };

  const refreshAddresses = async () => {
    if (!user) return;
    const { data, error: loadError } = await supabase.from('customer_addresses').select('*')
      .eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false });
    if (loadError) setError('Address list refresh nahi hui: ' + loadError.message);
    else setAddresses((data || []) as Address[]);
  };

  const editAddress = (address: Address) => {
    setAddressForm({
      label: address.label, full_name: address.full_name, phone: address.phone,
      line1: address.line1, line2: address.line2 || '', city: address.city,
      state: address.state, postal_code: address.postal_code, country: address.country,
      is_default: address.is_default,
    });
    setEditingAddress(address.id); setShowAddressForm(true); setError(''); setMessage('');
  };

  const deleteAddress = async (id: string) => {
    if (!user) return;
    setAddressBusy(true); setError(''); setMessage('');
    const { error: deleteError } = await supabase.from('customer_addresses').delete().eq('id', id).eq('user_id', user.id);
    setAddressBusy(false);
    if (deleteError) setError('Address delete nahi hua: ' + deleteError.message);
    else { setMessage('Address delete ho gaya.'); await refreshAddresses(); }
  };

  const makeDefault = async (id: string) => {
    if (!user) return;
    setAddressBusy(true); setError(''); setMessage('');
    const { error: clearError } = await supabase.from('customer_addresses').update({ is_default: false }).eq('user_id', user.id);
    if (clearError) { setAddressBusy(false); setError(clearError.message); return; }
    const { error: setErrorResult } = await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id).eq('user_id', user.id);
    setAddressBusy(false);
    if (setErrorResult) setError('Default address set nahi hua: ' + setErrorResult.message);
    else { setMessage('Default delivery address update ho gaya.'); await refreshAddresses(); }
  };

  if (!ready) return <div className="account-screen"><div className="account-card">PUASH account load ho raha hai…</div></div>;

  return <div className="account-screen">
    <section className="account-card account-card-wide">
      <a className="account-back" href="/"><ArrowLeft size={16}/> PUASH store par wapas</a>
      <div className="account-brand">PUASH<span>.</span><small>YOUR ACCOUNT</small></div>
      <div className="account-icon">{user ? <UserRound size={26}/> : <ShieldCheck size={26}/>}</div>
      {!user ? <>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p>{mode === 'login' ? 'Sign in karke apna PUASH shopping account access karein.' : 'PUASH par apna customer account banayein.'}</p>
        <form className="account-form" onSubmit={authenticate}>
          {mode === 'signup' && <label>Full name<input value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" required placeholder="Your name"/></label>}
          <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com"/></label>
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required placeholder="At least 8 characters"/></label>
          <button className="account-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="account-switch" onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login');setMessage('');setError('')}}>
          {mode === 'login' ? 'New to PUASH? Create an account' : 'Already have an account? Sign in'}
        </button>
      </> : <>
        <h1>My account.</h1>
        <p>Apni profile aur delivery addresses yahan manage karein.</p>
        <div className="account-email"><small>Signed in as</small><strong>{user.email}</strong></div>
        <form className="account-form" onSubmit={saveProfile}>
          <label>Full name<input value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" placeholder="Your name"/></label>
          <button className="account-primary" disabled={busy || fullName.trim() === savedName}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>

        <div className="address-book">
          <div className="address-book-heading"><div><MapPin size={18}/><strong>Delivery addresses</strong></div><button type="button" className="address-add" onClick={()=>{setAddressForm({...blankAddress,full_name:fullName.trim()});setEditingAddress(null);setShowAddressForm(true);setError('');}}><Plus size={15}/> Add address</button></div>
          <p className="address-hint">Apne delivery addresses save karein. Aapka address sirf aapke account mein visible hoga.</p>
          {addresses.length === 0 && !showAddressForm && <div className="address-empty">Abhi koi address save nahi hai.</div>}
          {addresses.map(address=><article className="saved-address" key={address.id}>
            <div className="saved-address-top"><div><strong>{address.label}</strong>{address.is_default && <span>Default</span>}</div><div className="saved-address-actions"><button type="button" onClick={()=>editAddress(address)}>Edit</button><button type="button" disabled={addressBusy} onClick={()=>deleteAddress(address.id)} aria-label="Delete address"><Trash2 size={14}/></button></div></div>
            <strong>{address.full_name} · {address.phone}</strong>
            <p>{[address.line1,address.line2,address.city,address.state,address.postal_code,address.country].filter(Boolean).join(', ')}</p>
            {!address.is_default && <button type="button" className="address-default" disabled={addressBusy} onClick={()=>makeDefault(address.id)}>Set as default</button>}
          </article>)}
          {showAddressForm && <form className="account-form address-form" onSubmit={saveAddress}>
            <div className="address-form-heading"><strong>{editingAddress ? 'Edit delivery address' : 'Add delivery address'}</strong><button type="button" onClick={()=>{setShowAddressForm(false);setEditingAddress(null);setAddressForm(blankAddress);}} aria-label="Close address form"><X size={17}/></button></div>
            <label>Address label<select value={addressForm.label} onChange={e=>setAddressForm({...addressForm,label:e.target.value})}><option>Home</option><option>Work</option><option>Other</option></select></label>
            <label>Full name<input required maxLength={120} value={addressForm.full_name} onChange={e=>setAddressForm({...addressForm,full_name:e.target.value})} placeholder="Receiver name"/></label>
            <label>Phone number<input required type="tel" maxLength={20} value={addressForm.phone} onChange={e=>setAddressForm({...addressForm,phone:e.target.value})} placeholder="Contact number"/></label>
            <label>Address line 1<input required minLength={5} maxLength={240} value={addressForm.line1} onChange={e=>setAddressForm({...addressForm,line1:e.target.value})} placeholder="House, street, locality"/></label>
            <label>Address line 2 (optional)<input maxLength={240} value={addressForm.line2} onChange={e=>setAddressForm({...addressForm,line2:e.target.value})} placeholder="Landmark, area"/></label>
            <label>City / Town<input required minLength={2} maxLength={100} value={addressForm.city} onChange={e=>setAddressForm({...addressForm,city:e.target.value})} placeholder="Srinagar"/></label>
            <label>State<input required minLength={2} maxLength={100} value={addressForm.state} onChange={e=>setAddressForm({...addressForm,state:e.target.value})}/></label>
            <label>PIN code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={addressForm.postal_code} onChange={e=>setAddressForm({...addressForm,postal_code:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="190001"/></label>
            <label className="address-default-check"><input type="checkbox" checked={addressForm.is_default} onChange={e=>setAddressForm({...addressForm,is_default:e.target.checked})}/> Set as my default address</label>
            <button className="account-primary" disabled={addressBusy}>{addressBusy ? 'Saving address…' : editingAddress ? 'Update address' : 'Save address'}</button>
          </form>}
        </div>
        <section className="customer-orders">
          {statusNotification && <div className="order-live-notice"><CheckCircle2 size={16}/><span>{statusNotification}</span><button type="button" onClick={()=>setStatusNotification('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
          <div className="address-book-heading">
            <div><Package size={18}/><strong>My orders</strong><span className="customer-order-count">{orders.length}</span></div>
            <button type="button" className="address-add" disabled={ordersBusy} onClick={async()=>{
              if (!user) return;
              setOrdersBusy(true);
              const {data,error:loadError}=await supabase.from('orders').select('id,status,total_amount,subtotal_amount,delivery_fee,payment_method,shipping_address,created_at,order_items(id,product_name,unit_price,quantity)').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30);
              setOrdersBusy(false);
              if(loadError) setError('Orders refresh nahi huye: '+loadError.message);
              else setOrders((data||[]) as CustomerOrder[]);
            }}><RefreshCw size={14}/> Refresh</button>
          </div>
          <p className="address-hint">Apne recent orders aur delivery status yahan check karein.</p>
          {orders.length===0 ? <div className="address-empty">Abhi koi order nahi hai. Aapke placed orders yahan dikhne lagenge.</div> :
            orders.map(order=>{
              const steps=['pending','confirmed','processing','shipped','delivered'];
              const labels:Record<string,string>={pending:'Order received',confirmed:'Confirmed',processing:'Preparing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'};
              const current=steps.indexOf(order.status);
              return <article className="customer-order-card" key={order.id}>
                <div className="customer-order-top"><div><strong>Order #{order.id.slice(0,8).toUpperCase()}</strong><small>{new Date(order.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</small></div><span className={'customer-order-status status-'+order.status}>{labels[order.status]||order.status}</span></div>
                <div className="customer-order-lines">{(order.order_items||[]).map(item=><div key={item.id}><span>{item.product_name} × {item.quantity}</span><b>₹{(Number(item.unit_price)*item.quantity).toLocaleString('en-IN')}</b></div>)}</div>
                <div className="customer-order-total"><span>Total · {order.payment_method==='cash_on_delivery'?'Cash on Delivery':order.payment_method}</span><strong>₹{Number(order.total_amount).toLocaleString('en-IN')}</strong></div>
                {order.status==='cancelled' ? <p className="customer-order-cancelled">This order was cancelled.</p> : <div className="customer-order-progress">{steps.map((step,index)=><div className={current>=index?'done':''} key={step}><span></span><small>{labels[step]}</small></div>)}</div>}
                <p className="customer-order-destination">Delivering to: {[order.shipping_address?.full_name,order.shipping_address?.city,order.shipping_address?.postal_code].filter(Boolean).join(' · ')}</p>
              </article>;
            })}
        </section>
        <button className="account-signout" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sign out</button>
      </>}
      {message && <div className="account-message"><CheckCircle2 size={16}/>{message}</div>}
      {error && <div className="account-error">{error}</div>}
    </section>
  </div>;
}
