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
  const [auditLogsLimit, setAuditLogsLimit] = useState(50);
  const [hasMoreAuditLogs, setHasMoreAuditLogs] = useState(false);
  const hasFetchedAuditLogs = useRef(false);
  const hasFetchedUsers = useRef(false);
  const hasFetchedFinance = useRef(false);
  const hasFetchedSimulations = useRef(false);
  const hasFetchedRecentOrders = useRef(false);
  const hasFetchedCoupons = useRef(false);
  
  const adminListenersMounted = useRef(false);
  const unsubCustomersRef = useRef<(() => void) | null>(null);
  const unsubQuotesRef = useRef<(() => void) | null>(null);
  const unsubActivitiesRef = useRef<(() => void) | null>(null);
  const unsubOrdersActiveRef = useRef<(() => void) | null>(null);
  const unsubSalesRef = useRef<(() => void) | null>(null);

  const cleanupAllListeners = () => {
    if (unsubCustomersRef.current) { unsubCustomersRef.current(); unsubCustomersRef.current = null; }
    if (unsubQuotesRef.current) { unsubQuotesRef.current(); unsubQuotesRef.current = null; }
    if (unsubActivitiesRef.current) { unsubActivitiesRef.current(); unsubActivitiesRef.current = null; }
    if (unsubOrdersActiveRef.current) { unsubOrdersActiveRef.current(); unsubOrdersActiveRef.current = null; }
    if (unsubSalesRef.current) { unsubSalesRef.current(); unsubSalesRef.current = null; }
    adminListenersMounted.current = false;
    hasFetchedCoupons.current = false;
  };

  const refresh = () => {
    hasFetchedAuditLogs.current = false;
    hasFetchedUsers.current = false;
    hasFetchedFinance.current = false;
    hasFetchedSimulations.current = false;
    hasFetchedRecentOrders.current = false;
    hasFetchedCoupons.current = false;
    setAuditLogsLimit(50);
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
      setAuditLogsLimit(50);
      setHasMoreAuditLogs(false);
      cleanupAllListeners();
      hasFetchedAuditLogs.current = false;
      hasFetchedUsers.current = false;
      hasFetchedFinance.current = false;
      hasFetchedSimulations.current = false;
      hasFetchedRecentOrders.current = false;
      hasFetchedCoupons.current = false;
      return;
    }

    // Admin Listeners (se suscriben una única vez por sesión)
    if (!adminListenersMounted.current) {
      adminListenersMounted.current = true;

      unsubCustomersRef.current = onSnapshot(query(collection(db, 'customers'), limit(20)), (snapshot) => {
        setCustomers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer)));
      }, (e) => handleFirestoreError(e, OperationType.GET, 'customers'));

      unsubQuotesRef.current = onSnapshot(query(collection(db, 'quotes'), orderBy('date', 'desc'), limit(20)), (snapshot) => {
        setQuotes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Quote)));
      }, (e) => handleFirestoreError(e, OperationType.GET, 'quotes'));

      unsubActivitiesRef.current = onSnapshot(query(collection(db, 'activities'), orderBy('createdAt', 'desc'), limit(20)), (snapshot) => {
        setActivities(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Activity)));
      }, (e) => handleFirestoreError(e, OperationType.GET, 'activities'));

      unsubOrdersActiveRef.current = onSnapshot(query(collection(db, 'productionOrders'), where('status', '==', 'pending')), (snapshot) => {
        const activeOrders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductionOrder));
        setProductionOrders(prev => {
          const merged = new Map<string, ProductionOrder>();
          prev.forEach(o => merged.set(o.id, o));
          activeOrders.forEach(o => merged.set(o.id, o));
          return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      });
    }

    // Suscripción con Paginación de Ventas (se recrea al cambiar salesLimit o refreshTrigger)
    if (unsubSalesRef.current) {
      unsubSalesRef.current();
    }
    unsubSalesRef.current = onSnapshot(query(collection(db, 'sales'), orderBy('date', 'desc'), limit(salesLimit)), (snapshot) => {
      const newSales = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
      setRealtimeSales(newSales);
      setHasMoreSales(snapshot.docs.length === salesLimit);
    }, (e) => handleFirestoreError(e, OperationType.GET, 'sales'));

    return () => {
      // El desmontaje real lo maneja el efecto dedicado para evitar limpiar suscripciones válidas en renders efímeros
    };
  }, [isAuthReady, isAdmin, refreshTrigger, salesLimit]);

  // Limpieza total de listeners al desmontar el hook de inventario
  useEffect(() => {
    return () => {
      cleanupAllListeners();
    };
  }, []);

  const loadAuditLogs = async (customLimit?: number) => {
    if (!isAdmin) return;
    const currentLimit = customLimit || auditLogsLimit;
    try {
      const auditLogsSnap = await getDocs(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(currentLimit)));
      const fetchedLogs = auditLogsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog));
      setAuditLogs(fetchedLogs);
      setHasMoreAuditLogs(fetchedLogs.length === currentLimit);
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching audit logs:", e);
    }
  };

  const fetchMoreAuditLogs = () => {
    const nextLimit = auditLogsLimit + 50;
    setAuditLogsLimit(nextLimit);
    loadAuditLogs(nextLimit);
  };

  const loadCoupons = async () => {
    if (!isAdmin || hasFetchedCoupons.current) return;
    hasFetchedCoupons.current = true;
    try {
      const couponsSnap = await getDocs(query(collection(db, 'coupons')));
      setCoupons(couponsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Coupon)));
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching coupons:", e);
      hasFetchedCoupons.current = false;
    }
  };

  const loadUsersAndPreAuth = async () => {
    if (!isAdmin || hasFetchedUsers.current) return;
    hasFetchedUsers.current = true;
    try {
      const usersSnap = await getDocs(query(collection(db, 'users')));
      setUsers(usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as User)));

      const preAuthSnap = await getDocs(collection(db, 'preAuthorizedAdmins'));
      setPreAuthorizedAdmins(preAuthSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as PreAuthorizedAdmin)));
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching users:", e);
      hasFetchedUsers.current = false;
    }
  };

  const loadFinancialDocs = async () => {
    if (!isAdmin || hasFetchedFinance.current) return;
    hasFetchedFinance.current = true;
    try {
      const financialDocsSnap = await getDocs(query(collection(db, 'financialDocs')));
      setFinancialDocs(financialDocsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FinancialDocument)));
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching financial docs:", e);
      hasFetchedFinance.current = false;
    }
  };

  const loadSimulations = async () => {
    if (!isAdmin || hasFetchedSimulations.current) return;
    hasFetchedSimulations.current = true;
    try {
      const simulationsSnap = await getDocs(query(collection(db, 'simulations')));
      setSimulations(simulationsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Simulation)));
      setLastSync(new Date());
    } catch (e) {
      console.warn("Error fetching simulations:", e);
      hasFetchedSimulations.current = false;
    }
  };

  const loadProductionOrders = async () => {
    if (!isAdmin || hasFetchedRecentOrders.current) return;
    hasFetchedRecentOrders.current = true;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

      const ordersRecentSnap = await getDocs(query(collection(db, 'productionOrders'), where('createdAt', '>=', thirtyDaysAgoISO), orderBy('createdAt', 'desc')));
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
  };

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
  }, [products, rawMaterials, sales, quotes, isAdmin]);

  const exportarCatalogoCSV = () => {
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
  };

  const exportarInsumosCSV = () => {
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
  };

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
    setCoupons,
    financialDocs,
    lastSync,
    refresh,
    metrics,
    exportarCatalogoCSV,
    exportarInsumosCSV,
    loadAuditLogs,
    fetchMoreAuditLogs,
    hasMoreAuditLogs,
    loadUsersAndPreAuth,
    loadFinancialDocs,
    loadSimulations,
    loadProductionOrders,
    loadCoupons
  };
}
