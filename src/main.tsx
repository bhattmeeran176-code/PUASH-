import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Admin from './Admin';
import Account from './Account';
import ProductDetail from './ProductDetail';
import Seller from './Seller';
import { supabase } from './supabase';
import './index.css';
import './cart-checkout.css';
import './seller.css';

const currentPath = window.location.pathname;
const Page = currentPath.startsWith('/admin') ? Admin : currentPath.startsWith('/seller') ? Seller : currentPath.startsWith('/account') ? Account : currentPath.startsWith('/product/') ? ProductDetail : App;

function DeliveryLaunch({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 2400);
    return () => window.clearTimeout(timer);
  }, [onComplete]);
  return <main className="puash-launch" aria-label="PUASH loading">
    <div className="puash-launch-mark">PUASH<span>.</span></div>
    <div className="puash-delivery-scene">
      <div className="puash-delivery-road"/>
      <div className="puash-delivery-scooter"><span className="puash-delivery-box">P</span><span className="puash-delivery-wheel wheel-left"/><span className="puash-delivery-wheel wheel-right"/></div>
      <span className="puash-delivery-spark spark-one">✦</span><span className="puash-delivery-spark spark-two">✦</span>
    </div>
    <h1>Good finds are on their way.</h1>
    <p>Thoughtful picks, delivered with care — rooted in Kashmir.</p>
    <div className="puash-launch-dots"><i/><i/><i/></div>
  </main>;
}

function AppEntry() {
  const [showLaunch, setShowLaunch] = useState(currentPath === '/');
  const [allowed, setAllowed] = useState(currentPath !== '/');
  useEffect(() => {
    if (currentPath !== '/') return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data.session) window.location.replace('/account');
      else setAllowed(true);
    }).catch(() => { if (alive) window.location.replace('/account'); });
    return () => { alive = false; };
  }, []);
  if (showLaunch) return <DeliveryLaunch onComplete={() => setShowLaunch(false)} />;
  if (!allowed) return <div className="puash-entry-loading">Preparing your PUASH experience…</div>;
  return <Page />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppEntry />
  </StrictMode>
);
