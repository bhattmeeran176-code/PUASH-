import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import Admin from './Admin';
import Account from './Account';
import ProductDetail from './ProductDetail';
import Seller from './Seller';
import LaunchScreen from './LaunchScreen';
import './index.css';
import './cart-checkout.css';
import './seller.css';
import './launch-screen.css';

const currentPath = window.location.pathname;
const Page = currentPath.startsWith('/admin') ? Admin : currentPath.startsWith('/seller') ? Seller : currentPath.startsWith('/account') ? Account : currentPath.startsWith('/product/') ? ProductDetail : App;

// Show the animated intro only once when the native PUASH app session starts.
// Browser visits and page refreshes must never replay the launch animation.
let showLaunchScreen = false;
if (Capacitor.isNativePlatform()) {
  try {
    showLaunchScreen = sessionStorage.getItem('puash-launch-screen-shown') !== 'yes';
    if (showLaunchScreen) sessionStorage.setItem('puash-launch-screen-shown', 'yes');
  } catch {
    // If session storage is unavailable, show it only for this document load.
    showLaunchScreen = true;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <Page />
      {showLaunchScreen && <LaunchScreen />}
    </>
  </StrictMode>
);
