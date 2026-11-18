import { useEffect, useState } from 'react';
import KashmirDeliveryScene from './KashmirDeliveryScene';
import './launch-screen.css';

export default function LaunchScreen() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLeaving(true), 4400);
    const removeTimer = window.setTimeout(() => setVisible(false), 4950);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`launch-screen${leaving ? ' launch-screen--leaving' : ''}`} role="status" aria-label="PUASH fast delivery is getting ready">
      <div className="launch-top">
        <div className="launch-brand-icon" aria-hidden="true"><span>✦</span></div>
        <div className="launch-wordmark">PUASH<span>.</span></div>
        <p className="launch-tagline">GOOD FINDS. GOOD FEELING.</p>
      </div>
      <div className="launch-headline">
        <span>FAST &amp; RELIABLE</span>
        <strong>DELIVERY<span>.</span></strong>
      </div>
      <KashmirDeliveryScene />
      <div className="launch-benefits" aria-label="PUASH delivery benefits">
        <div><span className="benefit-icon">↗</span><b>Across J&amp;K</b></div>
        <i />
        <div><span className="benefit-icon">◇</span><b>Secure packaging</b></div>
        <i />
        <div><span className="benefit-icon">↻</span><b>Easy returns</b></div>
      </div>
      <div className="launch-footer">
        <p className="launch-message">A little goodness is on its way.</p>
        <div className="launch-progress"><span /></div>
      </div>
    </div>
  );
}
