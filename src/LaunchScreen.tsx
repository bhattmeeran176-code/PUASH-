import { useEffect, useState } from 'react';
import './launch-screen.css';

export default function LaunchScreen() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLeaving(true), 4200);
    const removeTimer = window.setTimeout(() => setVisible(false), 4700);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`launch-screen${leaving ? ' launch-screen--leaving' : ''}`} role="status" aria-label="PUASH is loading">
      <img className="launch-background" src="/puash-fullscreen-splash.webp" alt="" />
      <div className="launch-progress" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
