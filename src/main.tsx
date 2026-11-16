import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Admin from './Admin';
import './index.css';

const currentPath = window.location.pathname;
const Page = currentPath === '/admin' || currentPath.startsWith('/admin%') || currentPath.startsWith('/admin/') ? Admin : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>
);
