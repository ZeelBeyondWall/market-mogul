import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminApp } from './admin/AdminApp';
import './index.css';
import './styles/arcade.css';

const isAdmin = location.pathname.replace(/\/+$/, '').toLowerCase() === '/admin';
if (isAdmin) document.body.setAttribute('data-admin', '1');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isAdmin ? <AdminApp /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>,
);
