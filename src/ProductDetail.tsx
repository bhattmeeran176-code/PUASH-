import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Minus, Plus, ShoppingBag, Truck, Star, MessageSquare, UserRound } from 'lucide-react';
import { supabase } from './supabase';

type ProductInfo = {
  id: string; name: string; description: string; price: number; mrp: number;
  imageUrl: string | null; stock: number; category: string;
};
type Review = {
  id: string; user_id: string; rating: number; title: string | null;
  body: string; created_at: string;
};

const money = (value: number) => '₹' + value.toLocaleString('en-IN');

export default function ProductDetail() {
  const productId = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] || '');
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [ownReview, setOwnReview] = useState<Review | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewError, setReviewError] = useState('');

  const loadReviews = async () => {
    setReviewsLoading(true);
    const [{ data: reviewData, error: reviewLoadError }, { data: authData }] = await Promise.all([
      supabase.from('product_reviews').select('id,user_id,rating,title,body,created_at').eq('product_id', productId).order('created_at', { ascending: false }),
      supabase.auth.getUser(),
    ]);
    if (!reviewLoadError) setReviews((reviewData || []) as Review[]);
    const currentUserId = authData.user?.id || null;
    setUserId(currentUserId);
    if (currentUserId) {
      const [{ data: purchaseData }, { data: ownData }] = await Promise.all([
        supabase.from('order_items').select('id,orders!inner(user_id,status)').eq('product_id', productId).eq('orders.user_id', currentUserId).eq('orders.status', 'delivered').limit(1),
        supabase.from('product_reviews').select('id,user_id,rating,title,body,created_at').eq('product_id', productId).eq('user_id', currentUserId).maybeSingle(),
      ]);
      setCanReview(Boolean(purchaseData?.length));
      const existing = (ownData || null) as Review | null;
      setOwnReview(existing);
      if (existing) {
        setRating(existing.rating);
        setReviewTitle(existing.title || '');
        setReviewBody(existing.body);
      }
    } else {
      setCanReview(false);
      setOwnReview(null);
    }
    setReviewsLoading(false);
  };

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
          id: data.id, name: data.name,
          description: data.description || 'Discover this product on PUASH.',
          price: Number(data.price), mrp: Number(data.compare_at_price ?? data.price),
          imageUrl: data.image_url || null, stock: Number(data.stock_quantity || 0),
          category: category || 'Other',
        });
      }
      setLoading(false);
    }
    loadProduct();
    loadReviews();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { loadReviews(); });
    return () => { cancelled = true; authListener.subscription.unsubscribe(); };
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

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !canReview || reviewBusy) return;
    setReviewBusy(true); setReviewError(''); setReviewMessage('');
    const { error } = await supabase.from('product_reviews').upsert({
      product_id: productId, user_id: userId, rating,
      title: reviewTitle.trim() || null, body: reviewBody.trim(),
    }, { onConflict: 'product_id,user_id' });
    setReviewBusy(false);
    if (error) {
      setReviewError(error.message.includes('product_reviews') ? 'Review save nahi hua. Thodi der baad dobara try karein.' : error.message);
      return;
    }
    setReviewMessage('Aapka review save ho gaya. Shukriya!');
    await loadReviews();
  };

  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

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
        <>
          <article className="detail-layout">
            <div className="detail-gallery">
              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="detail-image-placeholder">🛍️</div>}
            </div>
            <section className="detail-information">
              <div className="eyebrow">PUASH COLLECTION · {product.category.toUpperCase()}</div>
              <h1>{product.name}</h1>
              <div className="detail-review-summary"><span className="detail-review-stars"><Star size={15} fill="currentColor"/> {averageRating ? averageRating.toFixed(1) : 'New'}</span><span>{reviews.length} {reviews.length===1?'review':'reviews'}</span></div>
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
          </article>

          <section className="product-reviews-section">
            <div className="product-reviews-heading"><div><span className="eyebrow">CUSTOMER FEEDBACK</span><h2>Ratings & reviews</h2></div><div className="product-review-total"><Star size={17} fill="currentColor"/><strong>{averageRating ? averageRating.toFixed(1) : '—'}</strong><small>{reviews.length} reviews</small></div></div>
            <div className="product-review-content">
              <div className="product-review-list">
                {reviewsLoading ? <p className="review-empty">Reviews load ho rahe hain…</p> :
                  reviews.length===0 ? <div className="review-empty"><MessageSquare size={22}/><strong>Abhi koi review nahi hai</strong><span>Delivered order ke baad apna experience share karein.</span></div> :
                  reviews.map(review=><article className="product-review-card" key={review.id}>
                    <div className="product-review-card-top"><div className="product-review-stars">{[1,2,3,4,5].map(n=><Star key={n} size={13} fill={n<=review.rating?'currentColor':'none'}/>)}</div><small>{new Date(review.created_at).toLocaleDateString('en-IN',{dateStyle:'medium'})}</small></div>
                    {review.title && <strong className="product-review-title">{review.title}</strong>}
                    <p>{review.body}</p><span className="verified-review"><CheckCircle2 size={12}/> Verified purchase</span>
                  </article>)}
              </div>
              <div className="product-review-form-wrap">
                <h3>{ownReview ? 'Edit your review' : 'Write a review'}</h3>
                {!userId ? <p className="review-form-note"><UserRound size={15}/> Review dene ke liye <a href="/account">sign in</a> karein.</p> :
                  !canReview ? <p className="review-form-note">Review sirf us customer ke liye available hai jiska order delivered ho chuka hai.</p> :
                  <form className="product-review-form" onSubmit={submitReview}>
                    <label>Your rating</label>
                    <div className="review-rating-picker" role="group" aria-label="Choose a rating">{[1,2,3,4,5].map(n=><button type="button" key={n} className={n<=rating?'selected':''} onClick={()=>setRating(n)} aria-label={n+' stars'}><Star size={23} fill={n<=rating?'currentColor':'none'}/></button>)}</div>
                    <label htmlFor="review-title">Review title (optional)</label><input id="review-title" maxLength={80} value={reviewTitle} onChange={e=>setReviewTitle(e.target.value)} placeholder="A short headline"/>
                    <label htmlFor="review-body">Your experience</label><textarea id="review-body" required minLength={5} maxLength={1500} rows={4} value={reviewBody} onChange={e=>setReviewBody(e.target.value)} placeholder="What did you think about this product?"/>
                    <button className="primary-button" disabled={reviewBusy}>{reviewBusy?'Saving…':ownReview?'Update review':'Submit review'}</button>
                  </form>}
                {reviewMessage && <p className="review-form-success"><CheckCircle2 size={15}/>{reviewMessage}</p>}
                {reviewError && <p className="review-form-error">{reviewError}</p>}
              </div>
            </div>
          </section>
        </>}
      </main>
      <footer className="detail-footer">PUASH · Shopping, made simple.</footer>
    </div>
  );
}
