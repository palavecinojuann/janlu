import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where, getDocs, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { Sale, Customer, RawMaterial, Quote, Activity, FinancialDocument, ProductionOrder, Simulation, PreAuthorizedAdmin, AuditLog, User, Coupon, Product } from '../types';
import { getVariantStock } from '../utils/stockUtils';

export function useAdminInventory(isAdmin: boolean, isAuthReady: boolean, products: Product[]) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [realtimeSales, setRealtimeSales] = useState<Sale[]>([]);
  const [historicalSales, setHistoricalSales] = useState<Sale[]>([]);
  const [hasMoreSales, setHasMoreSales] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
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
      setRawMaterials([]);
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

    const unsubSalesActive = onSnapshot(query(collection(db, 'sales'), orderBy('orderNumber', 'desc')), (snapshot) => {
      const newSales = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
      setRealtimeSales(newSales);
    });

    const unsubRawMaterials = onSnapshot(query(collection(db, 'rawMaterials')), (snapshot) => {
      setRawMaterials(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RawMaterial)));
      console.log("✅ Insumos actualizados (Admin)");
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const unsubQuotesActive = onSnapshot(query(collection(db, 'quotes'), where('validUntil', '>=', todayStr)), (snapshot) => {
      const activeQuotes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote));
      setQuotes(prev => {
        const merged = new Map<string, Quote>();
        prev.forEach(q => merged.set(q.id, q));
        activeQuotes.forEach(q => merged.set(q.id, q));
        return Array.from(merged.values()).sort((a, b) => b.date.localeCompare(a.date));
      });
    });

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

        const customersSnap = await getDocs(query(collection(db, 'customers')));
        setCustomers(customersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer)));

        const quotesRecentSnap = await getDocs(query(collection(db, 'quotes'), where('date', '>=', thirtyDaysAgoStr), orderBy('date', 'desc')));
        const recentQuotes = quotesRecentSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote));
        setQuotes(prev => {
          const merged = new Map<string, Quote>();
          prev.forEach(q => merged.set(q.id, q));
          recentQuotes.forEach(q => merged.set(q.id, q));
          return Array.from(merged.values()).sort((a, b) => b.date.localeCompare(a.date));
        });

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

        const activitiesSnap = await getDocs(query(collection(db, 'activities')));
        setActivities(activitiesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Activity)));

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
      unsubSalesActive();
      unsubRawMaterials();
      unsubQuotesActive();
      unsubOrdersActive();
    };
  }, [isAuthReady, isAdmin, refreshTrigger]);

  const fetchMoreSales = async () => {};

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
    hasMoreSales,
    quotes,
    rawMaterials,
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
