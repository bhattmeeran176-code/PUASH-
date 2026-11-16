import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Minus, Plus, ShoppingBag, Truck } from 'lucide-react';
import { supabase } from './supabase';

type ProductInfo = {
  id: string; name: string; description: string; price: number; mrp: number;
  imageUrl: string | null; stock: number; category: string;
};

const money = (value: number) => '₹' + value.toLocaleString('en-IN');

export default function ProductDetail() {
  const productId = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] || '');
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadProduct() {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,description,price,compare_at_price,image_url,stock_quantity,categories(name)')
        .eq('id', productId)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        const category = Array.isArray(data.categories) ? data.categories[0]?.name : data.categories?.name;
        setProduct({
          id: data.id,
          name: data.name,
          description: data.description || 'Discover this product on PUASH.',
          price: Number(data.price),
          mrp: Number(data.compare_at_price ?? data.price),
          imageUrl: data.image_url || null,
          stock: Number(data.stock_quantity || 0),
          category: category || 'Other',
        });
      }
      setLoading(false);
    }
    loadProduct();
    return () => { cancelled = true; };
  }, [productId]);

  const addToCart = () => {
    if (!product || quantity < 1 || quantity > product.stock) return;
    try {
      const current = JSON.parse(localStorage.getItem('puash-cart') || '{}');
      const next = { ...current, [product.id]: Math.min(product.stock, (Number(current[product.id]) || 0) + quantity) };
      localStorage.setItem('puash-cart', JSON.stringify(next));
      setMessage('Cart mein add ho gaya!');
    } catch {
      setMessage('Cart update nahi ho saka. Dobara try karein.');
    }
  };

  return (
    <div className="product-detail-page">
      <header className="detail-header">
        <button className="detail-back" onClick={() => { window.location.href = '/'; }}><ArrowLeft size={18} /> PUASH store par wapas</button>
        <button className="detail-brand" onClick={() => { window.location.href = '/'; }}>PUASH<span>.</span></button>
        <button className="detail-cart-link" onClick={() => { window.location.href = '/'; }}>Continue shopping</button>
      </header>
      <main className="detail-main">
        {loading ? <div className="detail-state">Product details load ho rahi hain…</div> :
        !product ? <div className="detail-state"><h2>Product nahi mila</h2><p>Ye product available nahi hai ya publish nahi hua.</p><button className="primary-button" onClick={() => { window.location.href = '/'; }}>Store par wapas</button></div> :
        <article className="detail-layout">
          <div className="detail-gallery">
            {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="detail-image-placeholder">🛍️</div>}
          </div>
          <section className="detail-information">
            <div className="eyebrow">PUASH COLLECTION · {product.category.toUpperCase()}</div>
            <h1>{product.name}</h1>
            <div className="detail-prices"><strong>{money(product.price)}</strong>{product.mrp > product.price && <><del>{money(product.mrp)}</del><span>{Math.round((1-product.price/product.mrp)*100)}% off</span></>}</div>
            <div className={product.stock > 0 ? 'detail-availability' : 'detail-availability out'}><span />{product.stock > 0 ? product.stock + ' pieces available' : 'Currently out of stock'}</div>
            <div className="detail-description"><h2>Product description</h2><p>{product.description}</p></div>
            <div className="detail-delivery"><Truck size={18} /><span><strong>Delivery information</strong><small>Delivery options and charges will be shown at checkout.</small></span></div>
            {product.stock > 0 && <div className="detail-buy-row">
              <div className="detail-quantity"><button aria-label="Decrease quantity" onClick={() => setQuantity(q => Math.max(1,q-1))}><Minus size={16}/></button><strong>{quantity}</strong><button aria-label="Increase quantity" onClick={() => setQuantity(q => Math.min(product.stock,q+1))}><Plus size={16}/></button></div>
              <button className="primary-button detail-add-button" onClick={addToCart}><ShoppingBag size={17}/> Add to cart</button>
            </div>}
            {message && <div className="detail-success"><CheckCircle2 size={16}/>{message}</div>}
            <p className="detail-note">Product information is provided by the PUASH store.</p>
          </section>
        </article>}
      </main>
      <footer className="detail-footer">PUASH · Shopping, made simple.</footer>
    </div>
  );
}
