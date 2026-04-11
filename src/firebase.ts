import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIRESTORE_DATABASE_ID
};

const app = initializeApp(firebaseConfig);

// Inicializamos la base de datos
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
export const auth = getAuth(app);

// 🛡️ ESCUDO DE AHORRO: Activamos la caché local
// Esto evita que Firebase gaste lecturas si el usuario ya tiene los datos en su PC
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Probablemente hay muchas pestañas abiertas al mismo tiempo
    console.warn('La persistencia de Firestore falló: múltiples pestañas abiertas.');
  } else if (err.code === 'unimplemented') {
    // El navegador es muy viejo y no soporta esto
    console.warn('El navegador no soporta persistencia offline.');
  }
});
