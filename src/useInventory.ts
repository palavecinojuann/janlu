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

    const unsubRawMaterials = onSnapshot(query(collection(db, 'rawMaterials'), limit(100)), (snapshot) => {
      const newData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RawMaterial));
      const newDataString = JSON.stringify(newData);
      
      if (newDataString !== rawMaterialsStringRef.current) {
        rawMaterialsStringRef.current = newDataString;
        setRawMaterials(newData);
        console.log("✅ Insumos actualizados (Cambio real detectado)");
      }
    }, (e) => handlePublicError(e, OperationType.GET, 'rawMaterials'));

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
      if (e instanceof Error && e.message.includes('quota')) {
        return;
      }
      try {
        handleFirestoreError(e, op, path);
      } catch (err) {
        setError(prev => (prev?.message === (err as Error).message) ? prev : (err as Error));
      }
    };

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
    const todayStr = now.toISOString().split('T')[0];

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

    const fetchNonCriticalData = async () => {
      if (hasFetchedNonCritical.current) return;
      hasFetchedNonCritical.current = true;
      
      console.log("Fetching non-critical static data...");
      try {
        const auditLogsSnap = await getDocs(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50)));
        setAuditLogs(auditLogsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog)));

        const customersSnap = await getDocs(query(collection(db, 'customers'), limit(50)));
        setCustomers(customersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer)));

        const salesRecentSnap = await getDocs(query(collection(db, 'sales'), where('date', '>=', thirtyDaysAgoStr), orderBy('date', 'desc'), limit(50)));
        salesCache.recent = salesRecentSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
        updateSales();

        const quotesRecentSnap = await getDocs(query(collection(db, 'quotes'), where('date', '>=', thirtyDaysAgoStr), orderBy('date', 'desc'), limit(50)));
        quotesCache.recent = quotesRecentSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote));
        updateQuotes();

        const ordersRecentSnap = await getDocs(query(collection(db, 'productionOrders'), where('createdAt', '>=', thirtyDaysAgoISO), orderBy('createdAt', 'desc'), limit(50)));
        ordersCache.recent = ordersRecentSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductionOrder));
        updateOrders();

        const usersSnap = await getDocs(query(collection(db, 'users'), limit(50)));
        setUsers(usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as User)));

        const preAuthSnap = await getDocs(collection(db, 'preAuthorizedAdmins'));
        const preAuths = preAuthSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as PreAuthorizedAdmin));
        setPreAuthorizedAdmins(preAuths);

        if (currentUser) {
          const preAuth = preAuths.find(admin => admin.email === currentUser.email);
          if (preAuth) {
            const role = preAuth.role || 'admin';
            if (role === 'admin' || role === 'collaborator') {
              setIsAdmin(prev => prev !== true ? true : prev);
            }
          }
        }

        const financialDocsSnap = await getDocs(query(collection(db, 'financialDocs'), limit(50)));
        setFinancialDocs(financialDocsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FinancialDocument)));

        const activitiesSnap = await getDocs(query(collection(db, 'activities'), limit(50)));
        setActivities(activitiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Activity)));

        const simulationsSnap = await getDocs(query(collection(db, 'simulations'), limit(20)));
        setSimulations(simulationsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Simulation)));

      } catch (e) {
        console.warn("Error fetching non-critical data (likely quota):", e);
      }
    };

    fetchNonCriticalData();

    return () => {
      unsubCoupons();
      unsubSalesActive();
      unsubQuotesActive();
      unsubOrdersActive();
    };
  }, [isAuthReady, isAdmin, refreshTrigger]);

  const logAction = async (action: string, collectionName: string, documentId: string, newData?: unknown, previousData?: unknown) => {
    if (!currentUser) return;
    const logId = uuidv4();
    const log = {
      id: logId,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      action,
      collection: collectionName,
      documentId,
      timestamp: new Date().toISOString(),
      newData: newData ? JSON.parse(JSON.stringify(newData)) : null,
      previousData: previousData ? JSON.parse(JSON.stringify(previousData)) : null,
    };
    try {
      await setDoc(doc(db, 'auditLogs', logId), log);
    } catch (e) {
      console.error("Error logging action:", e);
    }
  };

  const addProduct = async (product: Product) => {
    try {
      const rounded = {
        ...product,
        variants: product.variants.map(v => ({
          ...v,
          cost: roundFinancial(v.cost),
          price: roundFinancial(v.price),
          wholesalePrice: v.wholesalePrice ? roundFinancial(v.wholesalePrice) : undefined
        }))
      };
      const cleaned = cleanObject(rounded);
      await setDoc(doc(db, 'products', product.id), cleaned);
      await logAction('create', 'products', product.id, cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };
  const addMultipleProducts = async (newProducts: Product[]) => {
    if (!isAdmin) {
      console.warn('User is not admin, cannot import products');
      return;
    }
    console.log(`Starting bulk import of ${newProducts.length} products`);
    try {
      const BATCH_SIZE = 500;
      for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
        const chunk = newProducts.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(product => {
          const rounded = {
            ...product,
            variants: product.variants.map(v => ({
              ...v,
              cost: roundFinancial(v.cost),
              price: roundFinancial(v.price),
              wholesalePrice: v.wholesalePrice ? roundFinancial(v.wholesalePrice) : undefined
            }))
          };
          batch.set(doc(db, 'products', product.id), cleanObject(rounded));
        });
        
        console.log(`Committing batch of ${chunk.length} products...`);
        await batch.commit();
        console.log(`Batch committed successfully`);
      }

      for (const p of newProducts) {
        await logAction('create_batch', 'products', p.id, p);
      }
      console.log('Bulk import completed successfully');
    } catch (error) {
      console.error('Error in addMultipleProducts:', error);
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };
  const updateProduct = async (updatedProduct: Product) => {
    try {
      const rounded = {
        ...updatedProduct,
        variants: updatedProduct.variants.map(v => ({
          ...v,
          cost: roundFinancial(v.cost),
          price: roundFinancial(v.price),
          wholesalePrice: v.wholesalePrice ? roundFinancial(v.wholesalePrice) : undefined
        }))
      };
      const prev = products.find(p => p.id === updatedProduct.id);
      const cleaned = cleanObject(rounded);
      await setDoc(doc(db, 'products', updatedProduct.id), cleaned);
      await logAction('update', 'products', updatedProduct.id, cleaned, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };
  const updateMultipleProducts = async (updatedProducts: Product[]) => {
    try {
      const batch = writeBatch(db);
      updatedProducts.forEach(product => {
        batch.set(doc(db, 'products', product.id), cleanObject(product));
      });
      await batch.commit();
      for (const p of updatedProducts) {
        const prev = products.find(old => old.id === p.id);
        await logAction('update_batch', 'products', p.id, p, prev);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };
  const deleteProduct = async (id: string) => {
    console.log('Intentando eliminar producto con ID:', id);
    try {
      const prev = products.find(p => p.id === id);
      console.log('Producto encontrado para eliminar:', prev);
      
      const linkedRawMaterial = rawMaterials.find(rm => rm.linkedProductId === id);
      if (linkedRawMaterial) {
        await setDoc(doc(db, 'rawMaterials', linkedRawMaterial.id), cleanObject({
          ...linkedRawMaterial,
          sellAsProduct: false,
          linkedProductId: null
        }));
      }

      await deleteDoc(doc(db, 'products', id));
      console.log('Producto eliminado exitosamente de Firestore');
      await logAction('delete', 'products', id, null, prev);
    } catch (error) {
      console.error('Error al eliminar producto en Firestore:', error);
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const addCourse = async (course: Course) => {
    try {
      const cleaned = cleanObject(course);
      await setDoc(doc(db, 'courses', course.id), cleaned);
      await logAction('create', 'courses', course.id, cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'courses');
    }
  };

  const updateCourse = async (course: Course) => {
    try {
      const cleaned = cleanObject(course);
      await updateDoc(doc(db, 'courses', course.id), cleaned);
      await logAction('update', 'courses', course.id, cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'courses');
    }
  };

  const deleteCourse = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'courses', id));
      await logAction('delete', 'courses', id);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'courses');
    }
  };

  const adjustStock = async (productId: string, variantId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const updatedProduct = {
      ...product,
      variants: product.variants.map(v => {
        if (v.id === variantId) {
          return { ...v, stock: v.isFinishedGood !== false ? Math.max(0, v.stock + quantity) : v.stock };
        }
        return v;
      })
    };
    try {
      await setDoc(doc(db, 'products', productId), cleanObject(updatedProduct));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const addCustomer = async (customer: Customer) => {
    console.log("Attempting to add customer:", customer);
    try {
      const normalizeEmail = (e?: string) => e?.trim().toLowerCase() || '';
      const normalizePhone = (p?: string) => p?.replace(/\D/g, '') || '';
      
      const nEmail = normalizeEmail(customer.email);
      const nPhone = normalizePhone(customer.phone);

      const isDuplicate = customers.some(c => 
        (nEmail && normalizeEmail(c.email) === nEmail) || 
        (nPhone && normalizePhone(c.phone) === nPhone)
      );

      if (isDuplicate) {
        throw new Error('Ya existe un cliente con este email o teléfono.');
      }

      let finalCustomer = { 
        ...customer,
        welcomeDiscountUsed: customer.welcomeDiscountUsed ?? false,
        discountPercentage: customer.discountPercentage ?? 10,
        assignedOffers: customer.assignedOffers ?? [],
        registeredAt: customer.registeredAt || new Date().toISOString(),
        createdAt: customer.createdAt || new Date().toISOString()
      };

      if (!finalCustomer.customerNumber) {
        console.log("Generating customer number for:", finalCustomer.id);
        finalCustomer.customerNumber = await generateNextCustomerNumber();
      }

      if (!finalCustomer.discountExpiresAt) {
        const regDate = new Date(finalCustomer.registeredAt);
        const expDate = new Date(regDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        finalCustomer.discountExpiresAt = expDate.toISOString();
      }

      console.log("Final customer object to save:", finalCustomer);
      const cleaned = cleanObject(finalCustomer);
      
      await setDoc(doc(db, 'customers', finalCustomer.id), cleaned);
      await logAction('create', 'customers', finalCustomer.id, cleaned);
      console.log("Customer added successfully:", finalCustomer.id);
    } catch (error) {
      console.error("Error in addCustomer:", error);
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };
  const updateCustomer = async (updated: Customer) => {
    try {
      const normalizeEmail = (e?: string) => e?.trim().toLowerCase() || '';
      const normalizePhone = (p?: string) => p?.replace(/\D/g, '') || '';
      
      const nEmail = normalizeEmail(updated.email);
      const nPhone = normalizePhone(updated.phone);

      const isDuplicate = customers.some(c => 
        c.id !== updated.id && (
          (nEmail && normalizeEmail(c.email) === nEmail) || 
          (nPhone && normalizePhone(c.phone) === nPhone)
        )
      );

      if (isDuplicate) {
        throw new Error('El email o teléfono ingresado ya pertenece a otro cliente registrado.');
      }

      console.log("Updating customer:", updated.id);
      const prev = customers.find(c => c.id === updated.id);
      const cleaned = cleanObject(updated);
      await setDoc(doc(db, 'customers', updated.id), cleaned);
      await logAction('update', 'customers', updated.id, cleaned, prev);
      console.log("Customer updated successfully:", updated.id);
    } catch (error) {
      console.error("Error in updateCustomer:", error);
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };
  const deleteCustomer = async (id: string) => {
    try {
      const prev = customers.find(c => c.id === id);
      await deleteDoc(doc(db, 'customers', id));
      await logAction('delete', 'customers', id, null, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'customers');
    }
  };

  const addRawMaterial = async (material: RawMaterial) => {
    try {
      let linkedProductId = material.linkedProductId;
      if (material.sellAsProduct) {
        linkedProductId = uuidv4();
        const product: Product = {
          id: linkedProductId,
          name: material.name,
          description: material.description || '',
          category: material.category || 'Insumos',
          photoUrl: material.photoUrl || '',
          showInCatalog: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          variants: [{
            id: uuidv4(),
            name: material.unit,
            price: material.price || 0,
            cost: material.costPerUnit || 0,
            margin: 0,
            sku: '',
            stock: 0,
            isFinishedGood: false,
            recipe: [{
              id: uuidv4(),
              rawMaterialId: material.id,
              quantity: toUMB(1, material.unit as Unit),
              unit: material.baseUnit || UMB_FOR_DIMENSION[material.dimension || (material.unit ? UNIT_DIMENSIONS[material.unit as Unit] : 'units')]
            }]
          }]
        };
        await setDoc(doc(db, 'products', product.id), cleanObject(product));
      }

      const rounded = {
        ...material,
        linkedProductId,
        costPerUnit: roundPrecise(material.costPerUnit)
      };
      const cleaned = cleanObject(rounded);
      await setDoc(doc(db, 'rawMaterials', material.id), cleaned);
      await logAction('create', 'rawMaterials', material.id, cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };
  const addMultipleRawMaterials = async (materials: RawMaterial[]) => {
    try {
      const batch = writeBatch(db);
      materials.forEach(material => {
        const rounded = {
          ...material,
          costPerUnit: roundPrecise(material.costPerUnit)
        };
        batch.set(doc(db, 'rawMaterials', material.id), cleanObject(rounded));
      });
      await batch.commit();
      for (const m of materials) {
        await logAction('create_batch', 'rawMaterials', m.id, m);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };
  const updateRawMaterial = async (updated: RawMaterial) => {
    try {
      let linkedProductId = updated.linkedProductId;
      
      if (updated.sellAsProduct) {
        if (!linkedProductId) {
          linkedProductId = uuidv4();
        }
        const existingProduct = products.find(p => p.id === linkedProductId);
        const variantId = existingProduct?.variants[0]?.id || uuidv4();

        const product: Product = {
          id: linkedProductId,
          name: updated.name,
          description: updated.description || '',
          category: updated.category || 'Insumos',
          photoUrl: updated.photoUrl || '',
          showInCatalog: true,
          createdAt: existingProduct?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          variants: [{
            id: variantId,
            name: updated.unit,
            price: updated.price || 0,
            cost: updated.costPerUnit || 0,
            margin: 0,
            sku: '',
            stock: 0,
            isFinishedGood: false,
            recipe: [{
              id: uuidv4(),
              rawMaterialId: updated.id,
              quantity: toUMB(1, updated.unit as Unit),
              unit: updated.baseUnit || UMB_FOR_DIMENSION[updated.dimension || (updated.unit ? UNIT_DIMENSIONS[updated.unit as Unit] : 'units')]
            }]
          }]
        };
        await setDoc(doc(db, 'products', product.id), cleanObject(product));
      } else if (linkedProductId) {
        await deleteDoc(doc(db, 'products', linkedProductId));
        linkedProductId = undefined;
      }

      const rounded = {
        ...updated,
        linkedProductId,
        costPerUnit: roundPrecise(updated.costPerUnit)
      };
      const prev = rawMaterials.find(m => m.id === updated.id);
      const cleaned = cleanObject(rounded);
      await setDoc(doc(db, 'rawMaterials', updated.id), cleaned);
      await logAction('update', 'rawMaterials', updated.id, cleaned, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };
  const updateMultipleRawMaterials = async (updatedMaterials: RawMaterial[]) => {
    try {
      const batch = writeBatch(db);
      updatedMaterials.forEach(material => {
        batch.set(doc(db, 'rawMaterials', material.id), cleanObject(material));
        if (material.sellAsProduct && material.linkedProductId) {
          const existingProduct = products.find(p => p.id === material.linkedProductId);
          if (existingProduct) {
            const product: Product = {
              ...existingProduct,
              name: material.name,
              description: material.description || '',
              category: material.category || 'Insumos',
              photoUrl: material.photoUrl || '',
              variants: [{
                ...existingProduct.variants[0],
                name: material.unit,
                price: material.price || 0,
                recipe: [{
                  rawMaterialId: material.id,
                  quantity: toUMB(1, material.unit as Unit),
                  unit: material.baseUnit || UMB_FOR_DIMENSION[material.dimension || (material.unit ? UNIT_DIMENSIONS[material.unit as Unit] : 'units')]
                }]
              }]
            };
            batch.set(doc(db, 'products', product.id), cleanObject(product));
          }
        }
      });
      await batch.commit();
      for (const m of updatedMaterials) {
        const prev = rawMaterials.find(old => old.id === m.id);
        await logAction('update_batch', 'rawMaterials', m.id, m, prev);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };
  const deleteRawMaterial = async (id: string) => {
    try {
      const prev = rawMaterials.find(m => m.id === id);
      if (prev?.linkedProductId) {
        await deleteDoc(doc(db, 'products', prev.linkedProductId));
      }
      await deleteDoc(doc(db, 'rawMaterials', id));
      await logAction('delete', 'rawMaterials', id, null, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'rawMaterials');
    }
  };

  const restockRawMaterial = async (id: string, quantity: number, newCost?: number) => {
    const material = rawMaterials.find(m => m.id === id);
    if (!material) return;
    const updatedMaterial = {
      ...material,
      stock: material.stock + quantity,
      costPerUnit: newCost || material.costPerUnit,
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'rawMaterials', id), cleanObject(updatedMaterial));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const addFinancialDoc = async (docData: FinancialDocument) => {
    try {
      await setDoc(doc(db, 'financialDocs', docData.id), cleanObject(docData));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financialDocs');
    }
  };
  const deleteFinancialDoc = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'financialDocs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'financialDocs');
    }
  };

  const addActivity = async (activity: Omit<Activity, 'id' | 'createdAt'>) => {
    try {
      const id = uuidv4();
      const newActivity: Activity = {
        ...activity,
        id,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'activities', id), cleanObject(newActivity));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'activities');
    }
  };

  const updateActivity = async (activity: Activity) => {
    try {
      await setDoc(doc(db, 'activities', activity.id), cleanObject(activity));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `activities/${activity.id}`);
    }
  };

  const deleteActivity = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'activities', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `activities/${id}`);
    }
  };

  const addProductionOrder = async (order: Omit<ProductionOrder, 'id' | 'createdAt' | 'status'>) => {
    try {
      const id = uuidv4();
      const newOrder: ProductionOrder = {
        ...order,
        id,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'productionOrders', id), cleanObject(newOrder));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'productionOrders');
    }
  };

  const updateProductionOrder = async (order: ProductionOrder) => {
    const oldOrder = productionOrders.find(o => o.id === order.id);
    if (!oldOrder) return;

    try {
      if (oldOrder.status === 'completed' && order.status === 'completed') {
        // Revert old order stock
        const oldProduct = products.find(p => p.id === oldOrder.productId);
        const oldVariant = oldProduct?.variants.find(v => v.id === oldOrder.variantId);
        
        let currentMaterials = [...rawMaterials];
        
        if (oldProduct && oldVariant) {
          // Revert product stock (decrease)
          const updatedOldProduct = {
            ...oldProduct,
            variants: oldProduct.variants.map(v => {
              if (v.id === oldVariant.id) {
                return { ...v, stock: v.isFinishedGood !== false ? Math.max(0, v.stock - oldOrder.quantity) : v.stock };
              }
              return v;
            })
          };

          // Revert raw materials (increase)
          if (oldVariant.recipe) {
            oldVariant.recipe.forEach(recipeItem => {
              currentMaterials = currentMaterials.map(m => {
                if (m.id === recipeItem.rawMaterialId) {
                  const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                  const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                  return { ...m, stock: m.stock + (quantityUMB * oldOrder.quantity) };
                }
                return m;
              });
            });
          }

          // Apply new order stock
          const newProduct = products.find(p => p.id === order.productId);
          const newVariant = newProduct?.variants.find(v => v.id === order.variantId);
          
          if (newProduct && newVariant) {
            // Apply product stock (increase)
            const productToUpdate = (oldProduct.id === newProduct.id) ? updatedOldProduct : newProduct;
            
            const finalNewProduct = {
              ...productToUpdate,
              variants: productToUpdate.variants.map(v => {
                if (v.id === newVariant.id) {
                  return { ...v, stock: v.isFinishedGood !== false ? v.stock + order.quantity : v.stock };
                }
                return v;
              })
            };
            
            if (oldProduct.id !== newProduct.id) {
               await setDoc(doc(db, 'products', updatedOldProduct.id), cleanObject(updatedOldProduct));
            }
            await setDoc(doc(db, 'products', finalNewProduct.id), cleanObject(finalNewProduct));

            // Apply raw materials (decrease)
            if (newVariant.recipe) {
              newVariant.recipe.forEach(recipeItem => {
                currentMaterials = currentMaterials.map(m => {
                  if (m.id === recipeItem.rawMaterialId) {
                    const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                    const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                    return { ...m, stock: Math.max(0, m.stock - (quantityUMB * order.quantity)) };
                  }
                  return m;
                });
              });
            }
          }
        }
        
        // Save materials
        for (const material of currentMaterials) {
          await setDoc(doc(db, 'rawMaterials', material.id), cleanObject(material));
        }
      } else if (oldOrder.status === 'completed' && (order.status === 'pending' || order.status === 'cancelled')) {
        // Revert old order stock, don't apply new stock
        const oldProduct = products.find(p => p.id === oldOrder.productId);
        const oldVariant = oldProduct?.variants.find(v => v.id === oldOrder.variantId);
        
        let currentMaterials = [...rawMaterials];
        
        if (oldProduct && oldVariant) {
          // Revert product stock (decrease)
          const updatedOldProduct = {
            ...oldProduct,
            variants: oldProduct.variants.map(v => {
              if (v.id === oldVariant.id) {
                return { ...v, stock: v.isFinishedGood !== false ? Math.max(0, v.stock - oldOrder.quantity) : v.stock };
              }
              return v;
            })
          };
          await setDoc(doc(db, 'products', updatedOldProduct.id), cleanObject(updatedOldProduct));

          // Revert raw materials (increase)
          if (oldVariant.recipe) {
            oldVariant.recipe.forEach(recipeItem => {
              currentMaterials = currentMaterials.map(m => {
                if (m.id === recipeItem.rawMaterialId) {
                  const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                  const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                  return { ...m, stock: m.stock + (quantityUMB * oldOrder.quantity) };
                }
                return m;
              });
            });
          }
        }
        for (const material of currentMaterials) {
          await setDoc(doc(db, 'rawMaterials', material.id), material);
        }
      } else if ((oldOrder.status === 'pending' || oldOrder.status === 'cancelled') && order.status === 'completed') {
        // Apply new order stock
        const newProduct = products.find(p => p.id === order.productId);
        const newVariant = newProduct?.variants.find(v => v.id === order.variantId);
        
        let currentMaterials = [...rawMaterials];
        
        if (newProduct && newVariant) {
          // Check for sufficient raw material stock first
          if (newVariant.recipe) {
            for (const recipeItem of newVariant.recipe) {
              const m = currentMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
              if (m) {
                const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                const totalNeeded = quantityUMB * order.quantity;
                if (m.stock < totalNeeded) {
                  throw new Error(`Stock insuficiente de ${m.name}. Se necesitan ${totalNeeded} ${m.baseUnit}, pero solo hay ${m.stock} ${m.baseUnit}.`);
                }
              }
            }
          }

          // Apply product stock (increase)
          const updatedNewProduct = {
            ...newProduct,
            variants: newProduct.variants.map(v => {
              if (v.id === newVariant.id) {
                return { ...v, stock: v.isFinishedGood !== false ? v.stock + order.quantity : v.stock };
              }
              return v;
            })
          };
          await setDoc(doc(db, 'products', updatedNewProduct.id), cleanObject(updatedNewProduct));

          // Apply raw materials (decrease)
          if (newVariant.recipe) {
            newVariant.recipe.forEach(recipeItem => {
              currentMaterials = currentMaterials.map(m => {
                if (m.id === recipeItem.rawMaterialId) {
                  const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                  const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                  return { ...m, stock: Math.max(0, m.stock - (quantityUMB * order.quantity)) };
                }
                return m;
              });
            });
          }
        }
        for (const material of currentMaterials) {
          await setDoc(doc(db, 'rawMaterials', material.id), material);
        }
      } else if (oldOrder.status === 'pending' && order.status === 'pending') {
        // Just update the order, no stock changes needed for pending orders
      }

      await setDoc(doc(db, 'productionOrders', order.id), cleanObject(order));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `productionOrders/${order.id}`);
    }
  };

  const deleteProductionOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'productionOrders', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `productionOrders/${id}`);
    }
  };

  const fabricarProducto = async (productId: string, variantId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    if (!product || !variant) return;

    try {
      // 1. Check for sufficient raw material stock first
      if (variant.recipe) {
        for (const recipeItem of variant.recipe) {
          const m = rawMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
          if (m) {
            const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
            const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
            const totalNeeded = quantityUMB * quantity;
            if (m.stock < totalNeeded) {
              throw new Error(`Stock insuficiente de ${m.name}. Se necesitan ${totalNeeded} ${m.baseUnit}, pero solo hay ${m.stock} ${m.baseUnit}.`);
            }
          }
        }
      }

      // 2. Deduct Raw Materials
      if (variant.recipe) {
        let newMaterials = [...rawMaterials];
        variant.recipe.forEach(recipeItem => {
          newMaterials = newMaterials.map(m => {
            if (m.id === recipeItem.rawMaterialId) {
              const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
              const quantityToDeductUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
              return { ...m, stock: Math.max(0, m.stock - (quantityToDeductUMB * quantity)) };
            }
            return m;
          });
        });
        for (const material of newMaterials) {
          await setDoc(doc(db, 'rawMaterials', material.id), cleanObject(material));
        }
      }

      // 3. Increase Product Stock
      const updatedProduct = {
        ...product,
        variants: product.variants.map(v => {
          if (v.id === variant.id) {
            return { ...v, stock: v.isFinishedGood !== false ? v.stock + quantity : v.stock };
          }
          return v;
        })
      };
      await setDoc(doc(db, 'products', product.id), cleanObject(updatedProduct));

      // 4. Log Activity
      await addActivity({
        title: 'Producción Completada',
        description: `Se fabricaron ${quantity} unidades de ${product.name} - ${variant.name}`,
        type: 'inventory',
        status: 'completed',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      });

    } catch (error) {
      console.error("Error al fabricar producto:", error);
      throw error;
    }
  };

  const completeProductionOrder = async (id: string) => {
    const order = productionOrders.find(o => o.id === id);
    if (!order || order.status !== 'pending') return;

    const product = products.find(p => p.id === order.productId);
    const variant = product?.variants.find(v => v.id === order.variantId);
    if (!product || !variant) return;

    try {
      // 1. Check for sufficient raw material stock first
      if (variant.recipe) {
        for (const recipeItem of variant.recipe) {
          const m = rawMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
          if (m) {
            const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
            const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
            const totalNeeded = quantityUMB * order.quantity;
            if (m.stock < totalNeeded) {
              throw new Error(`Stock insuficiente de ${m.name}. Se necesitan ${totalNeeded} ${m.baseUnit}, pero solo hay ${m.stock} ${m.baseUnit}.`);
            }
          }
        }
      }

      // 2. Deduct Raw Materials
      if (variant.recipe) {
        let newMaterials = [...rawMaterials];
        variant.recipe.forEach(recipeItem => {
          newMaterials = newMaterials.map(m => {
            if (m.id === recipeItem.rawMaterialId) {
              const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
              const quantityToDeductUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
              return { ...m, stock: Math.max(0, m.stock - (quantityToDeductUMB * order.quantity)) };
            }
            return m;
          });
        });
        for (const material of newMaterials) {
          await setDoc(doc(db, 'rawMaterials', material.id), cleanObject(material));
        }
      }

      // 3. Increase Product Stock
      const updatedProduct = {
        ...product,
        variants: product.variants.map(v => {
          if (v.id === variant.id) {
            return { ...v, stock: v.isFinishedGood !== false ? v.stock + order.quantity : v.stock };
          }
          return v;
        })
      };
      await setDoc(doc(db, 'products', updatedProduct.id), cleanObject(updatedProduct));

      // 4. Update Order Status
      await setDoc(doc(db, 'productionOrders', id), cleanObject({ ...order, status: 'completed' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `productionOrders/${id}/complete`);
    }
  };

  const saveSimulation = async (simulation: Simulation) => {
    try {
      await setDoc(doc(db, 'simulations', simulation.id), cleanObject(simulation));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'simulations');
    }
  };

  const deleteSimulation = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'simulations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'simulations');
    }
  };

  const addPreAuth = async (email: string, role: string = 'admin') => {
    try {
      await setDoc(doc(db, 'preAuthorizedAdmins', email), { 
        email,
        role,
        addedAt: new Date().toISOString(),
        addedBy: currentUser?.email || 'unknown'
      });
      
      // Also update existing user if they have already logged in
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        await setDoc(doc(db, 'users', existingUser.uid), { role }, { merge: true });
        await logAction('update_role', 'users', existingUser.uid, { role }, existingUser);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'preAuthorizedAdmins');
    }
  };

  const updatePreAuthRole = async (email: string, role: string) => {
    try {
      await updateDoc(doc(db, 'preAuthorizedAdmins', email), { role });
      
      // Also update existing user if they have already logged in
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        await setDoc(doc(db, 'users', existingUser.uid), { role }, { merge: true });
        await logAction('update_role', 'users', existingUser.uid, { role }, existingUser);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'preAuthorizedAdmins');
    }
  };

  const removePreAuth = async (email: string) => {
    try {
      await deleteDoc(doc(db, 'preAuthorizedAdmins', email));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'preAuthorizedAdmins');
    }
  };

  const generateCoupon = async (customerId?: string, percentage: number = 20, customCode?: string) => {
    const suffix = uuidv4().substring(0, 6).toUpperCase();
    const code = customCode ? `${customCode}-${suffix}` : `VUELVE-${percentage}-${suffix}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    const newCoupon: Coupon = {
      id: uuidv4(),
      code,
      discountPercentage: percentage,
      expiresAt: expiresAt.toISOString(),
      customerId,
      isUsed: false,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'coupons', newCoupon.id), cleanObject(newCoupon));
      return newCoupon;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'coupons');
      return null;
    }
  };

  const validateCoupon = async (code: string, customerEmail?: string): Promise<{ valid: boolean; discount?: number; error?: string }> => {
    console.log("Validating coupon:", code, "for customer:", customerEmail);
    
    // 1. Check local state (for admins who have the list)
    let coupon = coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase());
    
    // 2. If not found in local state, try to fetch directly from Firestore
    if (!coupon) {
      console.log("Coupon not found in local state, searching in Firestore...");
      try {
        const q = query(collection(db, 'coupons'), where('code', '==', code.trim().toUpperCase()), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          coupon = { ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id } as Coupon;
          console.log("Found coupon in Firestore:", coupon);
        } else {
          // Try case-insensitive (though they should be stored uppercase)
          const q2 = query(collection(db, 'coupons'), where('code', '==', code.trim()), limit(1));
          const querySnapshot2 = await getDocs(q2);
          if (!querySnapshot2.empty) {
            coupon = { ...querySnapshot2.docs[0].data(), id: querySnapshot2.docs[0].id } as Coupon;
            console.log("Found coupon in Firestore (case-match):", coupon);
          }
        }
      } catch (error) {
        console.error("Error fetching coupon from Firestore:", error);
      }
    }

    if (coupon) {
      console.log("Found regular coupon:", coupon);
      if (coupon.isUsed) return { valid: false, error: 'Cupón ya utilizado' };
      if (new Date(coupon.expiresAt) < new Date()) return { valid: false, error: 'Cupón caducado' };
      
      if (coupon.customerId && customerEmail) {
        // If we are not admin, we might not have the full customers list
        // But we can check if the customerId matches the current user's UID if logged in
        if (currentUser && coupon.customerId !== currentUser.uid) {
           // If it's not the current user, it might still be valid if the email matches
           // But we'd need to fetch the customer doc to be sure
           try {
             const customerDoc = await getDoc(doc(db, 'customers', coupon.customerId));
             if (customerDoc.exists()) {
               const customerData = customerDoc.data() as Customer;
               if (customerData.email.toLowerCase() !== customerEmail.toLowerCase()) {
                 console.log("Coupon customer mismatch:", customerData.email, "vs", customerEmail);
                 return { valid: false, error: 'Cupón no pertenece a este cliente' };
               }
             }
           } catch (e) {
             console.error("Error verifying coupon customer:", e);
           }
        } else if (!currentUser) {
          // Guest user, we definitely need to fetch the customer doc to verify email
          try {
            const customerDoc = await getDoc(doc(db, 'customers', coupon.customerId));
            if (customerDoc.exists()) {
              const customerData = customerDoc.data() as Customer;
              if (customerData.email.toLowerCase() !== customerEmail.toLowerCase()) {
                console.log("Coupon customer mismatch (guest):", customerData.email, "vs", customerEmail);
                return { valid: false, error: 'Cupón no pertenece a este cliente' };
              }
            }
          } catch (e) {
            console.error("Error verifying coupon customer for guest:", e);
          }
        }
      }
      return { valid: true, discount: coupon.discountPercentage };
    }

    // Check if it's a customer number (Welcome Discount)
    if (customerEmail) {
      // Try to find customer in local state
      let customer = customers.find(c => c.email.toLowerCase() === customerEmail.toLowerCase());
      
      // If not in local state, try to fetch from Firestore
      if (!customer) {
        try {
          const q = query(collection(db, 'customers'), where('email', '==', customerEmail.toLowerCase()), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            customer = { ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id } as Customer;
          }
        } catch (e) {
          console.error("Error fetching customer for welcome discount:", e);
        }
      }

      console.log("Checking welcome discount for customer:", customer?.email, "code:", code, "customerNumber:", customer?.customerNumber);
      if (customer && customer.customerNumber === code.trim()) {
        if (customer.welcomeDiscountUsed) return { valid: false, error: 'Descuento de bienvenida ya utilizado' };
        if (customer.discountExpiresAt && new Date(customer.discountExpiresAt) < new Date()) {
          return { valid: false, error: 'Descuento de bienvenida caducado' };
        }
        return { valid: true, discount: customer.discountPercentage || 10 };
      }
    }

    console.log("Coupon not found or invalid");
    return { valid: false, error: 'Cupón no válido' };
  };

  const deductRawMaterials = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    let newMaterials = [...rawMaterials];
    let materialsToUpdate = new Set<string>();

    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (variant && variant.recipe && variant.isFinishedGood === false) {
        variant.recipe.forEach(recipeItem => {
          newMaterials = newMaterials.map(m => {
            if (m.id === recipeItem.rawMaterialId) {
              // Calculate effective unit and convert to UMB
              const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
              const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
              
              // We need to deduct: quantityUMB * item.quantity
              const totalToDeduct = quantityUMB * item.quantity;
              
              materialsToUpdate.add(m.id);
              return { ...m, stock: Math.max(0, m.stock - totalToDeduct) };
            }
            return m;
          });
        });
      }
    });

    try {
      materialsToUpdate.forEach(id => {
        const material = newMaterials.find(m => m.id === id);
        if (material) {
          batch.set(doc(db, 'rawMaterials', id), cleanObject(material));
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const returnRawMaterials = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    let newMaterials = [...rawMaterials];
    let materialsToUpdate = new Set<string>();

    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (variant && variant.recipe && variant.isFinishedGood === false) {
        variant.recipe.forEach(recipeItem => {
          newMaterials = newMaterials.map(m => {
            if (m.id === recipeItem.rawMaterialId) {
              const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
              const quantityToReturnUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
              materialsToUpdate.add(m.id);
              return { ...m, stock: m.stock + (quantityToReturnUMB * item.quantity) };
            }
            return m;
          });
        });
      }
    });

    try {
      materialsToUpdate.forEach(id => {
        const material = newMaterials.find(m => m.id === id);
        if (material) {
          batch.set(doc(db, 'rawMaterials', id), cleanObject(material));
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

// 🚀 LÓGICA DE REGISTRO DE VENTA (DESCUENTO INMEDIATO EN TODOS LOS ESTADOS EXCEPTO CANCELADO)
  const registerSale = async (saleData: Omit<Sale, 'id' | 'date'>) => {
    let nextOrderNumber = 1000;
    try {
      const counterRef = doc(db, 'metadata', 'counters');
      nextOrderNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let newOrderNumber = 1000;
        if (counterDoc.exists() && typeof counterDoc.data().lastOrderNumber === 'number') {
          newOrderNumber = counterDoc.data().lastOrderNumber + 1;
        } else {
          const localMax = sales.reduce((max, sale) => Math.max(max, sale.orderNumber || 0), 0);
          newOrderNumber = Math.max(1000, localMax + 1);
        }
        transaction.set(counterRef, { lastOrderNumber: newOrderNumber }, { merge: true });
        return newOrderNumber;
      });
    } catch (error) {
      console.warn("No se pudo obtener el correlativo, usando fallback local", error);
      const localMax = sales.reduce((max, sale) => Math.max(max, sale.orderNumber || 0), 0);
      nextOrderNumber = Math.max(1000, localMax + 1);
    }
    
    const normalizeEmail = (e?: string) => {
      if (e) return e.trim().toLowerCase();
      return '';
    };

    const normalizePhone = (p?: string) => {
      if (p) return p.replace(/\D/g, '');
      return '';
    };
    
    let customerId = saleData.customerId === 'guest' ? '' : saleData.customerId;
    let customerToUpdate: Customer | null = null;
    let newCustomer: Customer | null = null;
    let existingCustomer: Customer | undefined = undefined;

    const inputEmail = saleData.registrationData?.email || saleData.customerEmail;
    const inputPhone = saleData.registrationData?.phone || saleData.customerPhone;
    const nEmail = normalizeEmail(inputEmail);
    const nPhone = normalizePhone(inputPhone);

    existingCustomer = customers.find(c => (nEmail && normalizeEmail(c.email) === nEmail) || (nPhone && normalizePhone(c.phone) === nPhone));

    if (!existingCustomer && (nEmail || nPhone)) {
      try {
        if (nEmail) {
          const snap = await getDocs(query(collection(db, 'customers'), where('email', '==', nEmail), limit(1)));
          if (!snap.empty) {
             existingCustomer = { ...snap.docs[0].data(), id: snap.docs[0].id } as Customer;
          }
        }
        if (!existingCustomer && nPhone) {
          const snap = await getDocs(query(collection(db, 'customers'), where('phone', '==', nPhone), limit(1)));
          if (!snap.empty) {
             existingCustomer = { ...snap.docs[0].data(), id: snap.docs[0].id } as Customer;
          }
        }
      } catch (e) {
        console.warn("Error buscando cliente en DB:", e);
      }
    }

    if (saleData.isRegistering && saleData.registrationData) {
      const { firstName, lastName, phone, email, birthDate } = saleData.registrationData;
      const fullName = `${firstName} ${lastName}`.trim();
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
        customerToUpdate = {
          ...existingCustomer,
          name: fullName,
          phone: normalizePhone(phone) || existingCustomer.phone || '',
          birthDate: birthDate || existingCustomer.birthDate || '',
          lastPurchaseDate: new Date().toISOString()
        };
      } else {
        newCustomer = { id: uuidv4(), name: fullName, email: nEmail, phone: nPhone, birthDate: birthDate || '', createdAt: new Date().toISOString(), lastPurchaseDate: new Date().toISOString() };
        customerId = newCustomer.id;
      }
    } else if (!customerId && (nEmail || nPhone)) {
      if (existingCustomer) {
        customerId = existingCustomer.id;
        customerToUpdate = { ...existingCustomer, phone: existingCustomer.phone || nPhone, lastPurchaseDate: new Date().toISOString() };
      } else {
        newCustomer = { id: uuidv4(), name: (saleData.customerName || '').trim(), email: nEmail, phone: nPhone, address: (saleData.shippingAddress || '').trim(), createdAt: new Date().toISOString(), lastPurchaseDate: new Date().toISOString() };
        customerId = newCustomer.id;
      }
    } else if (customerId) {
      const existing = existingCustomer || customers.find(c => c.id === customerId);
      if (existing) {
        customerToUpdate = { ...existing, phone: existing.phone || nPhone, lastPurchaseDate: new Date().toISOString() };
      }
    }

    // 🚨 REGLA DE ORO: Se descuenta el stock SIEMPRE QUE NO SEA CANCELADO
    const shouldBeDeducted = saleData.status !== 'cancelado';

    const newSale: Sale = {
      ...saleData,
      id: uuidv4(),
      customerId: customerId || '',
      customerPhone: saleData.customerPhone || newCustomer?.phone || customerToUpdate?.phone || '',
      orderNumber: nextOrderNumber,
      date: new Date().toISOString(),
      totalAmount: roundFinancial(saleData.totalAmount),
      amountPaid: roundFinancial(saleData.amountPaid),
      discount: roundFinancial(saleData.discount || 0),
      items: saleData.items.map(item => ({ ...item, price: roundFinancial(item.price), total: roundFinancial(item.total || (item.price * item.quantity)) })),
      materialsDeducted: shouldBeDeducted, // <-- Guardamos la bandera con el estado correcto
      paymentHistory: saleData.amountPaid > 0 ? [{ date: new Date().toISOString(), amount: roundFinancial(saleData.amountPaid), method: saleData.paymentMethod, status: saleData.paymentStatus || 'verified', notes: saleData.paymentNotes }] : []
    };

    let couponToGenerate: Coupon | null = null;
    if (saleData.isRegistering) {
      const alreadyExisted = !!existingCustomer;
      if (!alreadyExisted) {
        const suffix = uuidv4().substring(0, 6).toUpperCase();
        couponToGenerate = { id: uuidv4(), code: `BIE15-${suffix}`, discountPercentage: 15, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), customerId: customerId || '', isUsed: false, createdAt: new Date().toISOString() };
        newSale.generatedCouponCode = couponToGenerate.code;
      }
    }

    let couponFromQuery: Coupon | null = null;
    if (newSale.appliedCouponCode) {
      const normalizedCode = newSale.appliedCouponCode.trim().toUpperCase();
      const couponInState = coupons.find(c => c.code.toUpperCase() === normalizedCode);
      if (couponInState) {
         couponFromQuery = couponInState;
      } else {
        const q = query(collection(db, 'coupons'), where('code', '==', normalizedCode), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
           const docData = querySnapshot.docs[0].data();
           couponFromQuery = { ...docData, id: querySnapshot.docs[0].id } as Coupon;
        }
      }
    }

    try {
      await runTransaction(db, async (transaction) => {
        let couponDocSnap: DocumentSnapshot | null = null;
        let couponRef: DocumentReference | null = null;
        if (couponFromQuery) {
          couponRef = doc(db, 'coupons', couponFromQuery.id);
          couponDocSnap = await transaction.get(couponRef);
          if (!couponDocSnap.exists()) throw new Error("Cupón no existe en DB");
          if (couponDocSnap.data().isUsed) throw new Error("El cupón ya ha sido utilizado.");
        }

        const materialsToDeduct = new Map<string, number>();
        const materialDocs = new Map<string, DocumentSnapshot>();
        const productDocs = new Map<string, DocumentSnapshot>();
        
        // LEEMOS LOS PRODUCTOS DE FIRESTORE
        if (shouldBeDeducted) {
          for (const item of newSale.items) {
            if (!productDocs.has(item.productId)) {
              const productRef = doc(db, 'products', item.productId);
              const docSnap = await transaction.get(productRef);
              if (!docSnap.exists()) throw new Error(`Producto no encontrado: ${item.productId}`);
              productDocs.set(item.productId, docSnap);
            }
          }

          // 🚨 AHORA SÍ: Usamos shouldBeDeducted para preparar la resta de insumos
          newSale.items.forEach(item => {
            const productDoc = productDocs.get(item.productId);
            const product = productDoc?.data() as Product;
            const variant = product?.variants.find(v => v.id === item.variantId);
            if (variant && variant.recipe && variant.isFinishedGood === false) {
              variant.recipe.forEach(recipeItem => {
                const currentDeduction = materialsToDeduct.get(recipeItem.rawMaterialId) || 0;
                materialsToDeduct.set(recipeItem.rawMaterialId, currentDeduction + (recipeItem.quantity * item.quantity));
              });
            }
          });

          for (const materialId of materialsToDeduct.keys()) {
            const materialRef = doc(db, 'rawMaterials', materialId);
            const docSnap = await transaction.get(materialRef);
            if (!docSnap.exists()) throw new Error(`Materia prima no encontrada: ${materialId}`);
            materialDocs.set(materialId, docSnap);
          }
        }

        const courseDocs = new Map<string, DocumentSnapshot>();
        for (const item of newSale.items) {
          if (item.isCourse && item.courseId) {
            const courseRef = doc(db, 'courses', item.courseId);
            const docSnap = await transaction.get(courseRef);
            if (docSnap.exists()) courseDocs.set(item.courseId, docSnap);
          }
        }

        // ESCRITURAS DE CUPONES Y USUARIOS
        if (couponDocSnap && couponRef) {
          transaction.update(couponRef, { isUsed: true, usedBySaleId: newSale.id, usedAt: new Date().toISOString() });
        } else if (newSale.appliedCouponCode) {
          if (newCustomer && newCustomer.customerNumber === newSale.appliedCouponCode) newCustomer.welcomeDiscountUsed = true;
          else if (customerToUpdate && customerToUpdate.customerNumber === newSale.appliedCouponCode) customerToUpdate.welcomeDiscountUsed = true;
          else if (newSale.customerId) {
            const customer = existingCustomer || customers.find(c => c.id === newSale.customerId);
            if (customer && customer.customerNumber === newSale.appliedCouponCode) {
              if (customer.welcomeDiscountUsed) throw new Error("El descuento de bienvenida ya ha sido utilizado.");
              transaction.update(doc(db, 'customers', customer.id), { welcomeDiscountUsed: true });
            }
          }
        }

        if (newCustomer) transaction.set(doc(db, 'customers', newCustomer.id), cleanObject(newCustomer));
        else if (customerToUpdate) transaction.update(doc(db, 'customers', customerToUpdate.id), cleanObject(customerToUpdate));
        if (couponToGenerate) transaction.set(doc(db, 'coupons', couponToGenerate.id), cleanObject(couponToGenerate));

        // ESCRITURAS DE STOCK REAL
        if (shouldBeDeducted) {
          // Descuenta materias primas
          for (const [materialId, totalToDeduct] of materialsToDeduct.entries()) {
            const materialDoc = materialDocs.get(materialId)!;
            const materialData = materialDoc.data() as RawMaterial;
            const effectiveUnit = materialData.baseUnit || UMB_FOR_DIMENSION[materialData.dimension || (materialData.unit ? UNIT_DIMENSIONS[materialData.unit as Unit] : 'units')];
            const quantityUMB = toUMB(totalToDeduct, effectiveUnit as Unit);
            if (materialData.stock < quantityUMB) throw new Error(`Stock insuficiente para materia prima: ${materialData.name}`);
            transaction.update(doc(db, 'rawMaterials', materialId), { stock: materialData.stock - quantityUMB });
          }

          // Descuenta productos terminados
          const productsToUpdate = new Map<string, Product>();
          for (const item of newSale.items) {
            const productDoc = productDocs.get(item.productId)!;
            let productData = productsToUpdate.get(item.productId) || (productDoc.data() as Product);
            const variant = productData.variants.find(v => v.id === item.variantId);
            
            if (variant && variant.isFinishedGood !== false) {
              const updatedVariants = productData.variants.map(v => {
                if (v.id === item.variantId) return { ...v, stock: Math.max(0, v.stock - item.quantity) };
                return v;
              });
              productData = { ...productData, variants: updatedVariants };
              productsToUpdate.set(item.productId, productData);
            }
          }
          for (const [productId, productData] of productsToUpdate.entries()) {
            transaction.update(doc(db, 'products', productId), { variants: productData.variants });
          }

          // Descuenta cupos de cursos
          for (const item of newSale.items) {
            if (item.isCourse && item.courseId) {
              const courseDoc = courseDocs.get(item.courseId);
              if (courseDoc && courseDoc.exists()) {
                const currentEnrolled = courseDoc.data().enrolledCount || 0;
                const maxQuota = courseDoc.data().maxQuota || 0;
                if (currentEnrolled + item.quantity > maxQuota) throw new Error(`Cupo insuficiente para el curso: ${item.productName}`);
                transaction.update(doc(db, 'courses', item.courseId), { enrolledCount: currentEnrolled + item.quantity });
              }
            }
          }
        }

        transaction.set(doc(db, 'sales', newSale.id), cleanObject(newSale));
      });

      return { 
        id: newSale.id, 
        generatedCoupon: couponToGenerate ? { code: couponToGenerate.code, expiry: new Date(couponToGenerate.expiresAt).toLocaleDateString('es-AR') } : null 
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
      return undefined;
    }
  };

  // 🚀 LÓGICA DE UPDATE SALE (SOLO RECALCULA STOCK SI HAY CAMBIO ENTRE CANCELADO/ACTIVO)
  const updateSale = async (updatedSale: Sale) => {
    const roundedSale = {
      ...updatedSale,
      totalAmount: roundFinancial(updatedSale.totalAmount),
      amountPaid: roundFinancial(updatedSale.amountPaid),
      discount: roundFinancial(updatedSale.discount || 0),
      items: updatedSale.items.map(item => ({ ...item, price: roundFinancial(item.price), total: roundFinancial(item.total) })),
      paymentHistory: updatedSale.paymentHistory?.map(p => ({ ...p, amount: roundFinancial(p.amount) }))
    };
    const s = sales.find(sale => sale.id === roundedSale.id);
    if (!s) return;

    const wasDeducted = s.materialsDeducted === true;
    const shouldBeDeducted = roundedSale.status !== 'cancelado'; 
    const needsStockUpdate = wasDeducted !== shouldBeDeducted; 

    try {
      if (needsStockUpdate) {
        await runTransaction(db, async (transaction) => {
          const productDocs = new Map<string, DocumentSnapshot>();
          for (const item of roundedSale.items) {
            if (!productDocs.has(item.productId)) {
              const productRef = doc(db, 'products', item.productId);
              const docSnap = await transaction.get(productRef);
              if (!docSnap.exists()) throw new Error(`Producto no encontrado: ${item.productId}`);
              productDocs.set(item.productId, docSnap);
            }
          }

          const materialDocs = new Map<string, DocumentSnapshot>();
          const materialsToModify = new Map<string, number>();

          roundedSale.items.forEach(item => {
            const productDoc = productDocs.get(item.productId);
            const product = productDoc?.data() as Product;
            const variant = product?.variants.find(v => v.id === item.variantId);
            if (variant && variant.recipe && variant.isFinishedGood === false) {
              variant.recipe.forEach(recipeItem => {
                const currentAmount = materialsToModify.get(recipeItem.rawMaterialId) || 0;
                materialsToModify.set(recipeItem.rawMaterialId, currentAmount + (recipeItem.quantity * item.quantity));
              });
            }
          });

          for (const materialId of materialsToModify.keys()) {
            const materialRef = doc(db, 'rawMaterials', materialId);
            const docSnap = await transaction.get(materialRef);
            if (!docSnap.exists()) throw new Error(`Materia prima no encontrada: ${materialId}`);
            materialDocs.set(materialId, docSnap);
          }

          const courseDocs = new Map<string, DocumentSnapshot>();
          for (const item of roundedSale.items) {
            if (item.isCourse && item.courseId) {
              const courseRef = doc(db, 'courses', item.courseId);
              const docSnap = await transaction.get(courseRef);
              if (docSnap.exists()) courseDocs.set(item.courseId, docSnap);
            }
          }

          // ESCRITURAS (Añadir o Restar dependiendo de shouldBeDeducted)
          const productsToUpdate = new Map<string, Product>();
          for (const item of roundedSale.items) {
            const productDoc = productDocs.get(item.productId)!;
            let productData = productsToUpdate.get(item.productId) || (productDoc.data() as Product);
            const variant = productData.variants.find(v => v.id === item.variantId);
            
            if (variant && variant.isFinishedGood !== false) {
              const updatedVariants = productData.variants.map(v => {
                if (v.id === item.variantId) {
                  const newStock = shouldBeDeducted ? Math.max(0, v.stock - item.quantity) : v.stock + item.quantity;
                  return { ...v, stock: newStock };
                }
                return v;
              });
              productData = { ...productData, variants: updatedVariants };
              productsToUpdate.set(item.productId, productData);
            }
          }

          for (const [productId, productData] of productsToUpdate.entries()) {
            transaction.update(doc(db, 'products', productId), { variants: productData.variants });
          }

          for (const [materialId, amount] of materialsToModify.entries()) {
            const materialDoc = materialDocs.get(materialId)!;
            const materialData = materialDoc.data() as RawMaterial;
            const effectiveUnit = materialData.baseUnit || UMB_FOR_DIMENSION[materialData.dimension || (materialData.unit ? UNIT_DIMENSIONS[materialData.unit as Unit] : 'units')];
            const quantityUMB = toUMB(amount, effectiveUnit as Unit);
            
            const newStock = shouldBeDeducted ? Math.max(0, materialData.stock - quantityUMB) : materialData.stock + quantityUMB;
            transaction.update(doc(db, 'rawMaterials', materialId), { stock: newStock });
          }

          for (const item of roundedSale.items) {
            if (item.isCourse && item.courseId) {
              const courseDoc = courseDocs.get(item.courseId);
              if (courseDoc && courseDoc.exists()) {
                const currentEnrolled = courseDoc.data().enrolledCount || 0;
                const newEnrolled = shouldBeDeducted ? currentEnrolled + item.quantity : Math.max(0, currentEnrolled - item.quantity);
                transaction.update(doc(db, 'courses', item.courseId), { enrolledCount: newEnrolled });
              }
            }
          }

          roundedSale.materialsDeducted = shouldBeDeducted;
          transaction.set(doc(db, 'sales', roundedSale.id), cleanObject(roundedSale));
        });
      } else {
        await setDoc(doc(db, 'sales', roundedSale.id), cleanObject(roundedSale));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
    }
  };

  const addQuote = async (quoteData: Omit<Quote, 'id' | 'date'>) => {
    const maxQuoteNumber = quotes.reduce((max, quote) => Math.max(max, quote.quoteNumber || 0), 0);
    const newQuote: Quote = {
      ...quoteData,
      id: uuidv4(),
      quoteNumber: maxQuoteNumber + 1,
      date: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'quotes', newQuote.id), cleanObject(newQuote));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'quotes');
    }
  };

  const deleteQuote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'quotes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'quotes');
    }
  };

  const approveQuote = async (quote: Quote) => {
    if (!isAdmin) return;
    
    try {
      const saleData: Omit<Sale, 'id' | 'date'> = {
        customerId: quote.customerId,
        customerName: quote.customerName,
        items: quote.items.map(item => ({
          id: uuidv4(),
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          price: item.unitPrice || (item.quantity > 0 ? item.finalPrice / item.quantity : 0),
          total: roundFinancial(item.finalPrice)
        })),
        totalAmount: quote.totalAmount,
        amountPaid: 0,
        paymentPercentage: 0,
        paymentMethod: 'efectivo',
        status: 'nuevo',
        paymentStatus: 'pending',
        balanceDue: quote.totalAmount,
        discount: quote.subtotal - quote.totalAmount > 0 ? roundFinancial(quote.subtotal - quote.totalAmount) : 0
      };

      const saleId = await registerSale(saleData);
      await deleteQuote(quote.id);
      await logAction('approve_quote', 'quotes', quote.id, { saleId: saleId || 'new' }, quote);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
    }
  };

  // Logic for Levels
  const calculateLevel = (monthlySalesCount: number) => {
    if (monthlySalesCount >= 50) return 'platino';
    if (monthlySalesCount >= 30) return 'oro';
    if (monthlySalesCount >= 10) return 'plata';
    return 'bronce';
  };

  const getLevelDiscount = (level: string) => {
    switch (level) {
      case 'platino': return 25;
      case 'oro': return 15;
      case 'plata': return 10;
      default: return 5;
    }
  };

  // Logic for Starter Kit
  const purchaseStarterKit = async () => {
    const kitItems = [
      { rawMaterialId: 'cera-id', quantity: 5 },
      { rawMaterialId: 'pabilo-id', quantity: 50 },
      { rawMaterialId: 'esencia-id', quantity: 10 },
    ];

    const updatedMaterials = rawMaterials.map(m => {
      const kitItem = kitItems.find(ki => ki.rawMaterialId === m.id);
      if (kitItem) {
        return { ...m, stock: Math.max(0, m.stock - kitItem.quantity) };
      }
      return m;
    });

    try {
      for (const material of updatedMaterials) {
        if (kitItems.some(ki => ki.rawMaterialId === material.id)) {
          await setDoc(doc(db, 'rawMaterials', material.id), material);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }

    setUserProfile((prev: UserProfile | null) => prev ? { ...prev, starterKitPurchased: true } : null);
  };

  const addCampaign = async (campaign: Campaign) => {
    try {
      await setDoc(doc(db, 'campaigns', campaign.id), campaign);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'campaigns');
    }
  };
  const deleteCampaign = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'campaigns', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'campaigns');
    }
  };

  const addOffer = async (offer: Offer) => {
    try {
      await setDoc(doc(db, 'offers', offer.id), offer);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'offers');
    }
  };
  const updateOffer = async (updated: Offer) => {
    try {
      await setDoc(doc(db, 'offers', updated.id), updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'offers');
    }
  };
  const deleteOffer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'offers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'offers');
    }
  };

  const addSubscriber = async (email: string) => {
    try {
      const subscriberId = uuidv4();
      await setDoc(doc(db, 'subscribers', subscriberId), {
        id: subscriberId,
        email,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'subscribers');
    }
  };

  const updateCoupon = async (updated: Coupon) => {
    try {
      await setDoc(doc(db, 'coupons', updated.id), cleanObject(updated));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'coupons');
    }
  };

  const deleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'coupons');
    }
  };

  const metrics = useMemo(() => {
    // 1. Pre-calculate variant data for fast lookup and stock totals
    const variantDataMap = new Map<string, { cost: number; price: number; stock: number }>();
    let totalStock = 0;
    let totalValueCost = 0;
    let totalValuePrice = 0;
    let lowStockItems = 0;

    products.forEach(p => {
      p.variants.forEach(v => {
        const stock = getVariantStock(v, rawMaterials);
        variantDataMap.set(v.id, { cost: v.cost, price: v.price, stock });
        
        totalStock += stock;
        totalValueCost += v.cost * stock;
        totalValuePrice += v.price * stock;
        if (stock > 0 && stock <= 5) lowStockItems++;
      });
    });

    // 2. Filter and process sales in a single pass
    const validSales = sales.filter(s => s.status !== 'cancelado');
    
    let grossProfit = 0;
    let netProfit = 0;
    let totalRevenue = 0;
    let totalPendingPayment = 0;
    const revenueByMethod = { efectivo: 0, transferencia: 0, tarjeta: 0, mixto: 0 };

    validSales.forEach(sale => {
      let saleCost = 0;
      sale.items.forEach(item => {
        const data = variantDataMap.get(item.variantId);
        if (data) {
          saleCost += data.cost * item.quantity;
        }
      });

      const additionalCosts = 
        (sale.packagingCost || 0) + 
        (sale.shippingCost || 0) + 
        (sale.laborCost || 0) + 
        (sale.paymentGatewayFee || 0);

      const saleGrossProfit = sale.totalAmount - saleCost;
      grossProfit += saleGrossProfit;
      netProfit += (saleGrossProfit - additionalCosts);
      totalRevenue += sale.amountPaid;
      totalPendingPayment += (sale.totalAmount - sale.amountPaid);

      // Map payment methods to metrics categories
      const method = sale.paymentMethod === 'efectivo' || !sale.paymentMethod ? 'efectivo' : 
                     sale.paymentMethod === 'transferencia' ? 'transferencia' :
                     sale.paymentMethod === 'tarjeta' ? 'tarjeta' :
                     sale.paymentMethod === 'mixto' ? 'mixto' : 'efectivo';
      
      if (method in revenueByMethod) {
        revenueByMethod[method as keyof typeof revenueByMethod] += sale.amountPaid;
      }
    });

    // 3. Projected revenue from valid quotes
    const now = new Date();
    const projectedRevenue = quotes
      .filter(q => new Date(q.validUntil) >= now)
      .reduce((acc, q) => acc + q.totalAmount, 0);

    return {
      totalProducts: products.length,
      totalStock,
      totalValueCost,
      totalValuePrice,
      stockProfit: totalValuePrice - totalValueCost,
      lowStockItems,
      totalSales: validSales.length,
      totalRevenue,
      totalPendingPayment,
      projectedRevenue,
      grossProfit,
      netProfit,
      revenueByMethod
    };
  }, [products, rawMaterials, sales, quotes]);

  const updateUserRole = async (uid: string, newRole: string) => {
    try {
      const prev = users.find(u => u.uid === uid);
      await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true });
      await logAction('update_role', 'users', uid, { role: newRole }, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const clearAuditLogs = async () => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      auditLogs.forEach(log => {
        batch.delete(doc(db, 'auditLogs', log.id));
      });
      await batch.commit();
      await logAction('clear_logs', 'auditLogs', 'all');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'auditLogs');
    }
  };

  const updateStoreSettings = async (newSettings: StoreSettings) => {
    if (!isAdmin) return;
    console.log("Updating store settings in Firestore:", newSettings);
    try {
      const cleaned = cleanObject(newSettings);
      console.log("Cleaned settings for Firestore:", cleaned);
      await setDoc(doc(db, 'settings', 'global'), cleaned);
      await logAction('update', 'settings', 'global', newSettings, storeSettings);
    } catch (error) {
      console.error("Error updating store settings:", error);
      handleFirestoreError(error, OperationType.WRITE, 'settings');
    }
  };

  return {
    products, addProduct, addMultipleProducts, updateProduct, deleteProduct, adjustStock,
    courses, addCourse, updateCourse, deleteCourse,
    customers, addCustomer, updateCustomer, deleteCustomer,
    sales, registerSale, updateSale,
    coupons, generateCoupon, validateCoupon, updateCoupon, deleteCoupon,
    quotes, addQuote, deleteQuote, approveQuote,
    rawMaterials, addRawMaterial, addMultipleRawMaterials, updateRawMaterial, deleteRawMaterial, restockRawMaterial,
    financialDocs, addFinancialDoc, deleteFinancialDoc,
    activities, addActivity, updateActivity, deleteActivity,
    campaigns, addCampaign, deleteCampaign,
    offers, addOffer, updateOffer, deleteOffer,
    addSubscriber,
    userProfile, setUserProfile,
    purchaseStarterKit, getLevelDiscount, calculateLevel,
    metrics,
    currentUser,
    isAdmin,
    users,
    updateUserRole,
    isSettingsLoaded,
    isAuthReady,
    lastSync,
    refresh,
    productionOrders,
    addProductionOrder,
    updateProductionOrder,
    deleteProductionOrder,
    completeProductionOrder,
    fabricarProducto,
    simulations,
    saveSimulation,
    deleteSimulation,
    updateMultipleProducts,
    updateMultipleRawMaterials,
    preAuthorizedAdmins,
    addPreAuth,
    updatePreAuthRole,
    removePreAuth,
    auditLogs,
    clearAuditLogs,
    storeSettings,
    updateStoreSettings
  };
}
