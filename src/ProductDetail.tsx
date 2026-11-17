import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Minus, Plus, ShoppingBag, Truck, Star, MessageSquare, UserRound, Heart } from 'lucide-react';
import { supabase } from './supabase';

type ProductInfo = {
  id: string; name: string; description: string; price: number; mrp: number;
  imageUrl: string | null; stock: number; category: string;
};
type ProductVariant = { id: string; product_id: string; label: string; price: number | null; stock_quantity: number; };
type Review = {
  id: string; user_id: string; rating: number; title: string | null;
  body: string; created_at: string;
};

const money = (value: number) => '₹' + value.toLocaleString('en-IN');

export default function ProductDetail() {
  const productId = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] || '');
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
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
  const [wishlistSaved, setWishlistSaved] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  useEffect(() => { setImageFailed(false); }, [activeImage]);

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
      const [{ data: purchaseData }, { data: ownData }, { data: savedData }] = await Promise.all([
        supabase.from('order_items').select('id,orders!inner(user_id,status)').eq('product_id', productId).eq('orders.user_id', currentUserId).eq('orders.status', 'delivered').limit(1),
        supabase.from('product_reviews').select('id,user_id,rating,title,body,created_at').eq('product_id', productId).eq('user_id', currentUserId).maybeSingle(),
        supabase.from('wishlists').select('id').eq('product_id', productId).eq('user_id', currentUserId).maybeSingle(),
      ]);
      setWishlistSaved(Boolean(savedData));
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
      setWishlistSaved(false);
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
        const [{ data: extraImages }, { data: variantRows }] = await Promise.all([
          supabase.from('product_images').select('image_url').eq('product_id', productId).order('sort_order').order('created_at'),
          supabase.from('product_variants').select('id,product_id,label,price,stock_quantity').eq('product_id', productId).eq('is_active', true).order('sort_order').order('created_at'),
        ]);
        const liveVariants = (variantRows || []) as ProductVariant[];
        setVariants(liveVariants);
        setSelectedVariantId(liveVariants.find(item => item.stock_quantity > 0)?.id || liveVariants[0]?.id || '');
        const category = Array.isArray(data.categories) ? data.categories[0]?.name : data.categories?.name;
        const viewedProduct = {
          id: data.id, name: data.name,
          description: data.description || 'Discover this product on PUASH.',
          price: Number(data.price), mrp: Number(data.compare_at_price ?? data.price),
          imageUrl: data.image_url || null, stock: Number(data.stock_quantity || 0),
          category: category || 'Other',
        };
        setProduct(viewedProduct);
        const images = [viewedProduct.imageUrl, ...(extraImages || []).map((item: any) => item.image_url)].filter((url): url is string => Boolean(url));
        setGalleryImages(Array.from(new Set(images)));
        setActiveImage(0);
        try {
          const current = JSON.parse(localStorage.getItem('puash-recently-viewed') || '[]');
          const item = { id: viewedProduct.id, name: viewedProduct.name, price: viewedProduct.price, image_url: viewedProduct.imageUrl, category: viewedProduct.category };
          localStorage.setItem('puash-recently-viewed', JSON.stringify([item, ...current.filter((entry: any) => entry?.id !== item.id)].slice(0, 8)));
        } catch { /* Ignore unavailable browser storage. */ }
      }
      setLoading(false);
    }
    loadProduct();
    loadReviews();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { loadReviews(); });
    return () => { cancelled = true; authListener.subscription.unsubscribe(); };
  }, [productId]);

  const addToCart = () => {
    const selectedVariant = variants.find(item => item.id === selectedVariantId) || null;
    const availableStock = selectedVariant ? selectedVariant.stock_quantity : product?.stock || 0;
    if (!product || (variants.length > 0 && !selectedVariant) || quantity < 1 || quantity > availableStock || availableStock <= 0) return;
    try {
      const current = JSON.parse(localStorage.getItem('puash-cart') || '{}');
      const cartKey = selectedVariant ? product.id + '::' + selectedVariant.id : product.id;
      const alreadyInCart = Number(current[cartKey]) || 0;
      if (alreadyInCart + quantity > availableStock) {
        setMessage('Cart mein pehle se ' + alreadyInCart + ' hain. Available stock ' + availableStock + ' hi hai.');
        return;
      }
      const next = { ...current, [cartKey]: alreadyInCart + quantity };
      localStorage.setItem('puash-cart', JSON.stringify(next));
      setMessage('Cart mein add ho gaya!');
    } catch {
      setMessage('Cart update nahi ho saka. Dobara try karein.');
    }
  };

  const toggleWishlist = async () => {
    if (!product || wishlistBusy) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      window.location.href = '/account';
      return;
    }
    setWishlistBusy(true);
    const result = wishlistSaved
      ? await supabase.from('wishlists').delete().eq('user_id', auth.user.id).eq('product_id', product.id)
      : await supabase.from('wishlists').insert({ user_id: auth.user.id, product_id: product.id });
    setWishlistBusy(false);
    if (result.error) {
      setMessage('Wishlist update nahi hui. Dobara try karein.');
      return;
    }
    setWishlistSaved(!wishlistSaved);
    setMessage(wishlistSaved ? 'Wishlist se remove ho gaya.' : 'Wishlist mein save ho gaya.');
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
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

  useEffect(() => {
    if (!product) return;
    const previousTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute('content') || '';
    const previousOgTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const previousOgDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
    const previousOgImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
    const pageTitle = product.name + ' | PUASH';
    const pageDescription = (product.description || 'Discover ' + product.name + ' at PUASH.').replace(/\s+/g, ' ').slice(0, 155);
    document.title = pageTitle;
    if (descriptionTag) descriptionTag.setAttribute('content', pageDescription);
    const setMeta = (selector: string, attribute: string, value: string) => {
      let tag = document.querySelector(selector) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        if (selector.includes('og:')) tag.setAttribute('property', selector.match(/\[property="([^"]+)"\\]/)?.[1] || '');
        else tag.setAttribute('name', selector.match(/\[name="([^"]+)"\\]/)?.[1] || '');
        document.head.appendChild(tag);
      }
      tag.setAttribute(attribute, value);
    };
    setMeta('meta[property="og:title"]', 'content', pageTitle);
    setMeta('meta[property="og:description"]', 'content', pageDescription);
    if (galleryImages[0]) setMeta('meta[property="og:image"]', 'content', galleryImages[0]);
    const currentPrice = variants.find(item => item.id === selectedVariantId)?.price ?? product.price;
    const structuredData: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: pageDescription,
      image: galleryImages.length ? galleryImages : undefined,
      category: product.category,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: currentPrice,
        availability: (variants.length ? (variants.find(item => item.id === selectedVariantId)?.stock_quantity || 0) : product.stock) > 0
          ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: window.location.href,
      },
      ...(reviews.length ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(averageRating.toFixed(1)), reviewCount: reviews.length } } : {}),
    };
    let script = document.getElementById('puash-product-schema') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'puash-product-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData);
    return () => {
      document.title = previousTitle;
      if (descriptionTag) descriptionTag.setAttribute('content', previousDescription);
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', previousOgTitle);
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', previousOgDescription);
      document.querySelector('meta[property="og:image"]')?.setAttribute('content', previousOgImage);
      document.getElementById('puash-product-schema')?.remove();
    };
  }, [product, variants, selectedVariantId, reviews, averageRating, galleryImages]);

  return (
    <div className="product-detail-page">
      <header className="detail-header">
        <button className="detail-back" onClick={() => { window.location.href = '/'; }}><ArrowLeft size={18} /> PUASH store par wapas</button>
        <button className="detail-brand" onClick={() => { window.location.href = '/'; }}>PUASH<span>.</span></button>
        <button className="detail-cart-link" onClick={() => { window.location.href = '/'; }}>Continue shopping</button>
      </header>
      <main className="detail-main">
        {loading ? <div className="detail-layout detail-loading-layout" aria-label="Loading product details" aria-busy="true">
          <div className="detail-gallery detail-gallery-skeleton"><span /></div>
          <section className="detail-information detail-information-skeleton">
            <span className="detail-skeleton-line short" /><span className="detail-skeleton-line heading" />
            <span className="detail-skeleton-line medium" /><span className="detail-skeleton-line price" />
            <span className="detail-skeleton-panel" /><span className="detail-skeleton-line medium" />
            <span className="detail-skeleton-panel large" />
          </section>
        </div> :
        !product ? <div className="detail-state"><h2>Product nahi mila</h2><p>Ye product available nahi hai ya publish nahi hua.</p><button className="primary-button" onClick={() => { window.location.href = '/'; }}>Store par wapas</button></div> :
        <>
          <article className="detail-layout">
            <div className="detail-gallery">
              {galleryImages.length && !imageFailed ? <>
                <img src={galleryImages[activeImage] || galleryImages[0]} alt={product.name + ' – image ' + (activeImage + 1)} onError={() => setImageFailed(true)} />
                {galleryImages.length > 1 && <div className="detail-gallery-thumbs" aria-label="Product images">{galleryImages.map((url, index) => <button type="button" key={url} className={activeImage === index ? 'active' : ''} onClick={() => setActiveImage(index)} aria-label={'Show product image ' + (index + 1)}><img src={url} alt="" /></button>)}</div>}
              </> : <div className="detail-image-placeholder">🛍️</div>}
            </div>
            <section className="detail-information">
              <div className="eyebrow">PUASH COLLECTION · {product.category.toUpperCase()}</div>
              <h1>{product.name}</h1>
              <button type="button" className={'detail-wishlist-button ' + (wishlistSaved ? 'saved' : '')} onClick={() => void toggleWishlist()} disabled={wishlistBusy}>
                <Heart size={16} fill={wishlistSaved ? 'currentColor' : 'none'}/> {wishlistBusy ? 'Saving…' : wishlistSaved ? 'Saved to wishlist' : 'Save to wishlist'}
              </button>
              <div className="detail-review-summary"><span className="detail-review-stars"><Star size={15} fill="currentColor"/> {averageRating ? averageRating.toFixed(1) : 'New'}</span><span>{reviews.length} {reviews.length===1?'review':'reviews'}</span></div>
              <div className="detail-prices"><strong>{money(variants.find(item => item.id === selectedVariantId)?.price ?? product.price)}</strong>{product.mrp > (variants.find(item => item.id === selectedVariantId)?.price ?? product.price) && <><del>{money(product.mrp)}</del><span>{Math.round((1-(variants.find(item => item.id === selectedVariantId)?.price ?? product.price)/product.mrp)*100)}% off</span></>}</div>
              {variants.length > 0 && <label className="detail-variant-picker"><span>Choose size / colour / option</span><select value={selectedVariantId} onChange={e=>{setSelectedVariantId(e.target.value);setQuantity(1);}}>{variants.map(variant=><option key={variant.id} value={variant.id} disabled={variant.stock_quantity<=0}>{variant.label}{variant.stock_quantity<=0?' · Out of stock':''}</option>)}</select></label>}
              <div className={(variants.length ? (variants.find(item=>item.id===selectedVariantId)?.stock_quantity||0) : product.stock) > 0 ? 'detail-availability' : 'detail-availability out'}><span />{(variants.length ? (variants.find(item=>item.id===selectedVariantId)?.stock_quantity||0) : product.stock) > 0 ? (variants.length ? variants.find(item=>item.id===selectedVariantId)?.stock_quantity : product.stock) + ' pieces available' : 'Currently out of stock'}</div>
              <div className="detail-description"><h2>Product description</h2><p>{product.description}</p></div>
              <div className="detail-delivery"><Truck size={18} /><span><strong>Delivery information</strong><small>Delivery options and charges will be shown at checkout.</small></span></div>
              {(variants.length ? (variants.find(item=>item.id===selectedVariantId)?.stock_quantity||0) : product.stock) > 0 && <div className="detail-buy-row">
                <div className="detail-quantity"><button aria-label="Decrease quantity" onClick={() => setQuantity(q => Math.max(1,q-1))}><Minus size={16}/></button><strong>{quantity}</strong><button aria-label="Increase quantity" onClick={() => setQuantity(q => Math.min(variants.length ? (variants.find(item=>item.id===selectedVariantId)?.stock_quantity||0) : product.stock,q+1))}><Plus size={16}/></button></div>
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
