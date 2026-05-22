import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initSentry } from './lib/sentry';
import './index.css';
import App from './App.jsx';

// Initialise Sentry before rendering — captures errors during app startup
initSentry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
