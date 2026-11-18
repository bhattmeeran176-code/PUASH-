import { FormEvent, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { registerPuashPushNotifications, unregisterPuashPushNotifications } from './pushNotifications';
import { ArrowLeft, Bell, CheckCircle2, LogOut, MapPin, Plus, ShieldCheck, Trash2, UserRound, X, Package, RefreshCw, ChevronDown, ChevronUp, Heart, Volume2, VolumeX } from 'lucide-react';

type CustomerOrder = {
  id: string;
  status: string;
  total_amount: number;
  subtotal_amount: number | null;
  delivery_fee: number;
  payment_method: string;
  shipping_address: any;
  created_at: string;
  courier_name: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  coupon_code: string | null;
  discount_amount: number;
  order_return_requests?: { id: string; reason: string; details: string | null; status: string; admin_note: string | null; requested_at: string }[];
  order_items: { id: string; product_name: string; unit_price: number; quantity: number }[];
};

type CustomerSellerFulfillment = {order_id:string;shop_name:string;fulfillment_status:string;seller_subtotal:number;updated_at:string};
type CustomerRefundStatus = {order_id:string;shop_name:string;status:string;refund_amount:number|null;created_at:string;processed_at:string|null};
type CustomerCancellationRequest = {id:string;order_id:string;reason:string;details:string|null;status:string;admin_note:string|null;requested_at:string;reviewed_at:string|null};

type Address = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  district: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

const blankAddress = {
  label: 'Home', full_name: '', phone: '', line1: '', line2: '',
  city: '', district: 'Srinagar', state: 'Jammu and Kashmir', postal_code: '', country: 'India',
  is_default: false,
};

export default function Account() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [fullName, setFullName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [savedProducts, setSavedProducts] = useState<any[]>([]);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [sellerFulfillments,setSellerFulfillments]=useState<CustomerSellerFulfillment[]>([]);
  const [refundStatuses,setRefundStatuses]=useState<CustomerRefundStatus[]>([]);
  const [cancellationRequests,setCancellationRequests]=useState<CustomerCancellationRequest[]>([]);
  const [cancellationDrafts,setCancellationDrafts]=useState<Record<string,{reason:string;details:string}>>({});
  const [cancellationBusy,setCancellationBusy]=useState<string|null>(null);
  const ordersRef = useRef<CustomerOrder[]>([]);
  const [ordersBusy, setOrdersBusy] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(() => { try { return localStorage.getItem('puash-notification-sound') !== 'off'; } catch { return true; } });
  const notificationAudioRef = useRef<AudioContext | null>(null);
  const notificationSoundEnabledRef = useRef(notificationSoundEnabled);

  const playNotificationSound = (force = false) => {
    if (!force && !notificationSoundEnabledRef.current) return;
    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return;
      const context = notificationAudioRef.current || (notificationAudioRef.current = new AudioContextClass());
      void context.resume().then(() => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        oscillator.frequency.setValueAtTime(660, context.currentTime + 0.12);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(); oscillator.stop(context.currentTime + 0.3);
      }).catch(() => {});
    } catch { /* Audio is optional; notifications remain visible without it. */ }
  };

  const toggleNotificationSound = () => {
    const next = !notificationSoundEnabled;
    setNotificationSoundEnabled(next);
    notificationSoundEnabledRef.current = next;
    try { localStorage.setItem('puash-notification-sound', next ? 'on' : 'off'); } catch { /* Ignore unavailable storage. */ }
    if (next) playNotificationSound(true);
  };
  const [returnDrafts, setReturnDrafts] = useState<Record<string,{reason:string;details:string}>>({});
  const [returnBusy, setReturnBusy] = useState<string|null>(null);
  const [addressForm, setAddressForm] = useState(blankAddress);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const loadNotifications = async (userId: string) => {
    setNotificationsBusy(true);
    const { data, error: loadError } = await supabase.from('notifications').select('id,title,message,type,related_order_id,is_read,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(40);
    setNotificationsBusy(false);
    if (loadError) setError('Notifications load nahi hui: ' + loadError.message);
    else setNotifications(data || []);
  };

  const markNotificationRead = async (id: string) => {
    const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id);
    if (updateError) setError('Notification update nahi hui: ' + updateError.message);
    else setNotifications(items => items.map(item => item.id === id ? { ...item, is_read: true } : item));
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (updateError) setError('Notifications update nahi hui: ' + updateError.message);
    else setNotifications(items => items.map(item => ({ ...item, is_read: true })));
  };

  const loadRecentlyViewed = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('puash-recently-viewed') || '[]');
      setRecentProducts(Array.isArray(stored) ? stored.filter((item: any) => item?.id).slice(0, 8) : []);
    } catch { setRecentProducts([]); }
  };

  const loadProfile = async (current: any) => {
    setUser(current);
    loadRecentlyViewed();
    if (current) {
      void loadNotifications(current.id);
      const [{ data, error: profileError }, { data: addressData, error: addressError }, { data: orderData, error: orderError }, { data: wishlistData, error: wishlistError }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', current.id).maybeSingle(),
        supabase.from('customer_addresses').select('*').eq('user_id', current.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('orders').select('id,status,total_amount,subtotal_amount,delivery_fee,payment_method,shipping_address,created_at,courier_name,tracking_number,shipped_at,delivered_at,coupon_code,discount_amount,order_items(id,product_name,unit_price,quantity),order_return_requests(id,reason,details,status,admin_note,requested_at)').eq('user_id', current.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('wishlists').select('id,product_id,products(id,name,price,image_url,stock_quantity,is_active)').eq('user_id', current.id).order('created_at', { ascending: false }),
      ]);
      if (profileError) setError('Profile load nahi hua: ' + profileError.message);
      if (addressError) setError('Address book load nahi hua: ' + addressError.message);
      if (orderError) setError('Orders load nahi huye: ' + orderError.message);
      if (wishlistError) setError('Wishlist load nahi hui: ' + wishlistError.message);
      const name = data?.full_name || current.user_metadata?.full_name || '';
      setFullName(name);
      setSavedName(name);
      setAddresses((addressData || []) as Address[]);
      setSavedProducts((wishlistData || []).filter((row: any) => row.products?.is_active).map((row: any) => ({...row.products, wishlistId: row.id})));
      ordersRef.current = (orderData || []) as CustomerOrder[];
      setOrders(ordersRef.current);
      const orderIds=ordersRef.current.map(order=>order.id);
      const {data:cancellationData,error:cancellationError}=await supabase.from('order_cancellation_requests').select('id,order_id,reason,details,status,admin_note,requested_at,reviewed_at').in('order_id',orderIds.length?orderIds:['00000000-0000-0000-0000-000000000000']).order('requested_at',{ascending:false});if(cancellationError)setError('Cancellation requests load nahi hui: '+cancellationError.message);else setCancellationRequests((cancellationData||[]) as CustomerCancellationRequest[]);
      if(orderIds.length){const [{data:fulfillmentData,error:fulfillmentError},{data:refundData,error:refundError}]=await Promise.all([supabase.rpc('customer_order_fulfillments',{p_order_ids:orderIds}),supabase.rpc('customer_order_refund_statuses',{p_order_ids:orderIds})]);if(fulfillmentError)setError('Seller delivery updates load nahi huye: '+fulfillmentError.message);else setSellerFulfillments((fulfillmentData||[]) as CustomerSellerFulfillment[]);if(refundError)setError('Refund updates load nahi huye: '+refundError.message);else setRefundStatuses((refundData||[]) as CustomerRefundStatus[]);}else {setSellerFulfillments([]);setRefundStatuses([]);}
    } else {
      setAddresses([]);
      setNotifications([]);
      setSavedProducts([]);
      ordersRef.current = [];
      setOrders([]);
      setSellerFulfillments([]);
      setRefundStatuses([]);
      setCancellationRequests([]);
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
    let cancelled = false;
    let removeListeners = () => {};
    void registerPuashPushNotifications(user.id).then(remove => {
      if (cancelled) remove();
      else removeListeners = remove;
    });
    return () => {
      cancelled = true;
      removeListeners();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('puash-customer-notifications-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + user.id }, payload => {
        setNotifications(items => [payload.new as any, ...items].slice(0, 40));
        playNotificationSound();
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

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
        const changed = payload.new as CustomerOrder;
        const oldOrder = ordersRef.current.find(order => order.id === changed.id);
        if (!oldOrder) return;
        const statusChanged = oldOrder.status !== changed.status;
        const shippingChanged = oldOrder.courier_name !== changed.courier_name || oldOrder.tracking_number !== changed.tracking_number;
        if (!statusChanged && !shippingChanged) return;
        const labels: Record<string, string> = {
          pending: 'Order received', confirmed: 'Confirmed',
          processing: 'Preparing', shipped: 'Shipped',
          delivered: 'Delivered', cancelled: 'Cancelled',
        };
        playNotificationSound();
        setStatusNotification(shippingChanged && !statusChanged
          ? 'Shipping details updated for order #' + changed.id.slice(0, 8).toUpperCase() + '.'
          : 'Your PUASH order #' + changed.id.slice(0, 8).toUpperCase() + ' is now: ' + (labels[changed.status] || changed.status) + '.');
        ordersRef.current = ordersRef.current.map(order => order.id === changed.id
          ? { ...order, status: changed.status, courier_name: changed.courier_name, tracking_number: changed.tracking_number, shipped_at: changed.shipped_at, delivered_at: changed.delivered_at }
          : order
        );
        setOrders(ordersRef.current);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('puash-return-requests-' + user.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'order_return_requests',
        filter: 'user_id=eq.' + user.id,
      }, (payload) => {
        const changed = payload.new as { id: string; order_id: string; status: string; admin_note: string | null; reason: string; details: string | null; requested_at: string };
        ordersRef.current = ordersRef.current.map(order => order.id === changed.order_id
          ? { ...order, order_return_requests: (order.order_return_requests || []).map(request => request.id === changed.id ? changed : request) }
          : order);
        setOrders(ordersRef.current);
        playNotificationSound();
        setStatusNotification('PUASH updated your return request for order #' + changed.order_id.slice(0,8).toUpperCase() + '.');
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const submitCancellationRequest = async (order: CustomerOrder) => {
    if (!user || !['pending','confirmed','processing'].includes(order.status) || cancellationRequests.some(item=>item.order_id===order.id)) return;
    const draft=cancellationDrafts[order.id]||{reason:'changed_mind',details:''};
    setCancellationBusy(order.id);setError('');setMessage('');
    const {data,error:requestError}=await supabase.from('order_cancellation_requests').insert({order_id:order.id,user_id:user.id,reason:draft.reason,details:draft.details.trim()||null}).select('id,order_id,reason,details,status,admin_note,requested_at,reviewed_at').single();
    setCancellationBusy(null);
    if(requestError)setError('Cancellation request submit nahi hui: '+requestError.message);
    else {setCancellationRequests(items=>[data as CustomerCancellationRequest,...items]);setMessage('Cancellation request submit ho gayi. PUASH team review karegi.');}
  };

  const submitReturnRequest = async (order: CustomerOrder) => {
    if (!user || order.status !== 'delivered' || order.order_return_requests?.length) return;
    const draft = returnDrafts[order.id] || { reason: 'damaged', details: '' };
    setReturnBusy(order.id); setError(''); setMessage('');
    const { error: requestError } = await supabase.from('order_return_requests').insert({
      order_id: order.id, user_id: user.id, reason: draft.reason, details: draft.details.trim() || null,
    });
    setReturnBusy(null);
    if (requestError) setError('Return request submit nahi hui: ' + requestError.message);
    else {
      setMessage('Return request submit ho gayi. PUASH team review karegi.');
      const { data, error: reloadError } = await supabase.from('orders')
        .select('id,status,total_amount,subtotal_amount,delivery_fee,payment_method,shipping_address,created_at,courier_name,tracking_number,shipped_at,delivered_at,coupon_code,discount_amount,order_items(id,product_name,unit_price,quantity),order_return_requests(id,reason,details,status,admin_note,requested_at)')
        .eq('id', order.id).eq('user_id', user.id).single();
      if (!reloadError && data) {
        ordersRef.current = ordersRef.current.map(item => item.id === order.id ? data as CustomerOrder : item);
        setOrders(ordersRef.current);
      }
    }
  };

  const requestPhoneOtp = async () => {
    const rawPhone = phoneNumber.trim();
    const digits = rawPhone.replace(/\D/g, '');
    const normalizedPhone = rawPhone.startsWith('+') ? '+' + digits : digits.length === 10 ? '+91' + digits : '';
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError('Valid phone number enter karein, country code ke saath. India ke liye 10-digit number bhi chalega.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (otpError) setError('OTP send nahi hua: ' + otpError.message);
    else {
      setPhoneNumber(normalizedPhone);
      setPhoneOtp('');
      setPhoneOtpSent(true);
      setMessage('OTP SMS ke through bhej diya gaya hai. Apna 6-digit code enter karein.');
      // Play a short in-app confirmation tone after the OTP request succeeds.
      playNotificationSound(true);
    }
  };

  const verifyPhoneOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(phoneOtp.trim())) {
      setError('6-digit OTP enter karein.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: phoneNumber,
      token: phoneOtp.trim(),
      type: 'sms',
    });
    setBusy(false);
    if (verifyError) setError('OTP verify nahi hua: ' + verifyError.message);
    else {
      setMessage('Phone number verify ho gaya. PUASH mein welcome!');
      playNotificationSound(true);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true); setError(''); setMessage('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/account' },
    });
    if (oauthError) {
      setBusy(false);
      setError('Google sign-in start nahi hua: ' + oauthError.message);
    }
  };

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
      line1: address.line1, line2: address.line2 || '', city: address.city, district: address.district || 'Srinagar',
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
        <button type="button" className="account-primary" disabled={busy} onClick={() => void signInWithGoogle()}>
          {busy ? 'Connecting…' : 'Continue with Google'}
        </button>
        <p className="account-auth-note">Google ke secure sign-in se login karein. First login par PUASH account automatically create ho jayega.</p>
      </> : <>
                <h1>My account.</h1>
        <p>Apni profile aur delivery addresses yahan manage karein.</p>
        <div className="account-email"><small>Signed in as</small><strong>{user.email || user.phone || 'Phone account'}</strong></div>
        <section className="account-notifications">
          <div className="address-book-heading">
            <div><Bell size={18}/><strong>Notifications</strong><span className="customer-order-count">{notifications.filter(item => !item.is_read).length}</span></div>
            <button type="button" className="address-add" onClick={toggleNotificationSound} aria-pressed={notificationSoundEnabled} title={notificationSoundEnabled ? 'Turn notification sound off' : 'Turn notification sound on'}>{notificationSoundEnabled ? <Volume2 size={14}/> : <VolumeX size={14}/>} Sound {notificationSoundEnabled ? 'on' : 'off'}</button>
            <div className="notification-actions">
              <button type="button" className="address-add" disabled={!notifications.some(item => !item.is_read)} onClick={markAllNotificationsRead}>Mark all read</button>
              <button type="button" className="address-add" disabled={notificationsBusy} onClick={() => loadNotifications(user.id)}><RefreshCw size={14}/> Refresh</button>
            </div>
          </div>
          <p className="address-hint">Order, shipping aur return request ke updates yahan milenge.</p>
          {notificationsBusy ? <div className="address-empty">Notifications load ho rahi hain…</div> : notifications.length === 0 ? <div className="address-empty">Abhi koi notification nahi hai.</div> :
            <div className="notification-list">{notifications.map(item => <article className={'notification-item ' + (item.is_read ? 'is-read' : 'is-unread')} key={item.id}>
              <div className="notification-copy"><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</small></div>
              {!item.is_read && <button type="button" onClick={() => markNotificationRead(item.id)}>Mark read</button>}
              {item.related_order_id && <a href="#orders" onClick={() => setExpandedOrderId(item.related_order_id)}>View order</a>}
            </article>)}</div>}
        </section>
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
            <p>{[address.line1,address.line2,address.city,address.district,address.state,address.postal_code,address.country].filter(Boolean).join(', ')}</p>
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
            <label>District<select required value={addressForm.district} onChange={e=>setAddressForm({...addressForm,district:e.target.value})} ><option>Anantnag</option><option>Bandipora</option><option>Baramulla</option><option>Budgam</option><option>Doda</option><option>Ganderbal</option><option>Jammu</option><option>Kathua</option><option>Kishtwar</option><option>Kulgam</option><option>Kupwara</option><option>Poonch</option><option>Pulwama</option><option>Rajouri</option><option>Ramban</option><option>Reasi</option><option>Samba</option><option>Shopian</option><option>Srinagar</option><option>Udhampur</option></select></label>
            <label>State<input required minLength={2} maxLength={100} value={addressForm.state} onChange={e=>setAddressForm({...addressForm,state:e.target.value})}/></label>
            <label>PIN code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={addressForm.postal_code} onChange={e=>setAddressForm({...addressForm,postal_code:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="190001"/></label>
            <label className="address-default-check"><input type="checkbox" checked={addressForm.is_default} onChange={e=>setAddressForm({...addressForm,is_default:e.target.checked})}/> Set as my default address</label>
            <button className="account-primary" disabled={addressBusy}>{addressBusy ? 'Saving address…' : editingAddress ? 'Update address' : 'Save address'}</button>
          </form>}
        </div>
        <section className="account-wishlist">
          <div className="address-book-heading"><div><Heart size={18}/><strong>My wishlist</strong><span className="customer-order-count">{savedProducts.length}</span></div></div>
          <p className="address-hint">Aapke saved products yahan milenge.</p>
          {savedProducts.length===0 ? <div className="address-empty">Wishlist abhi empty hai. Store par heart button tap karke products save karein.</div> :
            <div className="account-wishlist-grid">{savedProducts.map(product=><article className="account-wishlist-item" key={product.id}>
              {product.image_url ? <img src={product.image_url} alt={product.name}/> : <div className="account-wishlist-placeholder">🛍️</div>}
              <strong>{product.name}</strong><span>₹{Number(product.price).toLocaleString('en-IN')}</span>
              <div><a href={'/product/'+product.id}>View product</a><button type="button" onClick={async()=>{const {error:removeError}=await supabase.from('wishlists').delete().eq('product_id',product.id).eq('user_id',user.id);if(removeError)setError('Wishlist se remove nahi hua: '+removeError.message);else setSavedProducts(items=>items.filter(item=>item.id!==product.id));}}>Remove</button></div>
            </article>)}</div>}
        </section>
        <section className="account-wishlist recent-viewed-section">
          <div className="address-book-heading"><div><Package size={18}/><strong>Recently viewed</strong><span className="customer-order-count">{recentProducts.length}</span></div>
            {recentProducts.length > 0 && <button type="button" className="address-add" onClick={() => { localStorage.removeItem('puash-recently-viewed'); setRecentProducts([]); }}>Clear</button>}
          </div>
          <p className="address-hint">Jo products aapne haal hi mein dekhe, woh yahan hain.</p>
          {recentProducts.length===0 ? <div className="address-empty">Abhi koi recently viewed product nahi hai. Store par products dekhein.</div> :
            <div className="account-wishlist-grid">{recentProducts.map(product=><article className="account-wishlist-item" key={product.id}>
              {product.image_url ? <img src={product.image_url} alt={product.name}/> : <div className="account-wishlist-placeholder">🛍️</div>}
              <strong>{product.name}</strong><span>₹{Number(product.price).toLocaleString('en-IN')}</span>
              <div><a href={'/product/'+product.id}>View product</a></div>
            </article>)}</div>}
        </section>
        <section className="customer-orders" id="orders">
          {statusNotification && <div className="order-live-notice"><CheckCircle2 size={16}/><span>{statusNotification}</span><button type="button" onClick={()=>setStatusNotification('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
          <div className="address-book-heading">
            <div><Package size={18}/><strong>My orders</strong><span className="customer-order-count">{orders.length}</span></div>
            <button type="button" className="address-add" disabled={ordersBusy} onClick={async()=>{
              if (!user) return;
              setOrdersBusy(true);
              const {data,error:loadError}=await supabase.from('orders').select('id,status,total_amount,subtotal_amount,delivery_fee,payment_method,shipping_address,created_at,courier_name,tracking_number,shipped_at,delivered_at,coupon_code,discount_amount,order_items(id,product_name,unit_price,quantity),order_return_requests(id,reason,details,status,admin_note,requested_at)').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30);
              if(loadError) setError('Orders refresh nahi huye: '+loadError.message);
              else {
                ordersRef.current = (data||[]) as CustomerOrder[]; setOrders(ordersRef.current);
                const orderIds=ordersRef.current.map(order=>order.id);
                if(orderIds.length){const [{data:fulfillmentData,error:fulfillmentError},{data:refundData,error:refundError}]=await Promise.all([supabase.rpc('customer_order_fulfillments',{p_order_ids:orderIds}),supabase.rpc('customer_order_refund_statuses',{p_order_ids:orderIds})]);if(fulfillmentError)setError('Seller delivery updates refresh nahi huye: '+fulfillmentError.message);else setSellerFulfillments((fulfillmentData||[]) as CustomerSellerFulfillment[]);if(refundError)setError('Refund updates refresh nahi huye: '+refundError.message);else setRefundStatuses((refundData||[]) as CustomerRefundStatus[]);}
                else {setSellerFulfillments([]);setRefundStatuses([]);}
              }
              setOrdersBusy(false);
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
                {refundStatuses.filter(item=>item.order_id===order.id).length>0&&<section className="customer-seller-tracking customer-refund-status"><strong>Refund updates</strong>{refundStatuses.filter(item=>item.order_id===order.id).map((item,index)=><div className="customer-seller-tracking-row" key={item.order_id+'-refund-'+index}><div><b>{item.shop_name}</b><small>{item.refund_amount===null?'Amount under review':'Refund amount · ₹'+Number(item.refund_amount).toLocaleString('en-IN')}{item.processed_at?' · Updated '+new Date(item.processed_at).toLocaleDateString('en-IN'):''}</small></div><span className={'customer-order-status status-'+item.status}>{item.status.replace(/_/g,' ')}</span></div>)}</section>}{sellerFulfillments.filter(item=>item.order_id===order.id).length>0&&<section className="customer-seller-tracking"><strong><Package size={15}/> Seller-wise fulfilment</strong>{sellerFulfillments.filter(item=>item.order_id===order.id).map(item=><div className="customer-seller-tracking-row" key={item.order_id+'-'+item.shop_name}><div><b>{item.shop_name}</b><small>Seller item subtotal · ₹{Number(item.seller_subtotal).toLocaleString('en-IN')}</small></div><span className={'customer-order-status status-'+item.fulfillment_status}>{item.fulfillment_status.replace(/_/g,' ')}</span></div>)}</section>}
                <div className="customer-order-lines">{(order.order_items||[]).map(item=><div key={item.id}><span>{item.product_name} × {item.quantity}</span><b>₹{(Number(item.unit_price)*item.quantity).toLocaleString('en-IN')}</b></div>)}</div>
                <div className="customer-order-total"><span>Total · {order.payment_method==='cash_on_delivery'?'Cash on Delivery':order.payment_method}</span><strong>₹{Number(order.total_amount).toLocaleString('en-IN')}</strong></div>
                {['pending','confirmed','processing'].includes(order.status)&&<div className="customer-return-panel customer-cancel-panel"><strong>Cancel order request</strong>{cancellationRequests.filter(item=>item.order_id===order.id).length>0?(()=>{const request=cancellationRequests.find(item=>item.order_id===order.id)!;return <div className="customer-return-status"><span>Request status: <b>{request.status.replace(/_/g,' ')}</b></span><small>{request.admin_note||'PUASH team is reviewing your request.'}</small></div>;})():<><p>Cancellation request PUASH team approve karegi. Order abhi cancel nahi hoga.</p><select value={cancellationDrafts[order.id]?.reason||'changed_mind'} onChange={e=>setCancellationDrafts(prev=>({...prev,[order.id]:{reason:e.target.value,details:prev[order.id]?.details||''}}))}><option value="changed_mind">Changed my mind</option><option value="ordered_by_mistake">Ordered by mistake</option><option value="delivery_too_late">Delivery taking too long</option><option value="other">Other reason</option></select><textarea maxLength={1000} value={cancellationDrafts[order.id]?.details||''} onChange={e=>setCancellationDrafts(prev=>({...prev,[order.id]:{reason:prev[order.id]?.reason||'changed_mind',details:e.target.value}}))} placeholder="Additional details (optional)"/><button type="button" disabled={cancellationBusy===order.id} onClick={()=>submitCancellationRequest(order)}>{cancellationBusy===order.id?'Submitting…':'Request cancellation'}</button></>}</div>}
                {order.status==='cancelled' ? <p className="customer-order-cancelled">This order was cancelled.</p> : <div className="customer-order-progress">{steps.map((step,index)=><div className={current>=index?'done':''} key={step}><span></span><small>{labels[step]}</small></div>)}</div>}
                {order.courier_name || order.tracking_number ? <div className="customer-shipping-info">
                  <strong><Package size={15}/> Shipping information</strong>
                  {order.courier_name && <div><span>Courier</span><b>{order.courier_name}</b></div>}
                  {order.tracking_number && <div><span>Tracking / AWB number</span><b>{order.tracking_number}</b></div>}
                  {order.shipped_at && <div><span>Dispatched on</span><b>{new Date(order.shipped_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</b></div>}
                  {order.delivered_at && <div><span>Delivered on</span><b>{new Date(order.delivered_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</b></div>}
                  <small>Courier ki live location tracking abhi available nahi hai. Tracking number ko courier ki official website par check karein.</small>
                </div> : null}
                {order.status==='delivered' && <div className="customer-return-panel">
                  <strong>Return / refund request</strong>
                  {(order.order_return_requests || []).length > 0 ? <div className="customer-return-status">
                    <span>Request status: <b>{order.order_return_requests![0].status.replace(/_/g,' ')}</b></span>
                    <small>{order.order_return_requests![0].admin_note ? 'PUASH update: '+order.order_return_requests![0].admin_note : 'Your request is being reviewed by PUASH.'}</small>
                  </div> : <>
                    <p>If there is a problem with your delivered order, submit a return request for review.</p>
                    <select value={returnDrafts[order.id]?.reason || 'damaged'} onChange={e=>setReturnDrafts(prev=>({...prev,[order.id]:{reason:e.target.value,details:prev[order.id]?.details||''}}))}>
                      <option value="damaged">Item arrived damaged</option><option value="wrong_item">Wrong item received</option><option value="missing_item">Item missing</option><option value="not_as_described">Item not as described</option><option value="other">Other issue</option>
                    </select>
                    <textarea maxLength={1500} value={returnDrafts[order.id]?.details||''} onChange={e=>setReturnDrafts(prev=>({...prev,[order.id]:{reason:prev[order.id]?.reason||'damaged',details:e.target.value}}))} placeholder="Describe the issue (optional)"/>
                    <button type="button" disabled={returnBusy===order.id} onClick={()=>submitReturnRequest(order)}>{returnBusy===order.id?'Submitting…':'Submit return request'}</button>
                  </>}
                </div>}
                <p className="customer-order-destination">Delivering to: {[order.shipping_address?.full_name,order.shipping_address?.city,order.shipping_address?.postal_code].filter(Boolean).join(' · ')}</p>
                <button type="button" className="customer-order-details-toggle" aria-expanded={expandedOrderId===order.id} onClick={()=>setExpandedOrderId(expandedOrderId===order.id?null:order.id)}>
                  {expandedOrderId===order.id ? 'Hide order details' : 'View order details'}
                  {expandedOrderId===order.id ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                </button>
                {expandedOrderId===order.id && <div className="customer-order-details">
                  <div><span>Subtotal</span><strong>₹{Number(order.subtotal_amount ?? order.total_amount).toLocaleString('en-IN')}</strong></div>
                  <div><span>Delivery fee</span><strong>{Number(order.delivery_fee)===0?'Free':'₹'+Number(order.delivery_fee).toLocaleString('en-IN')}</strong></div>
                  {Number(order.discount_amount||0)>0 && <div className="customer-order-discount"><span>Coupon {order.coupon_code ? '('+order.coupon_code+')' : ''}</span><strong>−₹{Number(order.discount_amount).toLocaleString('en-IN')}</strong></div>}
                  <div><span>Payment method</span><strong>{order.payment_method==='cash_on_delivery'?'Cash on Delivery':order.payment_method}</strong></div>
                  <div className="customer-order-full-address"><span>Delivery address</span><strong>{[order.shipping_address?.full_name,order.shipping_address?.phone,order.shipping_address?.line1,order.shipping_address?.line2,order.shipping_address?.city,order.shipping_address?.state,order.shipping_address?.postal_code,order.shipping_address?.country].filter(Boolean).join(', ') || 'Address details unavailable'}</strong></div>
                </div>}
              </article>;
            })}
        </section>
        <button className="account-signout" onClick={async()=>{await unregisterPuashPushNotifications(user?.id);await supabase.auth.signOut();}}><LogOut size={16}/> Sign out</button>
      </>}
      {message && <div className="account-message"><CheckCircle2 size={16}/>{message}</div>}
      {error && <div className="account-error">{error}</div>}
    </section>
  </div>;
}
