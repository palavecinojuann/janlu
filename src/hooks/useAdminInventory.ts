import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where, getDocs, startAfter, DocumentSnapshot, limit, getAggregateFromServer, sum, count } from 'firebase/firestore';
import { Sale, Customer, RawMaterial, Quote, Activity, FinancialDocument, ProductionOrder, Simulation, PreAuthorizedAdmin, AuditLog, User, Coupon, Product } from '../types';

export interface ServerMetrics {
  totalSalesCount: number;
  totalRevenueSum: number;
  lastUpdated: Date | null;
}
import { getVariantStock } from '../utils/stockUtils';
import { handleFirestoreError, OperationType, trackClientReadRate } from '../utils/firebaseHelpers';

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

export function useAdminInventory(isAdmin: boolean, isAuthReady: boolean, products: Product[]) {
  const [serverMetrics, setServerMetrics] = useState<ServerMetrics>({
    totalSalesCount: 0,
    totalRevenueSum: 0,
    lastUpdated: null
  });
  const [isLoadingServerMetrics, setIsLoadingServerMetrics] = useState<boolean>(false);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const rawMaterialsStringRef = useRef<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [realtimeSales, setRealtimeSales] = useState<Sale[]>([]);
  const [historicalSales, setHistoricalSales] = useState<Sale[]>([]);
  const [hasMoreSales, setHasMoreSales] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [preAuthorizedAdmins, setPreAuthorizedAdmins] = useState<PreAuthorizedAdmin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [financialDocs, setFinancialDocs] = useState<FinancialDocument[]>([]);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [salesLimit, setSalesLimit] = useState(50);
  const [lastVisibleLog, setLastVisibleLog] = useState<any>(null);
  const [hasMoreLogs, setHasMoreLogs] = useState<boolean>(true);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const hasFetchedUsers = useRef(false);
  const hasFetchedFinance = useRef(false);
  const hasFetchedSimulations = useRef(false);
  const hasFetchedRecentOrders = useRef(false);
  const hasFetchedCoupons = useRef(false);
  const hasFetchedAllSales = useRef(false);
  
  const adminListenersMounted = useRef(false);
  const unsubCustomersRef = useRef<(() => void) | null>(null);
  const unsubQuotesRef = useRef<(() => void) | null>(null);
  const unsubActivitiesRef = useRef<(() => void) | null>(null);
  const unsubOrdersActiveRef = useRef<(() => void) | null>(null);
  const unsubSalesRef = useRef<(() => void) | null>(null);
  const unsubRawMaterialsRef = useRef<(() => void) | null>(null);

  // NOTA: Cachés en memoria para la optimización de la ráfaga inicial de Firestore
  const latestPendingSales = useRef<Map<string, Sale>>(new Map());
  const latestRecentSales = useRef<Map<string, Sale>>(new Map());
  const searchedSalesRef = useRef<Map<string, Sale>>(new Map());

  const updateRealtimeSales = useCallback(() => {
    const mergedMap = new Map<string, Sale>();
    latestPendingSales.current.forEach((sale, id) => {
      mergedMap.set(id, sale);
    });
    latestRecentSales.current.forEach((sale, id) => {
      mergedMap.set(id, sale);
    });
    searchedSalesRef.current.forEach((sale, id) => {
      mergedMap.set(id, sale);
    });
    setRealtimeSales(Array.from(mergedMap.values()));
  }, []);

  const cleanupAllListeners = () => {
    if (unsubCustomersRef.current) { unsubCustomersRef.current(); unsubCustomersRef.current = null; }
    if (unsubQuotesRef.current) { unsubQuotesRef.current(); unsubQuotesRef.current = null; }
    if (unsubActivitiesRef.current) { unsubActivitiesRef.current(); unsubActivitiesRef.current = null; }
    if (unsubOrdersActiveRef.current) { unsubOrdersActiveRef.current(); unsubOrdersActiveRef.current = null; }
    if (unsubSalesRef.current) { unsubSalesRef.current(); unsubSalesRef.current = null; }
    if (unsubRawMaterialsRef.current) { unsubRawMaterialsRef.current(); unsubRawMaterialsRef.current = null; }
    adminListenersMounted.current = false;
    hasFetchedCoupons.current = false;
    hasFetchedAllSales.current = false;
    
    // Limpieza de las cachés de ventas
    latestPendingSales.current.clear();
    latestRecentSales.current.clear();
    searchedSalesRef.current.clear();
  };

  const refresh = useCallback(() => {
    hasFetchedUsers.current = false;
    hasFetchedFinance.current = false;
    hasFetchedSimulations.current = false;
    hasFetchedRecentOrders.current = false;
    hasFetchedCoupons.current = false;
    hasFetchedAllSales.current = false;
    setLastVisibleLog(null);
    setHasMoreLogs(true);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const sales = useMemo(() => {
    const combined = [...realtimeSales, ...historicalSales];
    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
    return unique.sort((a, b) => (b.orderNumber || 0) - (a.orderNumber || 0));
  }, [realtimeSales, historicalSales]);

  // Efecto 1: Listeners PERSISTENTES de admin (se suscriben una única vez por sesión)
  useEffect(() => {
    console.log("[DEBUG-FIRESTORE] useEffect useAdminInventory (persistent) triggered. isAuthReady:", isAuthReady, "isAdmin:", isAdmin, "refreshTrigger:", refreshTrigger);
    if (!isAuthReady || !isAdmin) {
      console.log("[DEBUG-FIRESTORE] Resetting admin state and cleaning up listeners (either not admin or auth not ready)...");
      // Reset data when not admin, preserving empty array references to prevent render loops
      setCustomers(prev => prev.length > 0 ? [] : prev);
      setRealtimeSales(prev => prev.length > 0 ? [] : prev);
      setHistoricalSales(prev => prev.length > 0 ? [] : prev);
      setQuotes(prev => prev.length > 0 ? [] : prev);
      setActivities(prev => prev.length > 0 ? [] : prev);
      setProductionOrders(prev => prev.length > 0 ? [] : prev);
      setAuditLogs(prev => prev.length > 0 ? [] : prev);
      setCoupons(prev => prev.length > 0 ? [] : prev);
      setFinancialDocs(prev => prev.length > 0 ? [] : prev);
      setRawMaterials(prev => prev.length > 0 ? [] : prev);
      rawMaterialsStringRef.current = '';
      setLastVisibleLog(prev => prev !== null ? null : prev);
      setHasMoreLogs(prev => !prev ? true : prev);
      cleanupAllListeners();
      hasFetchedUsers.current = false;
      hasFetchedFinance.current = false;
      hasFetchedSimulations.current = false;
      hasFetchedRecentOrders.current = false;
      hasFetchedCoupons.current = false;
      hasFetchedAllSales.current = false;
      return;
    }

    // Admin Listeners (se suscriben una única vez por sesión)
    if (!adminListenersMounted.current) {
      console.log("[DEBUG-FIRESTORE] Registering persistent admin listeners...");
      adminListenersMounted.current = true;

      console.log("[DEBUG-FIRESTORE] Subscribing to 'customers' collection (limit 20)...");
      unsubCustomersRef.current = onSnapshot(query(collection(db, 'customers'), limit(20)), (snapshot) => {
        console.log(`[DEBUG-FIRESTORE] 'customers' snapshot callback fired. Size: ${snapshot.docs.length} docs`);
        trackClientReadRate(snapshot.docs.length || 1);
        setCustomers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer)));
      }, (e) => handleFirestoreError(e, OperationType.GET, 'customers'));

      console.log("[DEBUG-FIRESTORE] Subscribing to 'quotes' collection (limit 20)...");
      unsubQuotesRef.current = onSnapshot(query(collection(db, 'quotes'), orderBy('date', 'desc'), limit(20)), (snapshot) => {
        console.log(`[DEBUG-FIRESTORE] 'quotes' snapshot callback fired. Size: ${snapshot.docs.length} docs`);
        trackClientReadRate(snapshot.docs.length || 1);
        setQuotes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote)));
      }, (e) => handleFirestoreError(e, OperationType.GET, 'quotes'));

      console.log("[DEBUG-FIRESTORE] Subscribing to 'activities' collection (limit 20)...");
      unsubActivitiesRef.current = onSnapshot(query(collection(db, 'activities'), orderBy('createdAt', 'desc'), limit(20)), (snapshot) => {
        console.log(`[DEBUG-FIRESTORE] 'activities' snapshot callback fired. Size: ${snapshot.docs.length} docs`);
        trackClientReadRate(snapshot.docs.length || 1);
        setActivities(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Activity)));
      }, (e) => handleFirestoreError(e, OperationType.GET, 'activities'));

      console.log("[DEBUG-FIRESTORE] Subscribing to 'productionOrders' collection (status == pending)...");
      unsubOrdersActiveRef.current = onSnapshot(query(collection(db, 'productionOrders'), where('status', '==', 'pending')), (snapshot) => {
        console.log(`[DEBUG-FIRESTORE] active 'productionOrders' snapshot callback fired. Size: ${snapshot.docs.length} docs`);
        trackClientReadRate(snapshot.docs.length || 1);
        const activeOrders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductionOrder));
        setProductionOrders(prev => {
          const merged = new Map<string, ProductionOrder>();
          prev.forEach(o => merged.set(o.id, o));
          activeOrders.forEach(o => merged.set(o.id, o));
          return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      });

      console.log("[DEBUG-FIRESTORE] Subscribing to 'rawMaterials' collection (admin)...");
      unsubRawMaterialsRef.current = onSnapshot(query(collection(db, 'rawMaterials')), (snapshot) => {
        console.log(`[DEBUG-FIRESTORE] 'rawMaterials' (admin) snapshot callback fired. Size: ${snapshot.docs.length} docs`);
        trackClientReadRate(snapshot.docs.length || 1);
        const newData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RawMaterial));
        newData.sort((a, b) => a.id.localeCompare(b.id));
        const newDataString = stableStringify(newData);
        if (newDataString !== rawMaterialsStringRef.current) {
          rawMaterialsStringRef.current = newDataString;
          setRawMaterials(newData);
          console.log("✅ Insumos actualizados en Panel Admin (Cambio real detectado)");
        }
      }, (e) => handleFirestoreError(e, OperationType.GET, 'rawMaterials'));
    }
  }, [isAuthReady, isAdmin, refreshTrigger]);

  // Efecto 2: Listeners de VENTAS (se re-suscriben solo cuando cambia salesLimit)
  useEffect(() => {
    if (!isAuthReady || !isAdmin) return;

    console.log(`[DEBUG-FIRESTORE] Subscribing to 'sales' collection (pending and recent limit ${salesLimit})...`);
    if (unsubSalesRef.current) {
      console.log("[DEBUG-FIRESTORE] Unsubscribing previous 'sales' listeners...");
      unsubSalesRef.current();
    }

    const qPending = query(
      collection(db, 'sales'),
      where('status', 'not-in', ['entregado', 'cancelado']),
      limit(30)
    );

    const qRecent = query(
      collection(db, 'sales'),
      orderBy('date', 'desc'),
      limit(salesLimit)
    );

    const unsubPending = onSnapshot(qPending, (snapshot) => {
      console.log(`[DEBUG-FIRESTORE] 'sales' (pending) snapshot callback fired. Size: ${snapshot.docs.length} docs`);
      trackClientReadRate(snapshot.docs.length || 1);
      const pendingMap = new Map<string, Sale>();
      snapshot.docs.forEach(doc => {
        pendingMap.set(doc.id, { ...doc.data(), id: doc.id } as Sale);
      });
      latestPendingSales.current = pendingMap;
      updateRealtimeSales();
    }, (e) => handleFirestoreError(e, OperationType.GET, 'sales_pending'));

    const unsubRecent = onSnapshot(qRecent, (snapshot) => {
      console.log(`[DEBUG-FIRESTORE] 'sales' (recent) snapshot callback fired. Size: ${snapshot.docs.length} docs`);
      trackClientReadRate(snapshot.docs.length || 1);
      const recentMap = new Map<string, Sale>();
      snapshot.docs.forEach(doc => {
        recentMap.set(doc.id, { ...doc.data(), id: doc.id } as Sale);
      });
      latestRecentSales.current = recentMap;
      setHasMoreSales(snapshot.docs.length === salesLimit);
      updateRealtimeSales();
    }, (e) => handleFirestoreError(e, OperationType.GET, 'sales_recent'));

    unsubSalesRef.current = () => {
      unsubPending();
      unsubRecent();
    };

    return () => {
      if (unsubSalesRef.current) {
        unsubSalesRef.current();
        unsubSalesRef.current = null;
      }
    };
  }, [isAuthReady, isAdmin, salesLimit, updateRealtimeSales]);

  // Limpieza total de listeners al desmontar el hook de inventario
  useEffect(() => {
    return () => {
      console.log("[DEBUG-FIRESTORE] useAdminInventory hook unmounting. Cleaning up all admin listeners...");
      cleanupAllListeners();
    };
  }, []);

  const fetchInitialAuditLogs = useCallback(async () => {
    if (!isAdmin) return;
    // NOTA: Arquitectura bajo demanda y paginada para la colección auditLogs para optimizar cuotas de lectura.
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      console.log(`[DEBUG-FIRESTORE] getDocs 'auditLogs' (initial) returned ${snapshot.docs.length} docs`);
      trackClientReadRate(snapshot.docs.length || 1);
      const fetchedLogs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog));
      setAuditLogs(fetchedLogs);
      
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      setLastVisibleLog(lastDoc);
      setHasMoreLogs(snapshot.docs.length === 50);
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching initial audit logs:", e);
    } finally {
      setLoadingLogs(false);
    }
  }, [isAdmin]);

  const fetchMoreAuditLogs = useCallback(async () => {
    if (!isAdmin || !hasMoreLogs || !lastVisibleLog || loadingLogs) return;
    // NOTA: Arquitectura bajo demanda y paginada para la colección auditLogs para optimizar cuotas de lectura.
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        startAfter(lastVisibleLog),
        limit(50)
      );
      const snapshot = await getDocs(q);
      console.log(`[DEBUG-FIRESTORE] getDocs 'auditLogs' (more) returned ${snapshot.docs.length} docs`);
      trackClientReadRate(snapshot.docs.length || 1);
      const fetchedLogs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog));
      
      setAuditLogs(prev => [...prev, ...fetchedLogs]);
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      setLastVisibleLog(lastDoc);
      setHasMoreLogs(snapshot.docs.length === 50);
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching more audit logs:", e);
    } finally {
      setLoadingLogs(false);
    }
  }, [isAdmin, hasMoreLogs, lastVisibleLog, loadingLogs]);

  const loadCoupons = useCallback(async () => {
    console.log("[DEBUG-FIRESTORE] loadCoupons called. hasFetchedCoupons:", hasFetchedCoupons.current);
    if (!isAdmin || hasFetchedCoupons.current) return;
    hasFetchedCoupons.current = true;
    try {
      const couponsSnap = await getDocs(query(collection(db, 'coupons')));
      console.log(`[DEBUG-FIRESTORE] getDocs 'coupons' returned ${couponsSnap.docs.length} docs`);
      trackClientReadRate(couponsSnap.docs.length || 1);
      setCoupons(couponsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Coupon)));
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching coupons:", e);
      hasFetchedCoupons.current = false;
    }
  }, [isAdmin]);

  const loadAllSales = useCallback(async () => {
    console.log("[DEBUG-FIRESTORE] loadAllSales called. hasFetchedAllSales:", hasFetchedAllSales.current);
    if (!isAdmin || hasFetchedAllSales.current) return;
    hasFetchedAllSales.current = true;
    try {
      const salesSnap = await getDocs(query(collection(db, 'sales')));
      console.log(`[DEBUG-FIRESTORE] getDocs 'sales' (all) returned ${salesSnap.docs.length} docs`);
      const allSales = salesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
      setHistoricalSales(allSales);
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching all sales:", e);
      hasFetchedAllSales.current = false;
    }
  }, [isAdmin]);

  const loadUsersAndPreAuth = useCallback(async () => {
    console.log("[DEBUG-FIRESTORE] loadUsersAndPreAuth called. hasFetchedUsers:", hasFetchedUsers.current);
    if (!isAdmin || hasFetchedUsers.current) return;
    hasFetchedUsers.current = true;
    try {
      const usersSnap = await getDocs(query(collection(db, 'users')));
      console.log(`[DEBUG-FIRESTORE] getDocs 'users' returned ${usersSnap.docs.length} docs`);
      trackClientReadRate(usersSnap.docs.length || 1);
      setUsers(usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as User)));

      const preAuthSnap = await getDocs(collection(db, 'preAuthorizedAdmins'));
      console.log(`[DEBUG-FIRESTORE] getDocs 'preAuthorizedAdmins' returned ${preAuthSnap.docs.length} docs`);
      trackClientReadRate(preAuthSnap.docs.length || 1);
      setPreAuthorizedAdmins(preAuthSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as PreAuthorizedAdmin)));
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching users:", e);
      hasFetchedUsers.current = false;
    }
  }, [isAdmin]);

  const loadFinancialDocs = useCallback(async () => {
    console.log("[DEBUG-FIRESTORE] loadFinancialDocs called. hasFetchedFinance:", hasFetchedFinance.current);
    if (!isAdmin || hasFetchedFinance.current) return;
    hasFetchedFinance.current = true;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

      const financialDocsSnap = await getDocs(
        query(
          collection(db, 'financialDocs'),
          where('date', '>=', thirtyDaysAgoISO),
          orderBy('date', 'desc')
        )
      );
      console.log(`[DEBUG-FIRESTORE] getDocs 'financialDocs' returned ${financialDocsSnap.docs.length} docs`);
      trackClientReadRate(financialDocsSnap.docs.length || 1);
      setFinancialDocs(financialDocsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FinancialDocument)));
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching financial docs:", e);
      hasFetchedFinance.current = false;
    }
  }, [isAdmin]);

  const loadSimulations = useCallback(async () => {
    console.log("[DEBUG-FIRESTORE] loadSimulations called. hasFetchedSimulations:", hasFetchedSimulations.current);
    if (!isAdmin || hasFetchedSimulations.current) return;
    hasFetchedSimulations.current = true;
    try {
      const simulationsSnap = await getDocs(query(collection(db, 'simulations')));
      console.log(`[DEBUG-FIRESTORE] getDocs 'simulations' returned ${simulationsSnap.docs.length} docs`);
      trackClientReadRate(simulationsSnap.docs.length || 1);
      setSimulations(simulationsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Simulation)));
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching simulations:", e);
      hasFetchedSimulations.current = false;
    }
  }, [isAdmin]);

  const loadProductionOrders = useCallback(async () => {
    console.log("[DEBUG-FIRESTORE] loadProductionOrders called. hasFetchedRecentOrders:", hasFetchedRecentOrders.current);
    if (!isAdmin || hasFetchedRecentOrders.current) return;
    hasFetchedRecentOrders.current = true;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

      const ordersRecentSnap = await getDocs(query(collection(db, 'productionOrders'), where('createdAt', '>=', thirtyDaysAgoISO), orderBy('createdAt', 'desc')));
      console.log(`[DEBUG-FIRESTORE] getDocs 'productionOrders' (recent) returned ${ordersRecentSnap.docs.length} docs`);
      trackClientReadRate(ordersRecentSnap.docs.length || 1);
      const recentOrders = ordersRecentSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductionOrder));
      setProductionOrders(prev => {
        const merged = new Map<string, ProductionOrder>();
        prev.forEach(o => merged.set(o.id, o));
        recentOrders.forEach(o => merged.set(o.id, o));
        return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching recent production orders:", e);
      hasFetchedRecentOrders.current = false;
    }
  }, [isAdmin]);

  const fetchServerMetrics = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingServerMetrics(true);
    try {
      console.log("[METRICS] Calculando métricas agregadas desde el servidor...");
      const q = query(
        collection(db, 'sales'),
        where('status', '!=', 'cancelado')
      );
      const snapshot = await getAggregateFromServer(q, {
        totalCount: count(),
        totalRevenue: sum('totalAmount')
      });
      
      const data = snapshot.data();
      
      setServerMetrics({
        totalSalesCount: data.totalCount,
        totalRevenueSum: data.totalRevenue || 0,
        lastUpdated: new Date()
      });
      console.log("[METRICS] Agregación completada con éxito.");
    } catch (error) {
      console.error("[METRICS] Error al calcular agregaciones:", error);
    } finally {
      setIsLoadingServerMetrics(false);
    }
  }, [isAdmin]);

  const fetchMoreSales = useCallback(() => {
    setSalesLimit(prev => prev + 20);
  }, []);

  const searchHistoricalSale = useCallback(async (searchQuery: string) => {
    if (!isAdmin) return false;
    try {
      let q = query(collection(db, 'sales'));
      const orderNum = parseInt(searchQuery);

      // Si es un número exacto, buscamos el ID de pedido. Si es texto, buscamos por nombre de cliente.
      if (!isNaN(orderNum) && searchQuery.trim().match(/^\d+$/)) {
        q = query(collection(db, 'sales'), where('orderNumber', '==', orderNum));
      } else {
        q = query(collection(db, 'sales'), where('customerName', '>=', searchQuery), where('customerName', '<=', searchQuery + '\uf8ff'), limit(5));
      }

      const querySnapshot = await getDocs(q);
      const foundSales = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));

      if (foundSales.length > 0) {
        // NOTA: Optimización de ráfaga inicial para limitar lecturas de ventas históricas cerradas.
        // Registramos el pedido encontrado en la caché de búsquedas y actualizamos el estado unificado.
        foundSales.forEach(fs => {
          searchedSalesRef.current.set(fs.id, fs);
        });
        updateRealtimeSales();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error en búsqueda histórica:", error);
      return false;
    }
  }, [isAdmin, updateRealtimeSales]);

  const variantStocksAndMetrics = useMemo(() => {
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

    return { variantDataMap, totalStock, totalValueCost, totalValuePrice, lowStockItems };
  }, [products, rawMaterials]);

  const metrics = useMemo(() => {
    if (!isAdmin) return null;

    const { variantDataMap, totalStock, totalValueCost, totalValuePrice, lowStockItems } = variantStocksAndMetrics;

    const validSales = sales.filter(s => s.status !== 'cancelado');
    let grossProfit = 0;
    let netProfit = 0;
    let totalRevenue = 0;
    let todayRevenue = 0;
    let monthlyRevenue = 0;
    let totalPendingPayment = 0;
    const revenueByMethod = { efectivo: 0, transferencia: 0, tarjeta: 0, mixto: 0 };

    const getLocalDateParts = (dateStr: string) => {
      if (!dateStr) return { year: -1, month: -1, day: -1, yyyymmdd: '' };
      const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // 0-indexed
        const day = parseInt(match[3]);
        return { year, month, day, yyyymmdd: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
      }
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
          const parts = dateStr.split('T')[0].split('-');
          if (parts.length >= 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            return { year, month, day, yyyymmdd: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
          }
          return { year: -1, month: -1, day: -1, yyyymmdd: '' };
        }
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();
        return { year, month, day, yyyymmdd: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
      } catch {
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length >= 3) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const day = parseInt(parts[2]);
          return { year, month, day, yyyymmdd: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
        }
        return { year: -1, month: -1, day: -1, yyyymmdd: '' };
      }
    };

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    validSales.forEach(sale => {
      let saleCost = 0;
      sale.items.forEach(item => {
        const data = item.variantId ? variantDataMap.get(item.variantId) : null;
        if (data) saleCost += data.cost * item.quantity;
      });

      const additionalCosts = (sale.packagingCost || 0) + (sale.shippingCost || 0) + (sale.laborCost || 0) + (sale.paymentGatewayFee || 0);
      const saleGrossProfit = sale.totalAmount - saleCost;
      grossProfit += saleGrossProfit;
      netProfit += (saleGrossProfit - additionalCosts);
      
      let salePaidSum = 0;

      if (sale.paymentHistory && sale.paymentHistory.length > 0) {
        sale.paymentHistory.forEach(payment => {
          const amount = payment.amount || 0;
          salePaidSum += amount;
          totalRevenue += amount;

          if (payment.date) {
            const dateParts = getLocalDateParts(payment.date);
            if (dateParts.yyyymmdd === todayStr) {
              todayRevenue += amount;
            }
            if (dateParts.year === todayYear && dateParts.month === todayMonth) {
              monthlyRevenue += amount;
            }
          }

          const rawMethod = payment.method;
          const method = rawMethod === 'efectivo' || !rawMethod ? 'efectivo' :
            rawMethod === 'transferencia' ? 'transferencia' :
              rawMethod === 'tarjeta' ? 'tarjeta' :
                rawMethod === 'mixto' ? 'mixto' : 'efectivo';

          if (method in revenueByMethod) {
            revenueByMethod[method as keyof typeof revenueByMethod] += amount;
          }
        });
      } else {
        const amount = sale.amountPaid || 0;
        salePaidSum += amount;
        totalRevenue += amount;

        if (sale.date) {
          const dateParts = getLocalDateParts(sale.date);
          if (dateParts.yyyymmdd === todayStr) {
            todayRevenue += amount;
          }
          if (dateParts.year === todayYear && dateParts.month === todayMonth) {
            monthlyRevenue += amount;
          }
        }

        const rawMethod = sale.paymentMethod;
        const method = rawMethod === 'efectivo' || !rawMethod ? 'efectivo' :
          rawMethod === 'transferencia' ? 'transferencia' :
            rawMethod === 'tarjeta' ? 'tarjeta' :
              rawMethod === 'mixto' ? 'mixto' : 'efectivo';

        if (method in revenueByMethod) {
          revenueByMethod[method as keyof typeof revenueByMethod] += amount;
        }
      }

      totalPendingPayment += Math.max(0, sale.totalAmount - salePaidSum);
    });

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
      todayRevenue,
      monthlyRevenue,
      totalPendingPayment,
      projectedRevenue,
      grossProfit,
      netProfit,
      revenueByMethod
    };
  }, [products, variantStocksAndMetrics, sales, quotes, isAdmin]);

  const exportarCatalogoCSV = useCallback(() => {
    const headers = ['Producto', 'Descripción', 'Categoría', 'Variante/Tamaño', 'Precio Minorista', 'Precio Mayorista'];
    
    const escapeCSV = (val: string | number | undefined | null): string => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const rows = [headers.map(h => escapeCSV(h)).join(';')];

    products.forEach(product => {
      const description = product.description || '';
      const category = product.category || 'Sin Categoría';
      
      product.variants.forEach(variant => {
        const row = [
          escapeCSV(product.name),
          escapeCSV(description),
          escapeCSV(category),
          escapeCSV(variant.name),
          escapeCSV(variant.price),
          escapeCSV(variant.wholesalePrice || variant.price)
        ];
        rows.push(row.join(';'));
      });
    });

    const csvContent = rows.join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `Catalogo_Precios_JANLU_${dateStr}.csv`;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [products]);

  const exportarInsumosCSV = useCallback(() => {
    const headers = ['Insumo', 'Stock Actual', 'Unidad de Medida', 'Costo por Unidad', 'Stock Mínimo', 'Categoría'];
    
    const escapeCSV = (val: string | number | undefined | null): string => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const rows = [headers.map(h => escapeCSV(h)).join(';')];

    rawMaterials.forEach(material => {
      const row = [
        escapeCSV(material.name),
        escapeCSV(material.stock),
        escapeCSV(material.unit),
        escapeCSV(material.costPerUnit),
        escapeCSV(material.minStock || 0),
        escapeCSV(material.category || 'Sin Categoría')
      ];
      rows.push(row.join(';'));
    });

    const csvContent = rows.join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `Listado_Insumos_JANLU_${dateStr}.csv`;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [rawMaterials]);

  return {
    customers,
    rawMaterials,
    sales,
    fetchMoreSales,
    searchHistoricalSale,
    hasMoreSales,
    quotes,
    activities,
    productionOrders,
    simulations,
    preAuthorizedAdmins,
    auditLogs,
    users,
    coupons,
    setCoupons,
    financialDocs,
    lastSync,
    refresh,
    metrics,
    exportarCatalogoCSV,
    exportarInsumosCSV,
    fetchInitialAuditLogs,
    fetchMoreAuditLogs,
    hasMoreLogs,
    loadingLogs,
    loadAuditLogs: fetchInitialAuditLogs,
    hasMoreAuditLogs: hasMoreLogs,
    setAuditLogs,
    setLastVisibleLog,
    setHasMoreLogs,
    loadUsersAndPreAuth,
    loadFinancialDocs,
    loadSimulations,
    loadProductionOrders,
    loadCoupons,
    loadAllSales
  };
}
