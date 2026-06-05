import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { InventoryProvider } from './contexts/InventoryContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <InventoryProvider>
      <App />
    </InventoryProvider>
  </ErrorBoundary>,
);
