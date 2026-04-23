import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, query, limit } from 'firebase/firestore';
import { Product, Campaign, Offer, Course, StoreSettings } from '../types';
import { OperationType } from '../utils/firebaseHelpers';

export function usePublicInventory(isAuthReady: boolean) {
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    whatsappNumber: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    email: '',
    installmentsCount: 0,
    installmentsWithoutInterest: false,
    transferDiscountPercentage: 0,
    cashDiscountPercentage: 0
  });
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const productsStringRef = useRef<string>('');

  useEffect(() => {
    if (!isAuthReady) return;

    const handlePublicError = (e: unknown, op: OperationType, path: string) => {
      console.warn(`[Public collection error] ${path}:`, e);
    };

    const unsubProducts = onSnapshot(query(collection(db, 'products'), limit(200)), (snapshot) => {
      const newData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
      const newDataString = JSON.stringify(newData);

      if (newDataString !== productsStringRef.current) {
        productsStringRef.current = newDataString;
        setProducts(newData);
        console.log("✅ Productos actualizados (Cambio real detectado)");
      }
    }, (e) => handlePublicError(e, OperationType.GET, 'products'));

    const unsubCampaigns = onSnapshot(query(collection(db, 'campaigns'), limit(20)), (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Campaign)));
    }, (e) => handlePublicError(e, OperationType.GET, 'campaigns'));

    const unsubOffers = onSnapshot(query(collection(db, 'offers'), limit(20)), (snapshot) => {
      setOffers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Offer)));
    }, (e) => handlePublicError(e, OperationType.GET, 'offers'));

    const unsubCourses = onSnapshot(query(collection(db, 'courses'), limit(20)), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course)));
    }, (e) => handlePublicError(e, OperationType.GET, 'courses'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setStoreSettings(docSnap.data() as StoreSettings);
      }
      setIsSettingsLoaded(true);
    }, (e) => {
      handlePublicError(e, OperationType.GET, 'settings');
      setIsSettingsLoaded(true);
    });

    return () => {
      unsubProducts();
      unsubCampaigns();
      unsubOffers();
      unsubCourses();
      unsubSettings();
    };
  }, [isAuthReady]);

  return {
    products,
    campaigns,
    offers,
    courses,
    storeSettings,
    isSettingsLoaded
  };
}
