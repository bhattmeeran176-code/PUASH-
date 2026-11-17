import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Store, ShieldCheck } from 'lucide-react';
import { supabase } from './supabase';

type SellerApplication = {
  id: string;
  shop_name: string;
  contact_name: string;
  phone: string;
  category: string;
  pickup_address: string;
  city: string;
  district: string;
  postal_code: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
};

const emptyForm = {
  shop_name: '', contact_name: '', phone: '', category: 'General store',
  pickup_address: '', city: '', district: '', postal_code: '', notes: '',
};

export default function Seller() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [application, setApplication] = useState<SellerApplication | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async (current: any) => {
      if (!alive) return;
      setUser(current);
      if (!current) { setReady(true); return; }
      const { data, error: loadError } = await supabase
        .from('seller_applications')
        .select('id,shop_name,contact_name,phone,category,pickup_address,city,district,postal_code,notes,status,admin_note')
        .eq('user_id', current.id)
        .maybeSingle();
      if (!alive) return;
      if (loadError) setError('Seller application load nahi hui: ' + loadError.message);
      if (data) {
        setApplication(data as SellerApplication);
        setForm({
          shop_name: data.shop_name, contact_name: data.contact_name, phone: data.phone,
          category: data.category, pickup_address: data.pickup_address, city: data.city,
          district: data.district, postal_code: data.postal_code, notes: data.notes || '',
        });
      }
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { if (alive) void load(session?.user ?? null); }, 0);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const update = (key: keyof typeof emptyForm, value: string) => setForm(current => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true); setError(''); setMessage('');
    const payload = {
      user_id: user.id,
      shop_name: form.shop_name.trim(),
      contact_name: form.contact_name.trim(),
      phone: form.phone.trim(),
      category: form.category,
      pickup_address: form.pickup_address.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      postal_code: form.postal_code.trim(),
      notes: form.notes.trim() || null,
    };
    const result = application
      ? await supabase.from('seller_applications').update(payload).eq('user_id', user.id).eq('status', 'pending').select('id,shop_name,contact_name,phone,category,pickup_address,city,district,postal_code,notes,status,admin_note').single()
      : await supabase.from('seller_applications').insert(payload).select('id,shop_name,contact_name,phone,category,pickup_address,city,district,postal_code,notes,status,admin_note').single();
    setBusy(false);
    if (result.error) { setError(result.error.message || 'Application submit nahi hui. Please try again.'); return; }
    setApplication(result.data as SellerApplication);
    setMessage(application ? 'Pending application update ho gayi.' : 'Seller application successfully submit ho gayi. Admin review ke baad status update hoga.');
  };

  if (!ready) return <main className="seller-page"><div className="seller-panel">Loading seller portal…</div></main>;

  return (
    <main className="seller-page">
      <a className="seller-back" href="/"><ArrowLeft size={16}/> Back to PUASH</a>
      <section className="seller-hero">
        <div className="seller-hero-icon"><Store size={27}/></div>
        <span className="seller-kicker">PUASH PARTNER PROGRAM</span>
        <h1>Bring your shop online.</h1>
        <p>Apply to list your shop on PUASH. Our team will review your details before seller access is enabled.</p>
      </section>

      {!user ? (
        <section className="seller-panel seller-login-panel">
          <ShieldCheck size={28}/>
          <h2>Sign in to apply</h2>
          <p>You need a PUASH customer account before submitting a shop application.</p>
          <a className="seller-submit" href="/account">Go to account</a>
        </section>
      ) : application && application.status !== 'pending' ? (
        <section className="seller-panel seller-status-panel">
          <CheckCircle2 size={28}/>
          <h2>Application {application.status}</h2>
          <p>{application.status === 'approved' ? 'Your shop application has been approved. Seller tools will be enabled after the seller dashboard rollout.' : 'Your application was not approved at this time.'}</p>
          {application.admin_note && <div className="seller-admin-note"><strong>Admin note</strong><span>{application.admin_note}</span></div>}
        </section>
      ) : (
        <form className="seller-panel seller-form" onSubmit={submit}>
          <div className="seller-form-heading">
            <div><span className="seller-kicker">SELLER APPLICATION</span><h2>{application ? 'Update shop details' : 'Shop details'}</h2></div>
            {application && <span className="seller-pending"><Clock3 size={13}/> Under review</span>}
          </div>
          <label>Shop name<input required minLength={2} maxLength={120} value={form.shop_name} onChange={e=>update('shop_name',e.target.value)} placeholder="e.g. Kashmir Home Store"/></label>
          <label>Owner / contact person<input required minLength={2} maxLength={120} value={form.contact_name} onChange={e=>update('contact_name',e.target.value)} placeholder="Full name"/></label>
          <label>Contact phone<input required type="tel" minLength={7} maxLength={20} value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="Shop contact number"/></label>
          <label>Shop category<select value={form.category} onChange={e=>update('category',e.target.value)}><option>General store</option><option>Electronics</option><option>Fashion</option><option>Home & Kitchen</option><option>Beauty</option><option>Stationery</option><option>Other</option></select></label>
          <label className="seller-full-field">Shop pickup address<textarea required minLength={8} maxLength={300} rows={3} value={form.pickup_address} onChange={e=>update('pickup_address',e.target.value)} placeholder="Full address where courier can collect parcels"/></label>
          <div className="seller-two-fields">
            <label>City / town<input required minLength={2} maxLength={100} value={form.city} onChange={e=>update('city',e.target.value)} placeholder="City"/></label>
            <label>District<input required minLength={2} maxLength={100} value={form.district} onChange={e=>update('district',e.target.value)} placeholder="District"/></label>
          </div>
          <label>Pickup PIN code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.postal_code} onChange={e=>update('postal_code',e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit PIN code"/></label>
          <label className="seller-full-field">Anything else? <span className="seller-optional">(optional)</span><textarea rows={3} maxLength={1000} value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Tell us about your shop or products"/></label>
          {error && <div className="seller-error" role="alert">{error}</div>}
          {message && <div className="seller-success" role="status">{message}</div>}
          <div className="seller-privacy-note"><ShieldCheck size={16}/> Your application is private and visible only to you and PUASH admins.</div>
          <button className="seller-submit" type="submit" disabled={busy}>{busy ? 'Submitting…' : application ? 'Update application' : 'Submit seller application'}</button>
        </form>
      )}
      <p className="seller-footnote">Submitting an application does not automatically create a seller account or publish products. PUASH admin approval is required.</p>
    </main>
  );
}
