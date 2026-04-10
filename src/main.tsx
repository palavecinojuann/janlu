import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { InventoryProvider } from './contexts/InventoryContext';
import './index.css';
import { db } from './firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

// Validate Connection to Firestore
async function testConnection() {
  try {
    // Try to fetch a non-existent document to test connectivity
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log("Firestore connection verified.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore connection failed: The client is offline. Please check your Firebase configuration and internet connection.");
    } else {
      console.warn("Firestore connection test completed with expected error or other issue:", error);
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
