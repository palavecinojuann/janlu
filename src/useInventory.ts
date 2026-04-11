import { useState, useEffect, useMemo, useRef } from 'react';
import { Product, DashboardMetrics, Customer, Sale, Quote, RawMaterial, FinancialDocument, Activity, ProductionOrder, Campaign, Offer, UserProfile, Simulation, PreAuthorizedAdmin, AuditLog, User, StoreSettings, Coupon, Course } from './types';
import { v4 as uuidv4 } from 'uuid';
import { db, auth } from './firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, getDoc, writeBatch, DocumentSnapshot, DocumentData, runTransaction, orderBy, limit, where, getDocs, DocumentReference } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { toUMB, Unit, UNIT_DIMENSIONS, UMB_FOR_DIMENSION } from './utils/units';
import { getVariantStock } from './utils/stockUtils';
import { roundFinancial, roundPrecise } from './utils/mathUtils';
import { generateNextCustomerNumber } from './useCustomer';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to replace undefined values with null before writing to Firestore
const cleanObject = (obj: any): any => {
  if (obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(v => cleanObject(v));
  } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned = Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : cleanObject(v)])
    );
    return cleaned;
  }
  return obj;
};

export function useInventory() {
  const [error, setError] = useState<Error | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [financialDocs, setFinancialDocs] = useState<FinancialDocument[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [preAuthorizedAdmins, setPreAuthorizedAdmins] = useState<PreAuthorizedAdmin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const hasFetchedNonCritical = useRef(false);
  
  // Memorias para evitar consumos duplicados
  const productsStringRef = useRef<string>('');
  const rawMaterialsStringRef = useRef<string>('');

  const refresh = () => {
    hasFetchedNonCritical.current = false;
    setRefreshTrigger(prev => prev + 1);
  };

  if (error) {
    throw error;
  }

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
      
      if (user) {
        // Optimistic admin grant for the owner to prevent UI flicker
        if (user.email === 'palavecinojuann@gmail.com') {
          setIsAdmin(prev => prev !== true ? true : prev);
        }

        // Check if user is admin with a timeout for offline/quota resilience
        try {
          const getDocPromise = getDoc(doc(db, 'users', user.uid));
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout fetching user role')), 5000)
          );
          
          const userDoc = await Promise.race([getDocPromise, timeoutPromise]) as DocumentSnapshot<DocumentData>;
          
          if (!userDoc.exists()) {
            if (user.email === 'palavecinojuann@gmail.com') {
              const newAdmin = {
                id: user.uid,
                uid: user.uid,
                email: user.email,
                role: 'admin',
                createdAt: new Date().toISOString(),
                name: user.displayName || 'Juan Palavecino',
                level: 'bronce',
                referralCode: `JANLU-${user.uid.substring(0, 4).toUpperCase()}`,
                referralPoints: 0,
                joinedAt: new Date().toISOString(),
              };
              await setDoc(doc(db, 'users', user.uid), newAdmin).catch(e => console.error("Error creating admin:", e));
            } else {
              // Check pre-auth
              let preAuthRole: string | null = null;
              if (user.email) {
                try {
                  const preAuthDoc = await getDoc(doc(db, 'preAuthorizedAdmins', user.email));
                  if (preAuthDoc.exists()) {
                    preAuthRole = preAuthDoc.data().role || 'admin';
                  }
                } catch (e) {
                  console.error("Error checking pre-auth:", e);
                }
              }

              const newUser = {
                id: user.uid,
                uid: user.uid,
                email: user.email,
                role: preAuthRole || 'customer',
                createdAt: new Date().toISOString(),
                name: user.displayName || 'Nuevo Usuario',
                level: 'bronce',
                referralCode: `JANLU-${user.uid.substring(0, 4).toUpperCase()}`,
                referralPoints: 0,
                joinedAt: new Date().toISOString(),
              };
              await setDoc(doc(db, 'users', user.uid), newUser).catch(e => console.error("Error creating user:", e));
            }
          }

          // Now set up real-time listener for user profile
          unsubUserDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) {
              const profile = docSnap.data() as UserProfile;
              setUserProfile(profile);
              const adminStatus = profile.role === 'admin' || profile.role === 'collaborator';
              setIsAdmin(prev => prev !== adminStatus ? adminStatus : prev);
              console.log("Admin status updated from profile:", adminStatus, profile.email);
            }
          }, (e) => {
            console.error("Error listening to user profile:", e);
          });

        } catch (err) {
          console.error("Error checking admin status:", err);
          // Fallback to email check if Firestore fails
          if (user.email === 'palavecinojuann@gmail.com') {
            setIsAdmin(prev => prev !== true ? true : prev);
          } else {
            setIsAdmin(prev => prev !== false ? false : prev);
          }
        }

        // Ensure customer doc exists (run once)
        const checkCustomer = async () => {
          try {
            const customerDoc = await getDoc(doc(db, 'customers', user.uid));
            if (!customerDoc.exists()) {
              const customerNumber = await generateNextCustomerNumber();
              const newCustomer: Customer = {
                id: user.uid,
                name: user.displayName?.split(' ')[0] || 'Nuevo',
                surname: user.displayName?.split(' ').slice(1).join(' ') || 'Usuario',
                email: user.email || '',
                phone: '',
                customerNumber,
                registeredAt: new Date().toISOString(),
                discountExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                welcomeDiscountUsed: false,
                discountPercentage: 10,
                assignedOffers: [],
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'customers', user.uid), cleanObject(newCustomer));
            }
          } catch (e) {
            console.warn("Could not check/create customer doc (likely quota):", e);
          }
        };
        checkCustomer();

      } else {
        setIsAdmin(prev => prev !== false ? false : prev);
        setUserProfile(null);
      }
      
      setIsAuthReady(true);
    });
    
    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

// Public Listeners
  useEffect(() => {
    if (!isAuthReady) return;

    const handlePublicError = (e: unknown, op: OperationType, path: string) => {
      console.warn(`[Public collection error] ${path}:`, e);
    };

    // 🛡️ Listener de Materias Primas con filtro
    const unsubRawMaterials = onSnapshot(query(collection(db, 'rawMaterials'), limit(100)), (snapshot) => {
      const newData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RawMaterial));
      const newDataString = JSON.stringify(newData);
      
      if (newDataString !== rawMaterialsStringRef.current) {
        rawMaterialsStringRef.current = newDataString;
        setRawMaterials(newData);
        console.log("✅ Insumos actualizados (Cambio real detectado)");
      }
    }, (e) => handlePublicError(e, OperationType.GET, 'rawMaterials'));

    // 🛡️ Listener de Productos con filtro
    const unsubProducts = onSnapshot(query(collection(db, 'products'), limit(200)), (snapshot) => {
      const newData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
      const newDataString = JSON.stringify(newData);
      
      if (newDataString !== productsStringRef.current) {
        productsStringRef.current = newDataString;
        setProducts(newData);
        console.log("✅ Productos actualizados (Cambio real detectado)");
      }
    }, (e) => handlePublicError(e, OperationType.GET, 'products'));
    
    const unsubCampaigns = onSnapshot(collection(db, 'campaigns'), (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Campaign)));
    }, (e) => handlePublicError(e, OperationType.GET, 'campaigns'));
    
    const unsubOffers = onSnapshot(collection(db, 'offers'), (snapshot) => {
      setOffers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Offer)));
    }, (e) => handlePublicError(e, OperationType.GET, 'offers'));

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course)));
    }, (e) => handlePublicError(e, OperationType.GET, 'courses'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as StoreSettings;
        setStoreSettings(data);
      }
      setIsSettingsLoaded(true);
    }, (e) => {
      handlePublicError(e, OperationType.GET, 'settings');
      setIsSettingsLoaded(true);
    });

    return () => {
      unsubRawMaterials();
      unsubProducts();
      unsubCampaigns();
      unsubOffers();
      unsubCourses();
      unsubSettings();
    };
  }, [isAuthReady]);

  // Admin Listeners & Static Data Fetching
  useEffect(() => {
    if (!isAuthReady || !isAdmin) {
      hasFetchedNonCritical.current = false;
      return;
    }

    const handleAdminError = (e: unknown, op: OperationType, path: string) => {
      console.warn(`[Admin collection error] ${path}:`, e);
      // Don't set global error for quota issues to avoid infinite re-render loops
      if (e instanceof Error && e.message.includes('quota')) {
        return;
      }
      try {
        handleFirestoreError(e, op, path);
      } catch (err) {
        // Only set error if it's not already the same to avoid loops
        setError(prev => (prev?.message === (err as Error).message) ? prev : (err as Error));
      }
    };

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
    const todayStr = now.toISOString().split('T')[0];

    // 1. REAL-TIME LISTENERS (onSnapshot) - Critical Data
    const unsubCoupons = onSnapshot(collection(db, 'coupons'), (snapshot) => {
      setCoupons(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Coupon)));
    }, (e) => handleAdminError(e, OperationType.GET, 'coupons'));

    const salesCache = { recent: [] as Sale[], active: [] as Sale[] };
    const updateSales = () => {
      const merged = new Map<string, Sale>();
      salesCache.recent.forEach(s => merged.set(s.id, s));
      salesCache.active.forEach(s => merged.set(s.id, s));
      setSales(Array.from(merged.values()).sort((a, b) => b.date.localeCompare(a.date)));
    };

    const unsubSalesActive = onSnapshot(query(collection(db, 'sales'), where('status', 'in', ['nuevo', 'en_preparacion', 'listo_para_entregar'])), (snapshot) => {
      salesCache.active = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
      updateSales();
    }, (e) => handleAdminError(e, OperationType.GET, 'sales_active'));
    
    const quotesCache = { recent: [] as Quote[], active: [] as Quote[] };
    const updateQuotes = () => {
      const merged = new Map<string, Quote>();
      quotesCache.recent.forEach(q => merged.set(q.id, q));
      quotesCache.active.forEach(q => merged.set(q.id, q));
      setQuotes(Array.from(merged.values()).sort((a, b) => b.date.localeCompare(a.date)));
    };

    const unsubQuotesActive = onSnapshot(query(collection(db, 'quotes'), where('validUntil', '>=', todayStr)), (snapshot) => {
      quotesCache.active = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote));
      updateQuotes();
    }, (e) => handleAdminError(e, OperationType.GET, 'quotes_active'));

    const ordersCache = { recent: [] as ProductionOrder[], active: [] as ProductionOrder[] };
    const updateOrders = () => {
      const merged = new Map<string, ProductionOrder>();
      ordersCache.recent.forEach(o => merged.set(o.id, o));
      ordersCache.active.forEach(o => merged.set(o.id, o));
      setProductionOrders(Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };

    const unsubOrdersActive = onSnapshot(query(collection(db, 'productionOrders'), where('status', '==', 'pending')), (snapshot) => {
      ordersCache.active = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductionOrder));
      updateOrders();
    }, (e) => handleAdminError(e, OperationType.GET, 'orders_active'));

    // 2. STATIC DATA FETCHING (getDocs) - Non-Critical Data
    const fetchNonCriticalData = async () => {
      if (hasFetchedNonCritical.current) return;
      hasFetchedNonCritical.current = true;
      
      console.log("Fetching non-critical static data...");
      try {
        // Audit Logs
        const auditLogsSnap = await getDocs(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50)));
        setAuditLogs(auditLogsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog)));

        // Customers
        const customersSnap = await getDocs(query(collection(db, 'customers'), limit(50)));
        setCustomers(customersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer)));

        // Recent Sales
        const salesRecentSnap = await getDocs(query(collection(db, 'sales'), where('date', '>=', thirtyDaysAgoStr), orderBy('date', 'desc'), limit(50)));
        salesCache.recent = salesRecentSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
        updateSales();

        // Recent Quotes
        const quotesRecentSnap = await getDocs(query(collection(db, 'quotes'), where('date', '>=', thirtyDaysAgoStr), orderBy('date', 'desc'), limit(50)));
        quotesCache.recent = quotesRecentSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote));
        updateQuotes();

        // Recent Production Orders
        const ordersRecentSnap = await getDocs(query(collection(db, 'productionOrders'), where('createdAt', '>=', thirtyDaysAgoISO), orderBy('createdAt', 'desc'), limit(50)));
        ordersCache.recent = ordersRecentSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductionOrder));
        updateOrders();

        // Users
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(50)));
        setUsers(
