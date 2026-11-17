import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Store, ShieldCheck, PackagePlus, Package, RefreshCw } from 'lucide-react';
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
type SellerProduct = { id:string; name:string; description:string|null; price:number; compare_at_price:number|null; stock_quantity:number; image_url:string|null; is_active:boolean; created_at:string };

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
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [categories, setCategories] = useState<{id:string;name:string}[]>([]);
  const [productBusy, setProductBusy] = useState(false);
  const [productMessage, setProductMessage] = useState('');
  const [productError, setProductError] = useState('');
  const [productForm, setProductForm] = useState({name:'',description:'',price:'',compare_at_price:'',stock_quantity:'1',image_url:'',category_id:''});
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [editingProduct,setEditingProduct]=useState<string|null>(null);

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

  const loadSellerProducts = async () => {
    if (!application) return;
    const [{data:items,error:itemsError},{data:cats}] = await Promise.all([
      supabase.from('products').select('id,name,description,price,compare_at_price,stock_quantity,image_url,is_active,created_at').eq('seller_application_id',application.id).order('created_at',{ascending:false}),
      supabase.from('categories').select('id,name').eq('is_active',true).order('name')
    ]);
    if(itemsError){setProductError('Products load nahi hue: '+itemsError.message);return;}
    setProducts((items||[]) as SellerProduct[]);
    setCategories(cats||[]);
  };

  const addSellerProduct = async (event: FormEvent) => {
    event.preventDefault();
    if(!application || application.status!=='approved' || productBusy) return;
    const price=Number(productForm.price), mrp=productForm.compare_at_price===''?null:Number(productForm.compare_at_price), stock=Number(productForm.stock_quantity);
    if(!productForm.name.trim() || !Number.isFinite(price) || price<=0 || !Number.isInteger(stock) || stock<0 || (mrp!==null && (!Number.isFinite(mrp)||mrp<price))){setProductError('Name, valid price, stock aur MRP check karein.');return;}
    let imageUrl:string|null=productForm.image_url.trim()||null;
    if(imageUrl){try{const url=new URL(imageUrl);if(!['https:','http:'].includes(url.protocol))throw new Error();imageUrl=url.toString();}catch{setProductError('Valid image URL dein.');return;}}
    setProductBusy(true);setProductError('');setProductMessage('');
    if(imageFile){
      if(!['image/jpeg','image/png','image/webp'].includes(imageFile.type)||imageFile.size>5*1024*1024){setProductBusy(false);setProductError('JPG, PNG ya WebP image upload karein (maximum 5 MB).');return;}
      const ext=imageFile.type==='image/png'?'png':imageFile.type==='image/webp'?'webp':'jpg';
      const path='seller/'+user.id+'/'+crypto.randomUUID()+'.'+ext;
      const {error:uploadError}=await supabase.storage.from('product-images').upload(path,imageFile,{contentType:imageFile.type,upsert:false});
      if(uploadError){setProductBusy(false);setProductError('Image upload nahi hui: '+uploadError.message);return;}
      imageUrl=supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }
    const slug=productForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+crypto.randomUUID().slice(0,8);
    const payload={category_id:productForm.category_id||null,name:productForm.name.trim(),description:productForm.description.trim()||null,price,compare_at_price:mrp,image_url:imageUrl,stock_quantity:stock,is_active:false};
    const result=editingProduct?await supabase.from('products').update(payload).eq('id',editingProduct).eq('seller_application_id',application.id).eq('is_active',false):await supabase.from('products').insert({...payload,seller_application_id:application.id,slug});
    setProductBusy(false);
    if(result.error){setProductError('Product save nahi hua: '+result.error.message);return;}
    setProductForm({name:'',description:'',price:'',compare_at_price:'',stock_quantity:'1',image_url:'',category_id:''});setImageFile(null);setEditingProduct(null);
    setProductMessage('Product draft save ho gaya. Admin approval se pehle storefront par visible nahi hoga.');
    await loadSellerProducts();
  };

  useEffect(()=>{if(application?.status==='approved')void loadSellerProducts();},[application?.id,application?.status]);

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
      ) : application?.status === 'approved' ? (
        <section className="seller-dashboard">
          <div className="seller-panel seller-status-panel"><CheckCircle2 size={28}/><h2>{application.shop_name}</h2><p>Your seller account is approved. Products submitted here remain unpublished until PUASH admin review.</p></div>
          <form className="seller-panel seller-form" onSubmit={addSellerProduct}>
            <div className="seller-form-heading"><div><span className="seller-kicker">SELLER CATALOGUE</span><h2><PackagePlus size={20}/> {editingProduct?'Edit product draft':'Add a product'}</h2></div></div>
            <label>Product name<input required minLength={2} maxLength={160} value={productForm.name} onChange={e=>setProductForm(v=>({...v,name:e.target.value}))} placeholder="Product name"/></label>
            <label>Category<select value={productForm.category_id} onChange={e=>setProductForm(v=>({...v,category_id:e.target.value}))}><option value="">Choose category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Selling price (₹)<input required type="number" min="0.01" step="0.01" value={productForm.price} onChange={e=>setProductForm(v=>({...v,price:e.target.value}))}/></label>
            <label>MRP (₹) <span className="seller-optional">optional</span><input type="number" min="0.01" step="0.01" value={productForm.compare_at_price} onChange={e=>setProductForm(v=>({...v,compare_at_price:e.target.value}))}/></label>
            <label>Available stock<input required type="number" min="0" step="1" value={productForm.stock_quantity} onChange={e=>setProductForm(v=>({...v,stock_quantity:e.target.value}))}/></label>
            <label>Product image URL <span className="seller-optional">or upload image</span><input type="url" value={productForm.image_url} onChange={e=>setProductForm(v=>({...v,image_url:e.target.value}))} placeholder="https://…"/><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setImageFile(e.target.files?.[0]||null)}/><span className="seller-optional">JPG, PNG, WebP · max 5 MB</span></label>
            <label className="seller-full-field">Description<textarea rows={4} maxLength={5000} value={productForm.description} onChange={e=>setProductForm(v=>({...v,description:e.target.value}))}/></label>
            {productError&&<div className="seller-error" role="alert">{productError}</div>}{productMessage&&<div className="seller-success" role="status">{productMessage}</div>}
            <button className="seller-submit" type="submit" disabled={productBusy}>{productBusy?'Saving…':editingProduct?'Save draft changes':'Submit product for review'}</button>
          </form>
          <section className="seller-panel"><div className="seller-form-heading"><h2><Package size={20}/> My products</h2><button type="button" className="seller-refresh" onClick={loadSellerProducts}><RefreshCw size={15}/> Refresh</button></div>
            {products.length===0?<p className="seller-footnote">Abhi koi product submit nahi hua.</p>:products.map(p=><article className="seller-product-row" key={p.id}>{p.image_url&&<img src={p.image_url} alt="" /> }<div><strong>{p.name}</strong><span>₹{Number(p.price).toLocaleString('en-IN')} · Stock {p.stock_quantity}</span><small>{p.is_active?'Published':'Pending admin review'}</small>{!p.is_active&&<button type="button" className="seller-edit" onClick={()=>{setEditingProduct(p.id);setProductForm({name:p.name,description:p.description||'',price:String(p.price),compare_at_price:p.compare_at_price==null?'':String(p.compare_at_price),stock_quantity:String(p.stock_quantity),image_url:p.image_url||'',category_id:''});setProductMessage('Editing draft: '+p.name);}}>Edit draft</button>}</div></article>)}
          </section>
        </section>
      ) : application && application.status !== 'pending' ? (
        <section className="seller-panel seller-status-panel"><CheckCircle2 size={28}/><h2>Application {application.status}</h2><p>Your application was not approved at this time.</p>{application.admin_note&&<div className="seller-admin-note"><strong>Admin note</strong><span>{application.admin_note}</span></div>}</section>
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
