import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where, getDocs, startAfter, DocumentSnapshot, limit } from 'firebase/firestore';
import { Sale, Customer, RawMaterial, Quote, Activity, FinancialDocument, ProductionOrder, Simulation, PreAuthorizedAdmin, AuditLog, User, Coupon, Product } from '../types';
import { getVariantStock } from '../utils/stockUtils';
import { handleFirestoreError, OperationType } from '../utils/firebaseHelpers';

export function useAdminInventory(isAdmin: boolean, isAuthReady: boolean, products: Product[], rawMaterials: RawMaterial[]) {
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
  const [salesLimit, setSalesLimit] = useState(20);
  const hasFetchedNonCritical = useRef(false);

  const refresh = () => {
    hasFetchedNonCritical.current = false;
    setRefreshTrigger(prev => prev + 1);
  };

  const sales = useMemo(() => {
    const combined = [...realtimeSales, ...historicalSales];
    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
    return unique.sort((a, b) => (b.orderNumber || 0) - (a.orderNumber || 0));
  }, [realtimeSales, historicalSales]);

  useEffect(() => {
    if (!isAuthReady || !isAdmin) {
      // Reset data when not admin
      setCustomers([]);
      setRealtimeSales([]);
      setHistoricalSales([]);
      setQuotes([]);
      setActivities([]);
      setProductionOrders([]);
      setAuditLogs([]);
      setCoupons([]);
      setFinancialDocs([]);
      hasFetchedNonCritical.current = false;
      return;
    }

    // Admin Listeners
    const unsubCoupons = onSnapshot(query(collection(db, 'coupons')), (snapshot) => {
      setCoupons(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Coupon)));
    });

    // Suscripciones con Paginación Estricta para ahorrar lecturas
    const unsubSales = onSnapshot(query(collection(db, 'sales'), orderBy('date', 'desc'), limit(salesLimit)), (snapshot) => {
      const newSales = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
      setRealtimeSales(newSales);
      setHasMoreSales(snapshot.docs.length === salesLimit);
    }, (e) => handleFirestoreError(e, OperationType.GET, 'sales'));

    const unsubCustomers = onSnapshot(query(collection(db, 'customers'), limit(20)), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer)));
    }, (e) => handleFirestoreError(e, OperationType.GET, 'customers'));

    const unsubQuotes = onSnapshot(query(collection(db, 'quotes'), orderBy('date', 'desc'), limit(20)), (snapshot) => {
      setQuotes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote)));
    }, (e) => handleFirestoreError(e, OperationType.GET, 'quotes'));

    const unsubActivities = onSnapshot(query(collection(db, 'activities'), orderBy('createdAt', 'desc'), limit(20)), (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Activity)));
    }, (e) => handleFirestoreError(e, OperationType.GET, 'activities'));

    const unsubOrdersActive = onSnapshot(query(collection(db, 'productionOrders'), where('status', '==', 'pending')), (snapshot) => {
      const activeOrders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductionOrder));
      setProductionOrders(prev => {
        const merged = new Map<string, ProductionOrder>();
        prev.forEach(o => merged.set(o.id, o));
        activeOrders.forEach(o => merged.set(o.id, o));
        return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    });

    const fetchNonCriticalData = async () => {
      if (hasFetchedNonCritical.current) return;
      hasFetchedNonCritical.current = true;

      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

        const auditLogsSnap = await getDocs(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc')));
        setAuditLogs(auditLogsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog)));

        const ordersRecentSnap = await getDocs(query(collection(db, 'productionOrders'), where('createdAt', '>=', thirtyDaysAgoISO), orderBy('createdAt', 'desc')));
        const recentOrders = ordersRecentSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductionOrder));
        setProductionOrders(prev => {
          const merged = new Map<string, ProductionOrder>();
          prev.forEach(o => merged.set(o.id, o));
          recentOrders.forEach(o => merged.set(o.id, o));
          return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });

        const usersSnap = await getDocs(query(collection(db, 'users')));
        setUsers(usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as User)));

        const preAuthSnap = await getDocs(collection(db, 'preAuthorizedAdmins'));
        setPreAuthorizedAdmins(preAuthSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as PreAuthorizedAdmin)));

        const financialDocsSnap = await getDocs(query(collection(db, 'financialDocs')));
        setFinancialDocs(financialDocsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FinancialDocument)));

        const simulationsSnap = await getDocs(query(collection(db, 'simulations')));
        setSimulations(simulationsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Simulation)));

        setLastSync(new Date());
      } catch (e) {
        console.warn("Error fetching non-critical data:", e);
      }
    };

    fetchNonCriticalData();

    return () => {
      unsubCoupons();
      unsubSales();
      unsubCustomers();
      unsubQuotes();
      unsubActivities();
      unsubOrdersActive();
    };
  }, [isAuthReady, isAdmin, refreshTrigger, salesLimit]);

  const fetchMoreSales = () => {
    setSalesLimit(prev => prev + 20);
  };

  const searchHistoricalSale = async (searchQuery: string) => {
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
        // Inyectamos el pedido encontrado en el estado actual de ventas en pantalla
        setRealtimeSales(prev => {
          const current = [...prev];
          foundSales.forEach(fs => {
            if (!current.some(s => s.id === fs.id)) current.push(fs);
          });
          // Re-ordenamos para que el pedido buscado quede acomodado correctamente por fecha
          return current.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error en búsqueda histórica:", error);
      return false;
    }
  };

  const metrics = useMemo(() => {
    if (!isAdmin) return null;

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

    const validSales = sales.filter(s => s.status !== 'cancelado');
    let grossProfit = 0;
    let netProfit = 0;
    let totalRevenue = 0;
    let totalPendingPayment = 0;
    const revenueByMethod = { efectivo: 0, transferencia: 0, tarjeta: 0, mixto: 0 };

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
      totalRevenue += sale.amountPaid;
      totalPendingPayment += (sale.totalAmount - sale.amountPaid);

      const method = sale.paymentMethod === 'efectivo' || !sale.paymentMethod ? 'efectivo' :
        sale.paymentMethod === 'transferencia' ? 'transferencia' :
          sale.paymentMethod === 'tarjeta' ? 'tarjeta' :
            sale.paymentMethod === 'mixto' ? 'mixto' : 'efectivo';

      if (method in revenueByMethod) {
        revenueByMethod[method as keyof typeof revenueByMethod] += sale.amountPaid;
      }
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
      totalPendingPayment,
      projectedRevenue,
      grossProfit,
      netProfit,
      revenueByMethod
    };
  }, [products, rawMaterials, sales, quotes, isAdmin]);

  return {
    customers,
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
    financialDocs,
    lastSync,
    refresh,
    metrics
  };
}
