import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Admin from './Admin';
import Account from './Account';
import './index.css';

const currentPath = window.location.pathname;
const Page = currentPath.startsWith('/admin') ? Admin : currentPath.startsWith('/account') ? Account : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>
);
