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

// One intro per native app session. Page reloads and in-app navigation must not replay it.
let showLaunchScreen = false;
if (Capacitor.isNativePlatform()) {
  try {
    showLaunchScreen = sessionStorage.getItem('puash-launch-seen') !== '1';
    if (showLaunchScreen) sessionStorage.setItem('puash-launch-seen', '1');
  } catch {
    showLaunchScreen = false;
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
