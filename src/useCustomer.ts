import { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { Customer } from './types';

export function useCustomer() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        // Subscribe to customer document
        unsubscribeDoc = onSnapshot(
          doc(db, 'customers', user.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              setCustomer({ ...docSnap.data(), id: docSnap.id } as Customer);
            } else {
              setCustomer(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error("Error fetching customer data:", err);
            setError(err as Error);
            setLoading(false);
          }
        );
      } else {
        setCustomer(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const validateWelcomeDiscount = useCallback(() => {
    if (!customer) return { isValid: false, reason: 'No hay sesión de cliente activa' };

    const now = new Date();
    const expiresAt = customer.discountExpiresAt ? new Date(customer.discountExpiresAt) : null;

    if (customer.welcomeDiscountUsed) {
      return { isValid: false, reason: 'El descuento de bienvenida ya fue utilizado' };
    }

    if (expiresAt && now > expiresAt) {
      return { isValid: false, reason: 'El descuento de bienvenida ha expirado' };
    }

    return { 
      isValid: true, 
      percentage: customer.discountPercentage || 10,
      expiresAt: expiresAt
    };
  }, [customer]);

  return {
    customer,
    loading,
    error,
    validateWelcomeDiscount
  };
}

/**
 * Helper to generate the next customer number in a transaction
 */
export async function generateNextCustomerNumber(): Promise<string> {
  const counterRef = doc(db, 'metadata', 'counters');
  
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let nextNumber = 1;
    
    if (counterDoc.exists()) {
      nextNumber = (counterDoc.data().lastCustomerNumber || 0) + 1;
    }
    
    transaction.set(counterRef, { lastCustomerNumber: nextNumber }, { merge: true });
    
    return `JANLU-${nextNumber.toString().padStart(4, '0')}`;
  });
}
