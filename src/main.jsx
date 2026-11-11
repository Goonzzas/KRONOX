import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import BootErrorBoundary from './components/BootErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <BootErrorBoundary>
    <App />
  </BootErrorBoundary>,
);
