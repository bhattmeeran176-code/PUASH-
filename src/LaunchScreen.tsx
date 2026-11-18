import { useEffect, useState } from 'react';
import { ShoppingBag, Truck } from 'lucide-react';
import './launch-screen.css';

export default function LaunchScreen() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLeaving(true), 2050);
    const removeTimer = window.setTimeout(() => setVisible(false), 2550);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`launch-screen${leaving ? ' launch-screen--leaving' : ''}`} role="status" aria-label="PUASH is getting ready">
      <div className="launch-content">
        <div className="launch-brand-mark"><ShoppingBag size={29} strokeWidth={1.7} /></div>
        <div className="launch-wordmark">PUASH<span>.</span></div>
        <p className="launch-tagline">Good finds. Good feeling.</p>
        <div className="launch-road" aria-hidden="true">
          <span className="launch-road-line" />
          <span className="launch-truck"><Truck size={35} strokeWidth={1.8} /></span>
          <span className="launch-package">✦</span>
        </div>
        <p className="launch-message">A little goodness is on its way</p>
        <div className="launch-progress"><span /></div>
      </div>
    </div>
  );
}
