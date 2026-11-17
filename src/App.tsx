import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Grid2X2,
  Heart,
  Home,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  Truck,
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
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [deliveryQuote, setDeliveryQuote] = useState<any>(null);
  const [deliveryQuoteBusy, setDeliveryQuoteBusy] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{code:string;coupon_id:string;discount_amount:number}|null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [toast, setToast] = useState('');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [wishlistBusy, setWishlistBusy] = useState<string | null>(null);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem('puash-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    try {
      const viewed = JSON.parse(localStorage.getItem('puash-recently-viewed') || '[]');
      setRecentlyViewedIds(Array.isArray(viewed) ? viewed.map((item: any) => String(item.id)).slice(0, 8) : []);
    } catch { setRecentlyViewedIds([]); }
  }, []);

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
    supabase.from('delivery_zones').select('district,delivery_fee,free_delivery_threshold,min_delivery_days,max_delivery_days,is_serviceable').eq('is_serviceable', true).order('district').then(({data,error}) => { if (!cancelled && !error) setDeliveryZones(data || []); });
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
    return list;
  }, [category, search, sort, products, minPrice, maxPrice, minRating, savedOnly, wishlist]);

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
  const selectedDeliveryZone = deliveryZones.find(zone => zone.district.toLowerCase() === String(activeCheckoutAddress?.district || '').toLowerCase());
  useEffect(() => {
    let current = true;
    if (!checkoutOpen || !selectedAddressId || subtotal <= 0) {
      setDeliveryQuote(null);
      setDeliveryQuoteBusy(false);
      return;
    }
    setDeliveryQuoteBusy(true);
    supabase.rpc('get_delivery_quote', { p_address_id: selectedAddressId, p_subtotal: subtotal }).then(({ data, error }) => {
      if (!current) return;
      setDeliveryQuote(error ? { serviceable: false, reason: error.message || 'Delivery could not be verified' } : data);
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
    if (!selectedAddressId || placingOrder) return;
    setPlacingOrder(true);
    setCheckoutError('');
    const { data, error } = await supabase.rpc('place_customer_order', {
      p_address_id: selectedAddressId,
      p_items: cartItems.map(item => ({
        product_id: item.id,
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
      p_customer_note: null,
      p_coupon_code: appliedCoupon?.code || null,
    });
    setPlacingOrder(false);
    if (error) {
      setCheckoutError(error.message || 'Order place nahi ho saka. Please try again.');
      setAppliedCoupon(null);
      return;
    }
    setOrderId(String(data.order_id));
    setCart({});
    setAppliedCoupon(null); setCouponInput(''); setCouponError('');
    setCheckoutOpen(false);
    setCartOpen(false);
  };

  const startShopping = () => {
    setCategory('All');
    setSearch('');
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  const inStockProducts = products.filter(product => product.stock > 0);
  const newArrivals = [...inStockProducts]
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
    .slice(0, 4);
  const topRatedProducts = [...inStockProducts]
    .filter(product => product.reviews > 0)
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
    .slice(0, 4);
  const popularProducts = [...inStockProducts]
    .filter(product => product.reviews > 0)
    .sort((a, b) => b.reviews - a.reviews || b.rating - a.rating)
    .slice(0, 4);
  const newArrivalIds = new Set(newArrivals.map(product => product.id));
  const recommendedProducts = [...inStockProducts]
    .filter(product => !newArrivalIds.has(product.id))
    .sort((a, b) => {
      const discountA = a.mrp > 0 ? (a.mrp - a.price) / a.mrp : 0;
      const discountB = b.mrp > 0 ? (b.mrp - b.price) / b.mrp : 0;
      return discountB - discountA || b.rating - a.rating;
    })
    .slice(0, 4);
  const recentlyViewedProducts = recentlyViewedIds
    .map(id => products.find(product => product.id === id))
    .filter((product): product is Product => Boolean(product && product.stock > 0));

  const renderHomeShelf = (title: string, kicker: string, items: Product[], sectionId: string) => (
    items.length > 0 ? (
      <section className="home-shelf" aria-labelledby={sectionId}>
        <div className="home-shelf-heading">
          <div><span className="eyebrow">{kicker}</span><h2 id={sectionId}>{title}</h2></div>
          <button type="button" onClick={startShopping}>View all <ArrowRight size={15}/></button>
        </div>
        <div className="home-shelf-grid">
          {items.map(product => {
            const discount = product.mrp > product.price && product.mrp > 0
              ? Math.round((1 - product.price / product.mrp) * 100) : 0;
            return (
              <article className="home-shelf-card" key={sectionId + product.id}>
                <button className="home-shelf-image" type="button" onClick={() => {
                  rememberViewedProduct(product);
                  window.location.href = '/product/' + product.id;
                }} aria-label={'View ' + product.name}>
                  {product.imageUrl ? <img src={product.imageUrl} alt={product.name}/> : <span>{product.emoji}</span>}
                  {discount > 0 && <b>{discount}% OFF</b>}
                </button>
                <div className="home-shelf-info">
                  <small>{product.category}</small>
                  <button className="home-shelf-name" type="button" onClick={() => { rememberViewedProduct(product); window.location.href = '/product/' + product.id; }}>{product.name}</button>
                  <div><strong>{money(product.price)}</strong>{product.mrp > product.price && <del>{money(product.mrp)}</del>}</div>
                  <button className="home-shelf-add" type="button" onClick={() => addToCart(product)}><Plus size={14}/> Add to cart</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    ) : null
  );

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
        <nav className="category-nav" aria-label="Product categories">
          {categories.map(item => (
            <button
              key={item.name}
              className={
                category === item.name ? 'nav-category active' : 'nav-category'
              }
              onClick={() => {
                setCategory(item.name);
                setSearch('');
              }}
            >
              <span>{item.emoji}</span>
              {item.name === 'All' ? 'All products' : item.name}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" /> THE PUASH EDIT
            </div>
            <h1>
              Good finds.
              <br />
              <em>Good feeling.</em>
            </h1>
            <p>Everyday essentials and little discoveries, all in one place.</p>
            <button className="primary-button" onClick={startShopping}>
              Explore products <ArrowRight size={17} />
            </button>
            <div className="hero-note">
              <span>✦</span> A little inspiration from Kashmir
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Animated PUASH Kashmir-inspired shopping illustration"
          >
            <div className="hero-glow" />
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-sun" />
            <div className="hero-mountain mountain-back" />
            <div className="hero-mountain mountain-front" />
            <div className="hero-bag">
              <span className="bag-handle" />
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <path d="M18 38h64l-5 48H23l-5-48Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/>
                <path d="M34 39v-8a16 16 0 0 1 32 0v8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
                <path d="m32 62 10 9 25-25" fill="none" stroke="#D9B58E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>PUASH</span>
              <small>MADE FOR EVERYDAY</small>
            </div>
            <div className="floating-card card-one">
              <span>✦</span>
              <strong>Everyday</strong>
              <small>favourites</small>
            </div>
            <div className="floating-card card-two">
              <span>♡</span>
              <strong>Picked</strong>
              <small>with care</small>
            </div>
            <div className="hero-flower">✿</div>
            <span className="hero-spark spark-one">✦</span>
            <span className="hero-spark spark-two">✧</span>
            <span className="hero-spark spark-three">✦</span>
          </div>
          <div className="hero-bottom">
            <span>01 / DISCOVER</span>
            <span>
              SHOP THE EVERYDAY COLLECTION <ArrowRight size={13} />
            </span>
          </div>
        </section>

        <section className="benefit-row" aria-label="Shopping benefits">
          <div>
            <Truck size={20} />
            <span>
              <strong>Easy delivery</strong>
              <small>Delivery options at checkout</small>
            </span>
          </div>
          <div>
            <ShieldCheck size={20} />
            <span>
              <strong>Simple shopping</strong>
              <small>A clean, easy experience</small>
            </span>
          </div>
          <div>
            <PackageCheck size={20} />
            <span>
              <strong>Curated finds</strong>
              <small>Everyday picks in one place</small>
            </span>
          </div>
        </section>

        <section className="home-category-section" aria-labelledby="home-category-title">
          <div className="home-shelf-heading">
            <div><span className="eyebrow">FIND YOUR EVERYDAY FAVOURITES</span><h2 id="home-category-title">Shop by category</h2></div>
            <button type="button" onClick={startShopping}>Explore all <ArrowRight size={15}/></button>
          </div>
          <div className="home-category-grid">
            {categories.filter(item => item.name !== 'All').map(item => {
              const count = products.filter(product => product.category === item.name && product.stock > 0).length;
              return (
                <button type="button" className="home-category-card" key={item.name} onClick={() => {
                  setCategory(item.name); setSearch('');
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  <span className="home-category-emoji">{item.emoji}</span>
                  <strong>{item.name}</strong>
                  <small>{count > 0 ? count + (count === 1 ? ' product' : ' products') : 'Explore collection'}</small>
                  <ArrowRight size={15}/>
                </button>
              );
            })}
          </div>
        </section>

        <section className="home-promo-strip" aria-label="PUASH shopping promise">
          <div><span className="home-promo-icon">✦</span><span><strong>Discover something new</strong><small>Fresh finds for your everyday life</small></span></div>
          <div><span className="home-promo-icon">♡</span><span><strong>Save what you love</strong><small>Keep favourites close with your wishlist</small></span></div>
          <div><span className="home-promo-icon">⌁</span><span><strong>Easy checkout</strong><small>Clear totals before you place an order</small></span></div>
        </section>

        {renderHomeShelf('New arrivals', 'JUST ADDED TO PUASH', newArrivals, 'new-arrivals-title')}
        {renderHomeShelf('Popular with shoppers', 'CUSTOMER FEEDBACK', popularProducts, 'popular-products-title')}
        {renderHomeShelf('Picked for you', 'A LITTLE INSPIRATION', recommendedProducts, 'recommended-products-title')}
        {renderHomeShelf('Top rated', 'CUSTOMER REVIEWS', topRatedProducts, 'top-rated-title')}
        {renderHomeShelf('Recently viewed', 'PICK UP WHERE YOU LEFT OFF', recentlyViewedProducts, 'recently-viewed-title')}

        <section className="products-section" id="products">
          <div className="section-heading">
            <div>
              <div className="eyebrow">A LITTLE BIT OF EVERYTHING</div>
              <h2>{category === 'All' ? 'Explore our picks' : category}</h2>
              <p>Find something useful, lovely or just right for you.</p>
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
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>
          <div className="category-chips">
            {categories.map(item => (
              <button
                key={item.name}
                className={category === item.name ? 'chip selected' : 'chip'}
                onClick={() => {
                  setCategory(item.name);
                  setSearch('');
                }}
              >
                {item.emoji} {item.name}
              </button>
            ))}
          </div>
          <div className="advanced-filter-panel" aria-label="Filter products">
            <div className="advanced-filter-title"><SlidersHorizontal size={15}/><strong>Refine your search</strong></div>
            <label className="filter-field"><span>Min price (₹)</span><input inputMode="numeric" type="number" min="0" placeholder="No minimum" value={minPrice} onChange={event => setMinPrice(event.target.value)}/></label>
            <label className="filter-field"><span>Max price (₹)</span><input inputMode="numeric" type="number" min="0" placeholder="No maximum" value={maxPrice} onChange={event => setMaxPrice(event.target.value)}/></label>
            <label className="filter-field"><span>Minimum rating</span><select value={minRating} onChange={event => setMinRating(event.target.value)}><option value="0">Any rating</option><option value="3">3★ & above</option><option value="4">4★ & above</option><option value="4.5">4.5★ & above</option></select></label>
            <label className="saved-only-filter"><input type="checkbox" checked={savedOnly} onChange={event => setSavedOnly(event.target.checked)}/> Saved items only</label><button type="button" className="clear-filter-button" onClick={() => { setMinPrice(''); setMaxPrice(''); setMinRating('0'); setSavedOnly(false); setSort('featured'); setSearch(''); setCategory('All'); }}>Clear filters</button>
          </div>
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
                const discount = Math.round(
                  (1 - product.price / product.mrp) * 100
                );
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
                        <span className="rating">
                          <Star size={12} fill="currentColor" />{' '}
                          {product.rating}
                        </span>
                        <span className="review-count">
                          ({product.reviews} reviews)
                        </span>
                      </div>
                      <div className="price-row">
                        <strong>{money(product.price)}</strong>
                        <del>{money(product.mrp)}</del>
                        <span>{discount}% off</span>
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
        <button
          onClick={() => {
            setCategory('All');
            setSearch('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Home size={19} />
          <span>Home</span>
        </button>
        <button
          onClick={() =>
            document
              .getElementById('products')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <Grid2X2 size={19} />
          <span>Explore</span>
        </button>
        <button onClick={() => { window.location.href = '/account'; }}>
          <UserRound size={19} />
          <span>Account</span>
        </button>
        <button onClick={() => setCartOpen(true)} className="mobile-cart-nav">
          <ShoppingBag size={19} />
          <span>Cart</span>
          {cartCount > 0 && <b>{cartCount}</b>}
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
