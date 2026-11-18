import { useEffect, useState } from 'react';
import PuashDeliveryMascot from './PuashDeliveryMascot';
import './launch-screen.css';

export default function LaunchScreen() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLeaving(true), 2850);
    const removeTimer = window.setTimeout(() => setVisible(false), 3350);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`launch-screen${leaving ? ' launch-screen--leaving' : ''}`} role="status" aria-label="PUASH is getting ready">
      <div className="launch-content">
        <div className="launch-wordmark" aria-label="PUASH">PUASH<span>.</span></div>
        <p className="launch-tagline">GOOD FINDS. GOOD FEELING.</p>
        <div className="launch-mascot-stage">
          <span className="launch-speed speed-one" />
          <span className="launch-speed speed-two" />
          <PuashDeliveryMascot />
          <span className="launch-delivery-glow" />
        </div>
        <div className="launch-delivery-copy">
          <span className="launch-eyebrow">FAST • CAREFUL • AT YOUR DOOR</span>
          <p className="launch-message">Your good finds are on the way.</p>
        </div>
        <div className="launch-progress"><span /></div>
      </div>
    </div>
  );
}
