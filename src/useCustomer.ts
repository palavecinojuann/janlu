import { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp, collection, query, where, getDocs, limit, getDoc, setDoc } from 'firebase/firestore';
import { Customer, Coupon, CustomerBenefit, Sale } from './types';
import { v4 as uuidv4 } from 'uuid';
import { handleFirestoreError, OperationType, cleanObject } from './utils/firebaseHelpers';

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

/**
 * Normaliza y registra un cliente previniendo duplicados mediante una consulta cruzada en Firestore
 * y asigna de forma transaccional el número de cliente correlativo y su beneficio de bienvenida.
 */
export async function addCustomerWithAntiMatching(customerData: Omit<Customer, 'id' | 'createdAt'> & { id?: string }): Promise<Customer> {
  const normalizeEmail = (e?: string) => e?.trim().toLowerCase() || '';
  const normalizePhone = (p?: string) => p?.replace(/\D/g, '') || '';

  const emailNorm = normalizeEmail(customerData.email);
  const phoneNorm = normalizePhone(customerData.phone);

  try {
    // 1. Validación Cruzada con límite de lectura de 1
    if (emailNorm) {
      const emailQuery = query(collection(db, 'customers'), where('email', '==', emailNorm), limit(1));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) {
        throw new Error('El email ya se encuentra registrado');
      }
    }

    if (phoneNorm) {
      const phoneQuery = query(collection(db, 'customers'), where('phone', '==', phoneNorm), limit(1));
      const phoneSnap = await getDocs(phoneQuery);
      if (!phoneSnap.empty) {
        throw new Error('El número telefónico ya se encuentra registrado');
      }
    }

    // 2. Transacción atómica de registro y generación de número correlativo
    const customerId = customerData.id || uuidv4();
    const customerRef = doc(db, 'customers', customerId);
    const counterRef = doc(db, 'metadata', 'counters');
    const settingsRef = doc(db, 'settings', 'global');

    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const settingsDoc = await transaction.get(settingsRef);
      
      const settings = settingsDoc.exists() ? settingsDoc.data() : {};
      
      let nextNumber = 1;
      if (counterDoc.exists() && typeof counterDoc.data().lastCustomerNumber === 'number') {
        nextNumber = counterDoc.data().lastCustomerNumber + 1;
      }
      
      const customerNumber = `JANLU-${nextNumber.toString().padStart(4, '0')}`;

      // Configuración del Beneficio de Bienvenida
      const welcomeBenefitType = settings.welcomeBenefitType || 'discount';
      const welcomeDiscountPercentage = Number(settings.welcomeDiscountPercentage || 15);
      const welcomeGiftName = settings.welcomeGiftName || 'Regalo de Bienvenida';
      const welcomeCouponExpiresDays = Number(settings.welcomeCouponExpiresDays || 30);
      
      const benefits: CustomerBenefit[] = [];
      let couponToCreate: Coupon | null = null;

      if (welcomeBenefitType === 'discount' && emailNorm) {
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `BIENVENIDA${welcomeDiscountPercentage}-${suffix}`;
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + welcomeCouponExpiresDays);

        couponToCreate = {
          id: uuidv4(),
          code,
          discountPercentage: welcomeDiscountPercentage,
          expiresAt: expiresAt.toISOString(),
          customerId: customerId,
          isUsed: false,
          createdAt: new Date().toISOString()
        };

        benefits.push({
          id: uuidv4(),
          type: 'discount',
          value: welcomeDiscountPercentage,
          code,
          grantedAt: new Date().toISOString(),
          isUsed: false
        });
      } else if (welcomeBenefitType === 'gift') {
        benefits.push({
          id: uuidv4(),
          type: 'gift',
          value: welcomeGiftName,
          grantedAt: new Date().toISOString(),
          isUsed: false
        });
      }

      const finalCustomer: Customer = {
        ...customerData,
        id: customerId,
        email: emailNorm,
        phone: phoneNorm,
        customerNumber,
        completedSalesCount: 0,
        purchaseHistory: [],
        benefits,
        welcomeDiscountUsed: false,
        discountPercentage: welcomeDiscountPercentage,
        registeredAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      transaction.set(customerRef, cleanObject(finalCustomer));
      transaction.set(counterRef, { lastCustomerNumber: nextNumber }, { merge: true });

      if (couponToCreate) {
        transaction.set(doc(db, 'coupons', couponToCreate.id), cleanObject(couponToCreate));
      }

      return finalCustomer;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'customers/register');
    throw error;
  }
}

/**
 * Asigna manualmente un beneficio, descuento o cupón a cualquier cliente registrado
 */
export async function grantManualBenefitToCustomer(
  customerId: string, 
  benefitData: { type: 'discount' | 'gift'; value: string | number }
): Promise<void> {
  const customerRef = doc(db, 'customers', customerId);

  try {
    await runTransaction(db, async (transaction) => {
      const customerDoc = await transaction.get(customerRef);
      if (!customerDoc.exists()) {
        throw new Error('El cliente no existe.');
      }
      
      const customer = customerDoc.data() as Customer;
      const benefits = customer.benefits || [];
      
      let couponToCreate = null;
      let couponCode = undefined;

      if (benefitData.type === 'discount') {
        const discountPercentage = Number(benefitData.value);
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        couponCode = `MANUAL${discountPercentage}-${suffix}`;
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        couponToCreate = {
          id: uuidv4(),
          code: couponCode,
          discountPercentage,
          expiresAt: expiresAt.toISOString(),
          customerId: customerId,
          isUsed: false,
          createdAt: new Date().toISOString()
        };
      }

      const newBenefit: CustomerBenefit = {
        id: uuidv4(),
        type: benefitData.type,
        value: benefitData.value,
        code: couponCode,
        grantedAt: new Date().toISOString(),
        isUsed: false
      };

      const updatedBenefits = [...benefits, newBenefit];
      
      transaction.update(customerRef, { benefits: cleanObject(updatedBenefits) });
      
      if (couponToCreate) {
        transaction.set(doc(db, 'coupons', couponToCreate.id), cleanObject(couponToCreate));
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `customers/${customerId}/benefits`);
  }
}

/**
 * Registra un hito de compra finalizada incrementando contadores y otorgando cupones/regalos de lealtad
 */
export async function handleSaleStatusCompleted(sale: Sale): Promise<void> {
  if (!sale.customerId || sale.customerId === 'guest') return;

  const customerRef = doc(db, 'customers', sale.customerId);
  const settingsRef = doc(db, 'settings', 'global');

  try {
    await runTransaction(db, async (transaction) => {
      const customerDoc = await transaction.get(customerRef);
      if (!customerDoc.exists()) {
        console.warn(`Customer ${sale.customerId} not found for sale ${sale.id}`);
        return;
      }

      const customer = customerDoc.data() as Customer;
      const purchaseHistory = customer.purchaseHistory || [];

      // Evitar procesamiento duplicado
      if (purchaseHistory.includes(sale.id)) {
        return;
      }

      const settingsDoc = await transaction.get(settingsRef);
      const settings = settingsDoc.exists() ? settingsDoc.data() : {};

      const completedSalesCount = (customer.completedSalesCount || 0) + 1;
      const updatedHistory = [...purchaseHistory, sale.id];
      const benefits = customer.benefits || [];

      const loyaltyMilestone = Number(settings.loyaltyMilestone || 5);
      const loyaltyBenefitType = settings.loyaltyBenefitType || 'discount';
      
      let couponToCreate = null;
      let newBenefit = null;

      // Verificar si alcanza el hito de fidelización
      if (completedSalesCount > 0 && completedSalesCount % loyaltyMilestone === 0) {
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        if (loyaltyBenefitType === 'discount') {
          const discountPercentage = Number(settings.loyaltyDiscountPercentage || 20);
          const couponCode = `PREMIUM${discountPercentage}-${suffix}`;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          couponToCreate = {
            id: uuidv4(),
            code: couponCode,
            discountPercentage,
            expiresAt: expiresAt.toISOString(),
            customerId: sale.customerId,
            isUsed: false,
            createdAt: new Date().toISOString()
          };

          newBenefit = {
            id: uuidv4(),
            type: 'discount' as const,
            value: discountPercentage,
            code: couponCode,
            grantedAt: new Date().toISOString(),
            isUsed: false
          };
        } else {
          const giftName = settings.loyaltyGiftName || 'Vela Premium';
          newBenefit = {
            id: uuidv4(),
            type: 'gift' as const,
            value: giftName,
            grantedAt: new Date().toISOString(),
            isUsed: false
          };
        }
      }

      const updatedCustomer: Partial<Customer> = {
        completedSalesCount,
        purchaseHistory: updatedHistory,
      };

      if (newBenefit) {
        updatedCustomer.benefits = cleanObject([...benefits, newBenefit]);
      }

      transaction.update(customerRef, updatedCustomer);

      if (couponToCreate) {
        transaction.set(doc(db, 'coupons', couponToCreate.id), cleanObject(couponToCreate));
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `customers/${sale.customerId}/loyalty-milestone`);
  }
}

/**
 * Revierte un hito de compra finalizada
 */
export async function handleSaleStatusReverted(sale: Sale): Promise<void> {
  if (!sale.customerId || sale.customerId === 'guest') return;

  const customerRef = doc(db, 'customers', sale.customerId);

  try {
    await runTransaction(db, async (transaction) => {
      const customerDoc = await transaction.get(customerRef);
      if (!customerDoc.exists()) return;

      const customer = customerDoc.data() as Customer;
      const purchaseHistory = customer.purchaseHistory || [];

      // Si no estaba en el historial, no hay nada que revertir
      if (!purchaseHistory.includes(sale.id)) {
        return;
      }

      const completedSalesCount = Math.max(0, (customer.completedSalesCount || 0) - 1);
      const updatedHistory = purchaseHistory.filter(id => id !== sale.id);

      transaction.update(customerRef, {
        completedSalesCount,
        purchaseHistory: updatedHistory
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `customers/${sale.customerId}/loyalty-revert`);
  }
}
