import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { Product, Campaign, Offer, Course, StoreSettings, RawMaterial } from '../types';
import { OperationType, trackClientReadRate } from '../utils/firebaseHelpers';

const stableStringify = (obj: any): string => {
  return JSON.stringify(obj, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted: any, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  });
};

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
  const campaignsStringRef = useRef<string>('');
  const offersStringRef = useRef<string>('');
  const coursesStringRef = useRef<string>('');

  useEffect(() => {
    console.log("[DEBUG-FIRESTORE] useEffect usePublicInventory triggered. isAuthReady:", isAuthReady);
    if (!isAuthReady) return;

    const handlePublicError = (e: unknown, op: OperationType, path: string) => {
      console.warn(`[Public collection error] ${path}:`, e);
    };

    console.log("[DEBUG-FIRESTORE] Registering public collection listeners...");

    console.log("[DEBUG-FIRESTORE] Subscribing to 'products' collection...");
    const unsubProducts = onSnapshot(query(collection(db, 'products')), (snapshot) => {
      console.log(`[DEBUG-FIRESTORE] 'products' snapshot callback fired. Size: ${snapshot.docs.length} docs`);
      trackClientReadRate(snapshot.docs.length || 1);
      const newData = snapshot.docs.map(doc => {
        const data = doc.data() as Product;
        return {
          ...data,
          id: doc.id,
          catalogType: data.catalogType || 'vela'
        };
      });
      newData.sort((a, b) => a.id.localeCompare(b.id));
      const newDataString = stableStringify(newData);

      if (newDataString !== productsStringRef.current) {
        productsStringRef.current = newDataString;
        setProducts(newData);
        console.log("✅ Productos actualizados (Cambio real detectado)");
      }
    }, (e) => handlePublicError(e, OperationType.GET, 'products'));

    console.log("[DEBUG-FIRESTORE] Subscribing to 'campaigns' collection...");
    const unsubCampaigns = onSnapshot(query(collection(db, 'campaigns')), (snapshot) => {
      console.log(`[DEBUG-FIRESTORE] 'campaigns' snapshot callback fired. Size: ${snapshot.docs.length} docs`);
      trackClientReadRate(snapshot.docs.length || 1);
      const newData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Campaign));
      newData.sort((a, b) => a.id.localeCompare(b.id));
      const newDataString = stableStringify(newData);
      if (newDataString !== campaignsStringRef.current) {
        campaignsStringRef.current = newDataString;
        setCampaigns(newData);
        console.log("✅ Campañas actualizadas (Cambio real detectado)");
      }
    }, (e) => handlePublicError(e, OperationType.GET, 'campaigns'));

    console.log("[DEBUG-FIRESTORE] Subscribing to 'offers' collection...");
    const unsubOffers = onSnapshot(query(collection(db, 'offers')), (snapshot) => {
      console.log(`[DEBUG-FIRESTORE] 'offers' snapshot callback fired. Size: ${snapshot.docs.length} docs`);
      trackClientReadRate(snapshot.docs.length || 1);
      const newData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Offer));
      newData.sort((a, b) => a.id.localeCompare(b.id));
      const newDataString = stableStringify(newData);
      if (newDataString !== offersStringRef.current) {
        offersStringRef.current = newDataString;
        setOffers(newData);
        console.log("✅ Ofertas actualizadas (Cambio real detectado)");
      }
    }, (e) => handlePublicError(e, OperationType.GET, 'offers'));

    console.log("[DEBUG-FIRESTORE] Subscribing to 'courses' collection...");
    const unsubCourses = onSnapshot(query(collection(db, 'courses')), (snapshot) => {
      console.log(`[DEBUG-FIRESTORE] 'courses' snapshot callback fired. Size: ${snapshot.docs.length} docs`);
      trackClientReadRate(snapshot.docs.length || 1);
      const newData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course));
      newData.sort((a, b) => a.id.localeCompare(b.id));
      const newDataString = stableStringify(newData);
      if (newDataString !== coursesStringRef.current) {
        coursesStringRef.current = newDataString;
        setCourses(newData);
        console.log("✅ Cursos actualizados (Cambio real detectado)");
      }
    }, (e) => handlePublicError(e, OperationType.GET, 'courses'));



    console.log("[DEBUG-FIRESTORE] Subscribing to 'settings' global doc...");
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      console.log(`[DEBUG-FIRESTORE] 'settings' global snapshot callback fired. Exists: ${docSnap.exists()}`);
      trackClientReadRate(1);
      if (docSnap.exists()) {
        setStoreSettings(docSnap.data() as StoreSettings);
      }
      setIsSettingsLoaded(true);
    }, (e) => {
      handlePublicError(e, OperationType.GET, 'settings');
      setIsSettingsLoaded(true);
    });

    return () => {
      console.log("[DEBUG-FIRESTORE] Cleaning up public collection listeners...");
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
    isSettingsLoaded,
    rawMaterials: []
  };
}
