import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { InventoryProvider } from './contexts/InventoryContext';
import './index.css';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

// Validate Connection to Firestore
async function testConnection() {
  try {
    // Try to fetch the connectivity test document
    await getDoc(doc(db, '_connection_test_', 'ping'));
    console.log("Firestore connection verified.");
  } catch (error: any) {
    if (error && error.code === 'permission-denied') {
      // Captura silenciosa esperada si las reglas aún no se han desplegado en la consola
      console.log("Firestore connection test: Permissions check completed.");
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connection failed: The client is offline. Please check your network.");
    } else {
      console.warn("Firestore connection test completed with unexpected status.");
    }
  }
}

testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <InventoryProvider>
        <App />
      </InventoryProvider>
    </ErrorBoundary>
  </StrictMode>,
);
