import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { seedInitialDataIfNeeded } from './services/storage';

// Initialize the Local-First IndexedDB database
seedInitialDataIfNeeded().catch((err) => {
  console.error('Failed to initialize local IndexedDB database:', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
