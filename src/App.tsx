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
  Truck,
  UserRound,
  X,
} from 'lucide-react';

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

function App() {
  const [category, setCategory] = useState('All');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState(sampleCategories);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('puash-cart') || '{}');
    } catch {
      return {};
    }
  });
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [checkoutAddresses, setCheckoutAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    localStorage.setItem('puash-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    let cancelled = false;
    async function loadStoreData() {
      const [productResult, categoryResult] = await Promise.all([
        supabase
          .from('products')
          .select('id,name,description,price,compare_at_price,image_url,stock_quantity,categories(name)')
          .eq('is_active', true)
          .gt('stock_quantity', 0)
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('id,name,slug')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (cancelled) return;
      if (productResult.error) {
        console.warn('PUASH products could not be loaded:', productResult.error.message);
        setProducts([]);
      } else {
        const liveProducts: Product[] = (productResult.data || []).map((row: any) => {
          const relation = Array.isArray(row.categories) ? row.categories[0] : row.categories;
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
            rating: 0,
            reviews: 0,
            emoji: emojiByCategory[productCategory] || '🛍️',
            tone: 'cream',
            description: row.description || 'Discover this product on PUASH.',
            imageUrl: row.image_url || null,
            stock: Number(row.stock_quantity || 0),
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
      const matchesCategory =
        category === 'All' || product.category === category;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [category, search, sort]);

  const cartItems = products.filter(product => (cart[product.id] || 0) > 0);
  const cartCount = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0
  );
  const subtotal = cartItems.reduce(
    (sum, product) => sum + product.price * cart[product.id],
    0
  );
  const delivery = subtotal === 0 || subtotal >= 999 ? 0 : 49;
  const total = subtotal + delivery;

  const addToCart = (product: Product) => {
    setCart(current => ({
      ...current,
      [product.id]: (current[product.id] || 0) + 1,
    }));
    setToast(product.name + ' added to cart');
  };

  const changeQuantity = (id: string, amount: number) => {
    setCart(current => {
      const next = { ...current };
      const quantity = (next[id] || 0) + amount;
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  };

  const beginCheckout = async () => {
    setCheckoutError('');
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
      .select('id,label,full_name,phone,line1,line2,city,state,postal_code,country,is_default')
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

  const placeOrder = async () => {
    if (!selectedAddressId || placingOrder) return;
    setPlacingOrder(true);
    setCheckoutError('');
    const { data, error } = await supabase.rpc('place_customer_order', {
      p_address_id: selectedAddressId,
      p_items: cartItems.map(product => ({
        product_id: product.id,
        quantity: cart[product.id],
      })),
      p_customer_note: null,
    });
    setPlacingOrder(false);
    if (error) {
      setCheckoutError(error.message || 'Order place nahi ho saka. Please try again.');
      return;
    }
    setOrderId(String(data.order_id));
    setCart({});
    setCheckoutOpen(false);
    setCartOpen(false);
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
            <span className="wordmark-symbol">
              <ShoppingBag size={19} strokeWidth={2.4} />
            </span>
            <span>
              PUASH<span className="wordmark-dot">.</span>
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
            aria-label="Decorative shopping illustration"
          >
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-sun" />
            <div className="hero-bag">
              <ShoppingBag size={88} strokeWidth={1.2} />
              <span>PUASH</span>
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
          {visibleProducts.length > 0 ? (
            <div className="product-grid">
              {visibleProducts.map(product => {
                const discount = Math.round(
                  (1 - product.price / product.mrp) * 100
                );
                return (
                  <article className="product-card" key={product.id}>
                    <button
                      className="product-visual"
                      onClick={() => setSelected(product)}
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
                        onClick={() => setSelected(product)}
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

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="product-modal"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="close-button"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <div className={'modal-product-art tone-' + selected.tone}>
              {selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} /> : selected.emoji}
            </div>
            <div className="modal-product-copy">
              <div className="product-category">{selected.category}</div>
              <h2>{selected.name}</h2>
              <div className="rating-line">
                <span className="rating">
                  <Star size={12} fill="currentColor" /> {selected.rating}
                </span>
                <span className="review-count">
                  ({selected.reviews} reviews)
                </span>
              </div>
              <p>{selected.description}</p>
              <div className="detail-stock"><span className="detail-stock-dot" /> In stock · {selected.stock} available</div>
              <div className="detail-delivery"><Truck size={16} /> Delivery options shown at checkout</div>
              <div className="modal-price">
                {money(selected.price)} <del>{money(selected.mrp)}</del>
              </div>
              <button
                className="primary-button full-button"
                onClick={() => {
                  addToCart(selected);
                  setSelected(null);
                }}
              >
                Add to cart <ShoppingBag size={17} />
              </button>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside
            className="cart-drawer"
            onClick={event => event.stopPropagation()}
          >
            <div className="drawer-heading">
              <div>
                <span className="eyebrow">YOUR PICKS</span>
                <h2>
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
                    <div className="cart-item" key={product.id}>
                      <div className={'cart-item-art tone-' + product.tone}>
                        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : product.emoji}
                      </div>
                      <div className="cart-item-details">
                        <strong>{product.name}</strong>
                        <small>{money(product.price)} each</small>
                        <div className="quantity-control">
                          <button
                            onClick={() => changeQuantity(product.id, -1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={13} />
                          </button>
                          <span>{cart[product.id]}</span>
                          <button
                            onClick={() => changeQuantity(product.id, 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                      <strong className="cart-line-price">
                        {money(product.price * cart[product.id])}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(subtotal)}</strong>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <strong>{delivery === 0 ? 'Free' : money(delivery)}</strong>
                  </div>
                  <div className="summary-total">
                    <span>Total</span>
                    <strong>{money(total)}</strong>
                  </div>
                  <p>
                    {subtotal >= 999
                      ? 'You unlocked free delivery.'
                      : 'Add ' +
                        money(999 - subtotal) +
                        ' more for free delivery.'}
                  </p>
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
            <h2>Confirm your order.</h2>
            <p>Choose your saved delivery address. Payment method: Cash on Delivery.</p>
            {checkoutAddresses.length > 0 && <div className="checkout-address-list">
              <strong>Deliver to</strong>
              {checkoutAddresses.map((address: any) => <label className="checkout-address-option" key={address.id}>
                <input type="radio" name="checkout-address" checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} />
                <span><b>{address.label}{address.is_default ? ' · Default' : ''}</b><small>{address.full_name} · {address.phone}</small><small>{[address.line1,address.line2,address.city,address.state,address.postal_code,address.country].filter(Boolean).join(', ')}</small></span>
              </label>)}
            </div>}
            <div className="checkout-total">
              <span>Estimated order total</span>
              <strong>{money(total)}</strong>
            </div>
            {checkoutError && <div className="account-error">{checkoutError}</div>}
            <button
              className="primary-button full-button"
              onClick={placeOrder}
              disabled={placingOrder || !selectedAddressId}
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
            <h2>Order received!</h2>
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
