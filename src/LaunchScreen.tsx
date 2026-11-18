import { useEffect, useState } from 'react';
import KashmirDeliveryScene from './KashmirDeliveryScene';
import './launch-screen.css';

export default function LaunchScreen() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLeaving(true), 4400);
    const removeTimer = window.setTimeout(() => setVisible(false), 4900);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`launch-screen${leaving ? ' launch-screen--leaving' : ''}`} role="status" aria-label="PUASH delivery is getting ready">
      <div className="launch-brand">
        <span className="launch-brand-mark">✦</span>
        <span>PUASH<span className="launch-brand-dot">.</span></span>
        <small>GOOD FINDS. GOOD FEELING.</small>
      </div>
      <div className="launch-copy">
        <span>YOUR KASHMIR DELIVERY</span>
        <strong>IS ON THE WAY</strong>
      </div>
      <KashmirDeliveryScene />
      <div className="launch-bottom">
        <span>Bringing goodness closer to you</span>
        <div className="launch-progress" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}
