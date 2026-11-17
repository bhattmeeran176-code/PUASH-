import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Grid2X2,
  Headphones,
  Shirt,
  House,
  Flower2,
  Carrot,
  Package,
  Heart,
  Home,
  MapPin,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  X,
} from 'lucide-react';

type ProductVariant = { id: string; product_id: string; label: string; price: number | null; stock_quantity: number; };
type CartLine = Product & { cartKey: string; quantity: number; variantId: string | null; variantLabel: string | null; unitPrice: number; };
type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  emoji: string;
  tone: string;
  tag?: string;
  description: string;
  imageUrl?: string | null;
  stock: number;
  createdAt?: string | null;
};

const sampleCategories = [
  { name: 'All', emoji: '✨' },
  { name: 'Electronics', emoji: '🎧' },
  { name: 'Fashion', emoji: '👕' },
  { name: 'Home', emoji: '🏡' },
  { name: 'Beauty', emoji: '🌸' },
  { name: 'Grocery', emoji: '🥬' },
];

const CategoryIcon = ({ name }: { name: string }) => {
  const normalized = name.trim().toLowerCase();
  const Icon = normalized === 'all' ? Grid2X2
    : normalized.includes('electronic') ? Headphones
    : normalized.includes('fashion') || normalized.includes('cloth') ? Shirt
    : normalized.includes('home') ? House
    : normalized.includes('beauty') ? Flower2
    : normalized.includes('grocer') || normalized.includes('food') ? Carrot
    : Package;
  return <Icon size={25} strokeWidth={1.7} aria-hidden="true" />;
};

const money = (value: number) => '₹' + value.toLocaleString('en-IN');

const rememberViewedProduct = (product: Product) => {
  try {
    const current = JSON.parse(localStorage.getItem('puash-recently-viewed') || '[]');
    const item = {
      id: product.id, name: product.name, price: product.price,
      image_url: product.imageUrl || null, category: product.category,
    };
    const next = [item, ...current.filter((entry: any) => entry?.id !== product.id)].slice(0, 8);
    localStorage.setItem('puash-recently-viewed', JSON.stringify(next));
  } catch { /* Ignore unavailable browser storage. */ }
};

function App() {
  const [category, setCategory] = useState('All');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState(sampleCategories);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('0');
  const [savedOnly, setSavedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('puash-cart') || '{}');
    } catch {
      return {};
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [checkoutAddresses, setCheckoutAddresses] = useState<any[]>([]);
  const [deliveryQuote, setDeliveryQuote] = useState<any>(null);
  const [deliveryQuoteBusy, setDeliveryQuoteBusy] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const placingOrderRef = useRef(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{code:string;coupon_id:string;discount_amount:number}|null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [toast, setToast] = useState('');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [wishlistBusy, setWishlistBusy] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('puash-cart', JSON.stringify(cart));
  }, [cart]);


  useEffect(() => {
    let active = true;
    const loadWishlist = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) setWishlist([]); return; }
      const { data } = await supabase.from('wishlists').select('product_id').eq('user_id', auth.user.id);
      if (active) setWishlist((data || []).map((row: any) => row.product_id));
    };
    loadWishlist();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void loadWishlist(); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const toggleWishlist = async (product: Product) => {
    if (wishlistBusy) return;
    setWishlistBusy(product.id);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setWishlistBusy(null);
      window.location.href = '/account';
      return;
    }
    const saved = wishlist.includes(product.id);
    const result = saved
      ? await supabase.from('wishlists').delete().eq('user_id', auth.user.id).eq('product_id', product.id)
      : await supabase.from('wishlists').insert({ user_id: auth.user.id, product_id: product.id });
    setWishlistBusy(null);
    if (result.error) { setToast('Wishlist update nahi hui. Dobara try karein.'); return; }
    setWishlist(current => saved ? current.filter(id => id !== product.id) : [...current, product.id]);
    setToast(saved ? 'Wishlist se remove ho gaya' : 'Wishlist mein save ho gaya');
  };

  useEffect(() => {
    let cancelled = false;
    async function loadStoreData() {
      const [productResult, categoryResult, reviewResult, variantResult] = await Promise.all([
        supabase
          .from('products')
          .select('id,name,description,price,compare_at_price,image_url,stock_quantity,created_at,categories(name)')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('id,name,slug')
          .eq('is_active', true)
          .order('name'),
        supabase.from('product_reviews').select('product_id,rating'),
        supabase.from('product_variants').select('id,product_id,label,price,stock_quantity').eq('is_active', true).order('sort_order').order('created_at'),
      ]);

      if (cancelled) return;
      if (!variantResult.error) setProductVariants((variantResult.data || []) as ProductVariant[]);
      if (productResult.error) {
        console.warn('PUASH products could not be loaded:', productResult.error.message);
        setProducts([]);
      } else {
        const reviewStats = new Map<string, { total: number; count: number }>();
        (reviewResult.data || []).forEach((review: any) => {
          const current = reviewStats.get(review.product_id) || { total: 0, count: 0 };
          current.total += Number(review.rating);
          current.count += 1;
          reviewStats.set(review.product_id, current);
        });
        const liveProducts: Product[] = (productResult.data || []).map((row: any) => {
          const relation = Array.isArray(row.categories) ? row.categories[0] : row.categories;
          const stats = reviewStats.get(row.id);
          const productCategory = relation?.name || 'Other';
          const emojiByCategory: Record<string, string> = {
            Electronics: '🎧', Fashion: '🧥', Home: '🏡', Beauty: '🌸', Grocery: '🥬',
          };
          return {
            id: row.id,
            name: row.name,
            category: productCategory,
            price: Number(row.price),
            mrp: Number(row.compare_at_price ?? row.price),
            rating: stats?.count ? Number((stats.total / stats.count).toFixed(1)) : 0,
            reviews: stats?.count || 0,
            emoji: emojiByCategory[productCategory] || '🛍️',
            tone: 'cream',
            description: row.description || 'Discover this product on PUASH.',
            imageUrl: row.image_url || null,
            stock: (variantResult.data || []).some((v: any) => v.product_id === row.id) ? (variantResult.data || []).filter((v: any) => v.product_id === row.id && v.is_active !== false).reduce((sum: number, v: any) => sum + Number(v.stock_quantity || 0), 0) : Number(row.stock_quantity || 0),
            createdAt: row.created_at || null,
          };
        });
        setProducts(liveProducts);
      }

      if (!categoryResult.error && categoryResult.data?.length) {
        const emojiByCategory: Record<string, string> = {
          Electronics: '🎧', Fashion: '👕', Home: '🏡', Beauty: '🌸', Grocery: '🥬',
        };
        setCategories([
          { name: 'All', emoji: '✨' },
          ...categoryResult.data.map((item: any) => ({
            name: item.name,
            emoji: emojiByCategory[item.name] || '🛍️',
          })),
        ]);
      } else if (categoryResult.error) {
        console.warn('PUASH categories could not be loaded:', categoryResult.error.message);
      }
      setProductsLoading(false);
    }
    loadStoreData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2300);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleProducts = useMemo(() => {
    let list = products.filter(product => {
      if (product.stock <= 0) return false;
      const matchesCategory =
        category === 'All' || product.category === category;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);
      const matchesMinPrice = minPrice === '' || product.price >= Number(minPrice);
      const matchesMaxPrice = maxPrice === '' || product.price <= Number(maxPrice);
      const matchesRating = product.rating >= Number(minRating);
      const matchesSaved = !savedOnly || wishlist.includes(product.id);
      return matchesCategory && matchesSearch && matchesMinPrice && matchesMaxPrice && matchesRating && matchesSaved;
    });
    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
    if (sort === 'popular') list = [...list].sort((a, b) => b.reviews - a.reviews || b.rating - a.rating);
    if (sort === 'newest') list = [...list].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    return list;
  }, [category, search, sort, products, minPrice, maxPrice, minRating, savedOnly, wishlist]);

  const discountedProducts = products.filter(product => product.stock > 0 && product.mrp > product.price).slice(0, 3);

  const cartItems: CartLine[] = Object.entries(cart).flatMap(([cartKey, quantity]) => {
    if (!quantity) return [];
    const [productId, variantId] = cartKey.split('::');
    const product = products.find(item => item.id === productId);
    if (!product) return [];
    const variant = variantId ? productVariants.find(item => item.id === variantId && item.product_id === productId) : null;
    const staleVariant = Boolean(variantId && !variant);
    return [{ ...product, cartKey, quantity, variantId: variantId || null, variantLabel: staleVariant ? 'Selected option unavailable' : variant?.label || null, unitPrice: variant?.price ?? product.price, stock: staleVariant ? 0 : variant ? variant.stock_quantity : product.stock }];
  });
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const activeCheckoutAddress = checkoutAddresses.find(address => address.id === selectedAddressId);
  useEffect(() => {
    let current = true;
    if (!checkoutOpen || !selectedAddressId || subtotal <= 0) {
      setDeliveryQuote(null);
      setDeliveryQuoteBusy(false);
      return;
    }
    setDeliveryQuote(null);
    setDeliveryQuoteBusy(true);
    supabase.rpc('get_delivery_quote', { p_address_id: selectedAddressId, p_subtotal: subtotal }).then(({ data, error }) => {
      if (!current) return;
      setDeliveryQuote(error ? { serviceable: false, reason: error.message || 'Delivery could not be verified' } : data);
      setDeliveryQuoteBusy(false);
    }, () => {
      if (!current) return;
      setDeliveryQuote({ serviceable: false, reason: 'Delivery could not be verified. Please try again.' });
      setDeliveryQuoteBusy(false);
    });
    return () => { current = false; };
  }, [checkoutOpen, selectedAddressId, subtotal]);
  const deliveryAvailable = deliveryQuote?.serviceable === true;
  const delivery = deliveryAvailable ? Number(deliveryQuote.delivery_fee || 0) : 0;
  const total = Math.max(0, subtotal + delivery - (appliedCoupon?.discount_amount || 0));

  const addToCart = (product: Product) => {
    if (productVariants.some(variant => variant.product_id === product.id)) {
      window.location.href = '/product/' + product.id;
      return;
    }
    const key = product.id;
    const currentQuantity = cart[key] || 0;
    if (product.stock <= currentQuantity) {
      setToast(product.stock <= 0 ? 'Ye product abhi out of stock hai' : 'Available stock se zyada quantity add nahi kar sakte');
      return;
    }
    setCart(current => ({ ...current, [key]: (current[key] || 0) + 1 }));
    setToast(product.name + ' added to cart');
  };

  const changeQuantity = (cartKey: string, amount: number) => {
    setCart(current => {
      const next = { ...current };
      const quantity = (next[cartKey] || 0) + amount;
      if (quantity <= 0) delete next[cartKey];
      else {
        const line = cartItems.find(item => item.cartKey === cartKey);
        if (line && quantity > line.stock) return current;
        next[cartKey] = quantity;
      }
      return next;
    });
  };

  const beginCheckout = async () => {
    setCheckoutError('');
    if (cartItems.length === 0) {
      setCheckoutError('Aapka cart empty hai. Pehle product add karein.');
      setCartOpen(true);
      return;
    }
    const unavailable = cartItems.find(item => item.quantity > item.stock || item.stock <= 0);
    if (unavailable) {
      setToast(unavailable.name + ' ka available stock kam hai. Cart quantity update karein.');
      return;
    }
    if (cartItems.some(item => item.id.startsWith('demo-'))) {
      setCheckoutOpen(true);
      setCheckoutError('Ye abhi sample catalogue ke products hain. Real orders ke liye admin ko pehle live products aur stock add karna hoga.');
      return;
    }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      window.location.href = '/account';
      return;
    }
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('id,label,full_name,phone,line1,line2,city,district,state,postal_code,country,is_default')
      .eq('user_id', authData.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      setCheckoutError('Delivery addresses load nahi huye: ' + error.message);
      setCheckoutOpen(true);
      return;
    }
    if (!data?.length) {
      window.location.href = '/account';
      return;
    }
    setCheckoutAddresses(data);
    setSelectedAddressId(data.find((address: any) => address.is_default)?.id || data[0].id);
    setCheckoutOpen(true);
  };

  const applyCoupon = async () => {
    const code=couponInput.trim().toUpperCase();
    if(!code) {setCouponError('Enter a coupon code first.');return;}
    setCouponBusy(true);setCouponError('');
    const {data,error}=await supabase.rpc('validate_coupon',{p_code:code,p_subtotal:subtotal});
    setCouponBusy(false);
    if(error) {setAppliedCoupon(null);setCouponError(error.message||'Coupon could not be applied.');return;}
    setAppliedCoupon({code:data.code,coupon_id:data.coupon_id,discount_amount:Number(data.discount_amount)});
    setCouponInput(data.code);
  };

  const removeCoupon = () => {setAppliedCoupon(null);setCouponInput('');setCouponError('');};

  const placeOrder = async () => {
    if (!selectedAddressId || placingOrderRef.current) return;
    placingOrderRef.current = true;
    setPlacingOrder(true);
    setCheckoutError('');
    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.id,
        variant_id: item.variantId,
        quantity: item.quantity,
      }));
      const couponCode = appliedCoupon?.code || null;
      const requestFingerprint = JSON.stringify({
        addressId: selectedAddressId,
        items: orderItems,
        customerNote: null,
        couponCode: couponCode?.trim().toUpperCase() || null,
      });
      let idempotencyKey = '';
      try {
        const saved = JSON.parse(sessionStorage.getItem('puash-checkout-request') || 'null');
        if (saved?.fingerprint === requestFingerprint && saved?.key) {
          idempotencyKey = saved.key;
        }
      } catch { /* Start a fresh request if session storage is unavailable. */ }
      if (!idempotencyKey) {
        idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
              const random = Math.random() * 16 | 0;
              return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
            });
        try {
          sessionStorage.setItem('puash-checkout-request', JSON.stringify({
            fingerprint: requestFingerprint,
            key: idempotencyKey,
          }));
        } catch { /* Server-side protection still applies for this attempt. */ }
      }
      const { data, error } = await supabase.rpc('place_customer_order', {
        p_address_id: selectedAddressId,
        p_items: orderItems,
        p_customer_note: null,
        p_coupon_code: couponCode,
        p_idempotency_key: idempotencyKey,
      });
      if (error) {
        setCheckoutError(error.message || 'Order place nahi ho saka. Please try again.');
        setAppliedCoupon(null);
        return;
      }
      if (!data?.order_id) {
        setCheckoutError('Order confirmation nahi mili. Please Account mein order status check karein before retrying.');
        return;
      }
      setOrderId(String(data.order_id));
      try { sessionStorage.removeItem('puash-checkout-request'); } catch { /* Ignore unavailable storage. */ }
      setCart({});
      setAppliedCoupon(null); setCouponInput(''); setCouponError('');
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch {
      setCheckoutError('Network response nahi mili. Dobara order place karne se pehle Account mein check karein ke order create hua hai ya nahi.');
    } finally {
      placingOrderRef.current = false;
      setPlacingOrder(false);
    }
  };

  const startShopping = () => {
    setCategory('All');
    setSearch('');
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="app-shell">
      <div className="top-strip">
        <span>
          <Sparkles size={13} /> A fresh way to shop, inspired by Kashmir
        </span>
        <span className="top-strip-right">
          Thoughtful finds. Everyday value.
        </span>
      </div>

      <header className="site-header">
        <div className="header-main">
          <button
            className="wordmark"
            onClick={() => {
              setCategory('All');
              setSearch('');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="PUASH home"
          >
            <span className="wordmark-symbol" aria-hidden="true">
              <svg viewBox="0 0 40 40" role="img" focusable="false">
                <path d="M5 29.5 15.4 13l5.2 8.1L25 14l10 15.5H5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M10 29.5h20M14.2 29.5l5.8-9 5.8 9" fill="none" stroke="#D9B58E" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="29.5" cy="9.5" r="2.2" fill="#D9B58E"/>
              </svg>
            </span>
            <span className="wordmark-type">
              PUASH<span className="wordmark-dot">.</span>
              <small>ROOTED IN KASHMIR</small>
            </span>
          </button>
          <div className="delivery-pill">
            <MapPin size={15} />
            <span>
              <small>Delivering to</small>
              <strong>Kashmir</strong>
            </span>
            <ChevronRight size={14} />
          </div>
          <label className="search-box">
            <Search size={19} />
            <input
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setCategory('All');
              }}
              placeholder="Search for products, brands and more"
              aria-label="Search products"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </label>
          <a className="header-account" href="/account" aria-label="My account">
            <UserRound size={19} />
            <span>Account</span>
          </a>
          <button
            className="header-cart"
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
          >
            <ShoppingCart size={20} />
            <span>Cart</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
        </div>
        <div className="mobile-search-wrap">
          <label className="search-box mobile-search">
            <Search size={18} />
            <input
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setCategory('All');
              }}
              placeholder="Search products..."
              aria-label="Search products"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </label>
        </div>
      </header>

      <main>
        <section className="market-promo" aria-label="PUASH featured offers">
          {discountedProducts.length > 0 ? (
            <div className="market-promo-track">
              {discountedProducts.map((product, index) => {
                const discount = Math.round((1 - product.price / product.mrp) * 100);
                return (
                  <article className={'market-promo-card promo-card-' + index} key={product.id}>
                    <div className="market-promo-copy">
                      <span className="market-promo-kicker">PUASH PICKS · LIMITED OFFERS</span>
                      <h1>{index === 0 ? 'A little something special.' : 'Good finds, better value.'}</h1>
                      <p>{product.name}</p>
                      <div className="market-promo-price"><strong>{money(product.price)}</strong><del>{money(product.mrp)}</del><b>{discount}% OFF</b></div>
                      <button type="button" onClick={() => { rememberViewedProduct(product); window.location.href = '/product/' + product.id; }}>Explore offer <ArrowRight size={14}/></button>
                    </div>
                    <button className="market-promo-image" type="button" onClick={() => { rememberViewedProduct(product); window.location.href = '/product/' + product.id; }} aria-label={'View ' + product.name}>
                      {product.imageUrl ? <img src={product.imageUrl} alt={product.name}/> : <span>{product.emoji}</span>}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="market-promo-card market-promo-editorial">
              <div className="market-promo-copy">
                <span className="market-promo-kicker">WELCOME TO PUASH</span>
                <h1>Discover something lovely.</h1>
                <p>Everyday finds, thoughtfully brought together.</p>
                <button type="button" onClick={startShopping}>Explore collection <ArrowRight size={14}/></button>
              </div>
              <div className="market-promo-emblem" aria-hidden="true"><ShoppingBag size={68}/><span>PUASH</span></div>
            </div>
          )}
        </section>

        <section className="home-category-section market-categories" aria-labelledby="home-category-title">
          <div className="market-section-heading">
            <h2 id="home-category-title">Category</h2>
            <button type="button" onClick={startShopping}>See all <ArrowRight size={13}/></button>
          </div>
          <div className="home-category-grid">
            {categories.filter(item => item.name !== 'All').map(item => {
              const count = products.filter(product => product.category === item.name && product.stock > 0).length;
              return (
                <button type="button" className="home-category-card" key={item.name} onClick={() => {
                  setCategory(item.name); setSearch('');
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  <span className="home-category-emoji"><CategoryIcon name={item.name} /></span>
                  <strong>{item.name}</strong>
                  <small>{count > 0 ? count + (count === 1 ? ' item' : ' items') : 'Explore'}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="products-section" id="products">
          <div className="section-heading">
            <div>
              <div className="eyebrow">CURATED FOR EVERYDAY</div>
              <h2>{discountedProducts.length > 0 && category === 'All' ? 'Flash Sale' : category === 'All' ? 'Explore products' : category}</h2>
              <p>Thoughtful finds for your everyday life.</p>
            </div>
            <label className="sort-control">
              <SlidersHorizontal size={16} />
              <span>Sort by</span>
              <select
                value={sort}
                onChange={event => setSort(event.target.value)}
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest first</option>
                <option value="popular">Popular</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>
          <div className="market-filter-row">
            <button type="button" className={filtersOpen ? 'market-filter-toggle is-open' : 'market-filter-toggle'} onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}>
              <SlidersHorizontal size={15}/><span>Filters</span><ChevronRight size={14}/>
            </button>
            <span className="market-results-note">{visibleProducts.length} products</span>
          </div>
          {filtersOpen && (
            <div className="advanced-filter-panel" aria-label="Filter products">
            <div className="advanced-filter-title"><SlidersHorizontal size={15}/><strong>Refine your search</strong></div>
            <label className="filter-field"><span>Min price (₹)</span><input inputMode="numeric" type="number" min="0" placeholder="No minimum" value={minPrice} onChange={event => setMinPrice(event.target.value)}/></label>
            <label className="filter-field"><span>Max price (₹)</span><input inputMode="numeric" type="number" min="0" placeholder="No maximum" value={maxPrice} onChange={event => setMaxPrice(event.target.value)}/></label>
            <label className="filter-field"><span>Minimum rating</span><select value={minRating} onChange={event => setMinRating(event.target.value)}><option value="0">Any rating</option><option value="3">3★ & above</option><option value="4">4★ & above</option><option value="4.5">4.5★ & above</option></select></label>
            <label className="saved-only-filter"><input type="checkbox" checked={savedOnly} onChange={event => setSavedOnly(event.target.checked)}/> Saved items only</label><button type="button" className="clear-filter-button" onClick={() => { setMinPrice(''); setMaxPrice(''); setMinRating('0'); setSavedOnly(false); setSort('featured'); setSearch(''); setCategory('All'); }}>Clear filters</button>
            </div>
          )}
          {minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice) && <p className="filter-validation" role="alert">Minimum price cannot be greater than maximum price.</p>}
          {minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice) ? <div className="empty-results"><h3>Check your price range</h3><p>Minimum price should not exceed maximum price.</p></div> : productsLoading ? (
            <div className="product-grid product-grid-loading" aria-label="Loading products" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="product-skeleton" key={'product-skeleton-' + index}>
                  <div className="skeleton-image" />
                  <div className="skeleton-copy">
                    <span className="skeleton-line skeleton-category" />
                    <span className="skeleton-line skeleton-name" />
                    <span className="skeleton-line skeleton-price" />
                    <span className="skeleton-button" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleProducts.length > 0 ? (
            <div className="product-grid">
              {visibleProducts.map(product => {
                const hasDiscount = product.mrp > product.price && product.mrp > 0;
                const discount = hasDiscount
                  ? Math.round((1 - product.price / product.mrp) * 100)
                  : 0;
                return (
                  <article className="product-card" key={product.id}>
                    <button
                      type="button"
                      className={'wishlist-heart ' + (wishlist.includes(product.id) ? 'saved' : '')}
                      onClick={() => void toggleWishlist(product)}
                      aria-label={wishlist.includes(product.id) ? 'Remove from wishlist' : 'Save to wishlist'}
                      title={wishlist.includes(product.id) ? 'Saved' : 'Save for later'}
                    ><Heart size={17} fill={wishlist.includes(product.id) ? 'currentColor' : 'none'}/></button>
                    <button
                      className="product-visual"
                      onClick={() => { rememberViewedProduct(product); window.location.href = '/product/' + product.id; }}
                      aria-label={'View ' + product.name}
                    >
                      {product.tag && (
                        <span className="product-tag">{product.tag}</span>
                      )}
                      {product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.name} /> : <span className={'product-emoji tone-' + product.tone}>{product.emoji}</span>}
                      <span className="quick-view">
                        Quick view <ArrowRight size={13} />
                      </span>
                    </button>
                    <div className="product-info">
                      <div className="product-category">{product.category}</div>
                      <button
                        className="product-name"
                        onClick={() => { window.location.href = '/product/' + product.id; }}
                      >
                        {product.name}
                      </button>
                      <div className="rating-line">
                        {product.reviews > 0 ? (
                          <>
                            <span className="rating">
                              <Star size={12} fill="currentColor" />{' '}
                              {product.rating.toFixed(1)}
                            </span>
                            <span className="review-count">
                              ({product.reviews} {product.reviews === 1 ? 'review' : 'reviews'})
                            </span>
                          </>
                        ) : (
                          <span className="review-count">No reviews yet</span>
                        )}
                      </div>
                      <div className="price-row">
                        <strong>{money(product.price)}</strong>
                        {hasDiscount && (
                          <>
                            <del>{money(product.mrp)}</del>
                            <span>{discount}% off</span>
                          </>
                        )}
                      </div>
                      <button
                        className="add-button"
                        onClick={() => addToCart(product)}
                      >
                        <Plus size={16} /> Add to cart
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-results">
              <span>{products.length === 0 ? '🛍️' : '🔎'}</span>
              <h3>{products.length === 0 ? 'Our first collection is coming soon' : 'No products found'}</h3>
              <p>{products.length === 0 ? 'PUASH is getting its first products ready. Please check back soon.' : 'Try another search or browse all products.'}</p>
              {products.length > 0 && <button
                className="secondary-button"
                onClick={() => {
                  setSearch('');
                  setCategory('All');
                }}
              >
                Show all products
              </button>}
            </div>
          )}
        </section>

        <section className="bottom-banner">
          <div>
            <span className="banner-kicker">A NOTE FROM PUASH</span>
            <h2>
              From the valley,
              <br />
              with a little more to love.
            </h2>
            <p>A Kashmir-inspired idea, made for everyday discovery.</p>
          </div>
          <div className="banner-stamp">
            ✿
            <small>
              ROOTED
              <br />
              IN KASHMIR
            </small>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="footer-mark">P</span>
          <strong>PUASH</strong>
          <span>Shopping, made simple.</span>
        </div>
        <div className="footer-copy">
          A Kashmir-inspired shopping store
        </div>
        <div className="footer-bottom">© 2026 PUASH · Inspired by Kashmir</div>
      </footer>

      <div className="mobile-bottom-nav">
        <button className="active" onClick={() => {
          setCategory('All'); setSearch(''); setSavedOnly(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}>
          <Home size={19} /><span>Home</span>
        </button>
        <button onClick={() => {
          setSavedOnly(true);
          document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
        }}>
          <Heart size={19} /><span>Wishlist</span>
        </button>
        <button onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>
          <Grid2X2 size={19} /><span>Explore</span>
        </button>
        <button onClick={() => setCartOpen(true)} className="mobile-cart-nav">
          <ShoppingBag size={19} /><span>Cart</span>
          {cartCount > 0 && <b>{cartCount}</b>}
        </button>
        <button onClick={() => { window.location.href = '/account'; }}>
          <UserRound size={19} /><span>Profile</span>
        </button>
      </div>

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-dialog-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="drawer-heading">
              <div>
                <span className="eyebrow">YOUR PICKS</span>
                <h2 id="cart-dialog-title">
                  Shopping cart <span>({cartCount})</span>
                </h2>
              </div>
              <button
                className="close-button"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
              >
                <X size={20} />
              </button>
            </div>
            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <div className="empty-cart-icon">
                  <ShoppingBag size={32} />
                </div>
                <h3>Your cart is waiting</h3>
                <p>Add something you like and it will show up here.</p>
                <button
                  className="primary-button"
                  onClick={() => setCartOpen(false)}
                >
                  Continue shopping <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cartItems.map(product => (
                    <div className="cart-item" key={product.cartKey}>
                      <div className={'cart-item-art tone-' + product.tone}>
                        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : product.emoji}
                      </div>
                      <div className="cart-item-details">
                        <strong>{product.name}</strong>
                        <small>{money(product.unitPrice)} each</small>{product.variantLabel && <small>Option: {product.variantLabel}</small>}
                        <small className={product.stock <= 0 ? 'cart-stock-out' : 'cart-stock-note'}>{product.stock <= 0 ? 'Out of stock' : product.stock + ' available'}</small>
                        <div className="quantity-control">
                          <button
                            onClick={() => changeQuantity(product.cartKey, -1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={13} />
                          </button>
                          <span>{product.quantity}</span>
                          <button
                            onClick={() => changeQuantity(product.cartKey, 1)}
                            aria-label="Increase quantity"
                            disabled={product.quantity >= product.stock}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                      <strong className="cart-line-price">
                        {money(product.unitPrice * product.quantity)}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div>
                    <span>Items subtotal</span>
                    <strong>{money(subtotal)}</strong>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <strong>Calculated at checkout</strong>
                  </div>
                  <p>Final delivery fee and any free-delivery offer are confirmed after you select your delivery address.</p>
                  <button
                    className="primary-button full-button"
                    onClick={beginCheckout}
                  >
                    Continue to checkout <ArrowRight size={17} />
                  </button>
                  <small className="demo-note">
                    Cash on Delivery · Final amount server par verify hoga
                  </small>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="modal-backdrop" onClick={() => setCheckoutOpen(false)}>
          <section
            className="checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-dialog-title"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="close-button"
              onClick={() => setCheckoutOpen(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <div className="checkout-icon">
              <ShieldCheck size={28} />
            </div>
            <div className="eyebrow">SECURE CHECKOUT</div>
            <h2 id="checkout-dialog-title">Confirm your order.</h2>
            <p>Choose your saved delivery address. Payment method: Cash on Delivery.</p>
            {activeCheckoutAddress && <div className="checkout-delivery-status"><strong>{deliveryQuoteBusy ? 'Checking delivery availability…' : deliveryAvailable ? 'Delivery available · ' + deliveryQuote.district : 'Delivery unavailable'}</strong>{deliveryQuoteBusy ? <small>Verifying your district and PIN code.</small> : deliveryAvailable ? <small>PIN code verified · Estimated delivery: {deliveryQuote.min_delivery_days}–{deliveryQuote.max_delivery_days} days · {delivery === 0 ? 'Free delivery' : money(delivery) + ' delivery fee'}</small> : <small>{deliveryQuote?.reason || 'Select an address to check delivery.'}</small>}</div>}
            {checkoutAddresses.length > 0 && <div className="checkout-address-list">
              <strong>Deliver to</strong>
              {checkoutAddresses.map((address: any) => <label className="checkout-address-option" key={address.id}>
                <input type="radio" name="checkout-address" checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} />
                <span><b>{address.label}{address.is_default ? ' · Default' : ''}</b><small>{address.full_name} · {address.phone}</small><small>{[address.line1,address.line2,address.city,address.state,address.postal_code,address.country].filter(Boolean).join(', ')}</small></span>
              </label>)}
            </div>}
            <div className="checkout-coupon">
              <strong>Have a coupon?</strong>
              {appliedCoupon ? <div className="checkout-coupon-applied"><span><b>{appliedCoupon.code}</b> applied · You save {money(appliedCoupon.discount_amount)}</span><button type="button" onClick={removeCoupon}>Remove</button></div> : <div className="checkout-coupon-entry"><input value={couponInput} onChange={e=>setCouponInput(e.target.value.toUpperCase())} maxLength={32} placeholder="Enter coupon code"/><button type="button" disabled={couponBusy||!couponInput.trim()} onClick={applyCoupon}>{couponBusy?'Checking…':'Apply'}</button></div>}
              {couponError && <small className="checkout-coupon-error">{couponError}</small>}
            </div>
            <div className="checkout-price-breakdown">
              <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
              <div><span>Delivery</span><b>{deliveryQuoteBusy ? 'Checking…' : deliveryAvailable ? (delivery===0?'FREE':money(delivery)) : 'Unavailable'}</b></div>
              {appliedCoupon && <div className="checkout-discount"><span>Coupon ({appliedCoupon.code})</span><b>−{money(appliedCoupon.discount_amount)}</b></div>}
              <div className="checkout-total"><span>{deliveryAvailable ? 'Estimated order total' : 'Items subtotal'}</span><strong>{deliveryAvailable ? money(total) : '—'}</strong></div>
            </div>
            {checkoutError && <div className="account-error">{checkoutError}</div>}
            <button
              className="primary-button full-button"
              onClick={placeOrder}
              disabled={placingOrder || deliveryQuoteBusy || !selectedAddressId || !deliveryAvailable}
            >
              {placingOrder ? 'Placing order…' : 'Place Cash on Delivery order'} <Check size={17} />
            </button>
            <button
              className="text-button"
              onClick={() => setCheckoutOpen(false)}
            >
              Go back to cart
            </button>
          </section>
        </div>
      )}

      {orderId && (
        <div className="modal-backdrop" onClick={() => setOrderId('')}>
          <section
            className="checkout-modal success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-success-title"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="close-button"
              onClick={() => setOrderId('')}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <div className="success-icon">
              <CheckCircle2 size={34} />
            </div>
            <div className="eyebrow">THAT'S A WRAP</div>
            <h2 id="order-success-title">Order received!</h2>
            <p>Your Cash on Delivery order has been saved. You can track its status from your account.</p>
            <div className="order-number">
              <span>Order ID</span>
              <strong>{orderId}</strong>
            </div>
            <button
              className="primary-button full-button"
              onClick={() => {
                setOrderId('');
                startShopping();
              }}
            >
              Continue exploring <ArrowRight size={17} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
