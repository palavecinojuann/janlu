import React, { useState, useMemo } from 'react';
import { DashboardMetrics, Product, Sale, Quote, UserProfile, Customer, RawMaterial, Activity } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Wind, Droplet, Flame, ArrowRightLeft, Download, ShoppingBag, TrendingUp, AlertTriangle, ArrowLeft, Plus, Users, FileText, LayoutGrid, ScanBarcode, DollarSign, Calendar as CalendarIcon, X, Sparkles, ShoppingCart, ArrowUpCircle } from 'lucide-react';
import { getVariantStock } from '../utils/stockUtils';

interface JanluDashboardProps {
  metrics: DashboardMetrics;
  products: Product[];
  rawMaterials: RawMaterial[];
  sales: Sale[];
  quotes: Quote[];
  customers: Customer[];
  activities: Activity[];
  onAddActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;
  onUpdateActivity: (activity: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onAdjustStock: (productId: string, variantId: string, quantity: number) => void;
  onRestockRawMaterial: (id: string, quantity: number, newCost?: number) => void;
  userProfile: UserProfile;
  onNavigateToCatalog: () => void;
  lastSync?: Date;
  onRefresh?: () => void;
  onNavigate: (view: 'products' | 'sales' | 'customers' | 'quotes' | 'finance') => void;
  onGenerateCoupon?: (customerId?: string, percentage?: number, customCode?: string) => Promise<string | undefined | null | any>;
}

const COLORS = ['#f43f5e', '#fbbf24', '#10b981', '#6366f1', '#8b5cf6'];

export default function JanluDashboard({ 
  metrics, 
  products, 
  rawMaterials, 
  sales, 
  quotes, 
  customers, 
  activities,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
  onAdjustStock,
  onRestockRawMaterial,
  userProfile, 
  onNavigateToCatalog,
  lastSync,
  onRefresh,
  onNavigate,
  onGenerateCoupon
}: JanluDashboardProps) {
  const [filter, setFilter] = useState<'all' | 'current_month' | 'current_year'>('all');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [restockItem, setRestockItem] = useState<{ type: 'product' | 'material', id: string, variantId?: string, name: string } | null>(null);
  const [restockQty, setRestockQty] = useState(0);
  const [newActivity, setNewActivity] = useState<Omit<Activity, 'id' | 'createdAt'>>({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    type: 'other',
    status: 'pending'
  });

  const validSales = useMemo(() => sales.filter(s => s.status !== 'cancelado'), [sales]);

  const filteredSales = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return validSales.filter(sale => {
      const saleDate = new Date(sale.date);
      const isCurrentMonth = saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
      const isCurrentYear = saleDate.getFullYear() === currentYear;

      switch (filter) {
        case 'current_month': return isCurrentMonth;
        case 'current_year': return isCurrentYear;
        case 'all':
        default: return true;
      }
    });
  }, [validSales, filter]);

  const filteredRevenue = filteredSales.reduce((acc, s) => acc + s.amountPaid, 0);
  const pendingFromSales = filteredSales.reduce((acc, s) => acc + (s.totalAmount - s.amountPaid), 0);

  const todaySales = useMemo(() => {
    const today = new Date();
    return validSales.filter(s => {
      const d = new Date(s.date);
      return d.getDate() === today.getDate() && 
             d.getMonth() === today.getMonth() && 
             d.getFullYear() === today.getFullYear();
    });
  }, [validSales]);

  const todayActivities = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return activities
      .filter(a => a.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [activities]);

  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const parseLocalDate = (dateStr: string) => {
      if (!dateStr) return new Date();
      const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    return customers
      .filter(c => {
        if (!c.birthDate) return false;
        const bday = parseLocalDate(c.birthDate);
        const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        const bdayNextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
        
        return (bdayThisYear >= today && bdayThisYear <= nextWeek) || 
               (bdayNextYear >= today && bdayNextYear <= nextWeek);
      })
      .sort((a, b) => {
        const bdayA = parseLocalDate(a.birthDate!);
        const bdayB = parseLocalDate(b.birthDate!);
        return bdayA.getMonth() - bdayB.getMonth() || bdayA.getDate() - bdayB.getDate();
      });
  }, [customers]);

  const handleSendBirthdayWpp = async (customer: Customer) => {
    // 1. Preguntamos el porcentaje (por defecto 20)
    const input = prompt(`¿Qué % de descuento deseas darle a ${customer.name}?`, '20');
    if (!input) return; // Si cancela, abortamos
    
    const discount = parseInt(input, 10) || 20;

    try {
      // 2. Generamos el cupón con ese porcentaje
      const code = onGenerateCoupon ? await onGenerateCoupon(customer.id, discount) : null;
      const couponText = code ? code : `CUMPLE-${discount}`;
      
      // 3. Armamos el mensaje dinámico
      const message = `¡Hola ${customer.name}! 🎂✨ Desde Janlu Velas te deseamos un muy feliz cumpleaños. Queremos celebrarlo con vos, así que te preparamos este regalo especial: un ${discount}% de DESCUENTO en tu próxima compra usando el código *${couponText}* en nuestra tienda web.\n\n¡Esperamos que tengas un día increíble! 🕯️💖`;
      
      const phone = customer.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      console.error('Error generando cupón:', error);
      alert('Error al generar el cupón.');
    }
  };

  const todayRevenue = todaySales.reduce((acc, s) => acc + s.amountPaid, 0);

  const pendingQuotes = quotes.filter(q => new Date(q.validUntil) >= new Date()).length + 
                         sales.filter(s => s.status === 'presupuesto').length;
  const totalCustomers = customers.length;

  const currentDate = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedDate = currentDate.charAt(0).toUpperCase() + currentDate.slice(1);

 const dailyRevenue = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
      const daySales = validSales.filter(s => {
        const sd = new Date(s.date);
        return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      });
      const revenue = daySales.reduce((acc, s) => acc + s.amountPaid, 0);
      data.push({ name: dayName, revenue });
    }
    return data;
  }, [validSales]);

  const { revenueGrowth, profitGrowth, ticketGrowth, currentProfit } = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);

    const last7DaysSales = validSales.filter(s => new Date(s.date) >= sevenDaysAgo);
    const prev7DaysSales = validSales.filter(s => {
      const d = new Date(s.date);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });

    const last7Revenue = last7DaysSales.reduce((acc, s) => acc + s.amountPaid, 0);
    const prev7Revenue = prev7DaysSales.reduce((acc, s) => acc + s.amountPaid, 0);

    const calculateProfit = (salesList: Sale[]) => {
      return salesList.reduce((acc, sale) => {
        const saleCost = sale.items.reduce((itemAcc, item) => {
          const product = products.find(p => p.id === item.productId);
          const variant = product?.variants.find(v => v.id === item.variantId);
          return itemAcc + ((variant?.cost || 0) * item.quantity);
        }, 0);
        return acc + (sale.amountPaid - saleCost);
      }, 0);
    };

    const last7Profit = calculateProfit(last7DaysSales);
    const prev7Profit = calculateProfit(prev7DaysSales);

    const last7Ticket = last7DaysSales.length > 0 ? last7Revenue / last7DaysSales.length : 0;
    const prev7Ticket = prev7DaysSales.length > 0 ? prev7Revenue / prev7DaysSales.length : 0;

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      revenueGrowth: calculateGrowth(last7Revenue, prev7Revenue),
      profitGrowth: calculateGrowth(last7Profit, prev7Profit),
      ticketGrowth: calculateGrowth(last7Ticket, prev7Ticket),
      currentProfit: calculateProfit(filteredSales)
    };
  }, [validSales, products, filteredSales]);

  const averageOrder = filteredSales.length > 0 ? filteredRevenue / filteredSales.length : 0;
  const quotationsCount = quotes.length;
  const ordersCount = validSales.length;
  
  const stockValue = useMemo(() => {
    const productsStockValue = products.reduce((acc, p) => 
      acc + p.variants.reduce((sum, v) => 
        sum + (v.isFinishedGood !== false ? v.stock * (v.cost || 0) : 0), 0
      ), 0
    );
    const rawMaterialsStockValue = rawMaterials.reduce((acc, rm) => 
      acc + (rm.stock * (rm.costPerUnit || 0)), 0
    );
    return productsStockValue + rawMaterialsStockValue;
  }, [products, rawMaterials]);

  // Prepare data for charts
  const stockByCategory = products.reduce((acc, product) => {
    const category = product.category || 'Sin Categoría';
    const stock = product.variants.reduce((sum, v) => sum + getVariantStock(v, rawMaterials), 0);
    acc[category] = (acc[category] || 0) + stock;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(stockByCategory).map(([name, value]) => ({ name, value }));

  const topProducts = [...products]
    .map(p => ({
      id: p.id,
      name: p.name,
      stock: p.variants.reduce((sum, v) => sum + getVariantStock(v, rawMaterials), 0),
      value: p.variants.reduce((sum, v) => sum + (getVariantStock(v, rawMaterials) * v.price), 0)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Calculate Product Movements (last 30 days)
  const productMovements = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Egresos (Sales)
    const recentSales = validSales.filter(s => new Date(s.date) >= thirtyDaysAgo);
    const egresos = recentSales.reduce((acc, sale) => {
      sale.items.forEach(item => {
        acc += item.quantity;
      });
      return acc;
    }, 0);

    // Ingresos (New products created in last 30 days - simplified assumption for now)
    const ingresos = products.reduce((acc, p) => {
      if (new Date(p.createdAt) >= thirtyDaysAgo) {
        acc += p.variants.reduce((sum, v) => sum + getVariantStock(v, rawMaterials), 0);
      }
      return acc;
    }, 0);

    return { ingresos, egresos };
  }, [validSales, products]);

  // Calculate Raw Material Movements (last 30 days)
  const rawMaterialMovements = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Ingresos (New materials created or updated recently - simplified)
    const ingresos = rawMaterials.reduce((acc, rm) => {
      if (new Date(rm.updatedAt) >= thirtyDaysAgo) {
        // Assuming current stock is roughly what came in if recently updated
        // In a real app, you'd track specific restock events
        acc += rm.stock; 
      }
      return acc;
    }, 0);

    // Egresos (Estimated based on sales and recipes - simplified)
    let egresos = 0;
    const recentSales = validSales.filter(s => new Date(s.date) >= thirtyDaysAgo);
    recentSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const variant = product?.variants.find(v => v.id === item.variantId);
        if (variant?.recipe) {
          variant.recipe.forEach(ri => {
            egresos += (ri.quantity * item.quantity);
          });
        }
      });
    });

    return { ingresos, egresos };
  }, [validSales, products, rawMaterials]);

  const lowStockItems = useMemo(() => {
    const lowProducts = products.flatMap(p => 
      p.variants
        .filter(v => getVariantStock(v, rawMaterials) <= 5)
        .map(v => ({
          type: 'product' as const,
          id: p.id,
          variantId: v.id,
          name: `${p.name} (${v.name})`,
          stock: getVariantStock(v, rawMaterials),
          unit: 'un'
        }))
    );

    const lowMaterials = rawMaterials
      .filter(m => m.stock <= m.minStock)
      .map(m => ({
        type: 'material' as const,
        id: m.id,
        name: m.name,
        stock: m.stock,
        unit: m.unit
      }));

    return [...lowProducts, ...lowMaterials].sort((a, b) => a.stock - b.stock).slice(0, 6);
  }, [products, rawMaterials]);

  const handleQuickRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;

    if (restockItem.type === 'product' && restockItem.variantId) {
      onAdjustStock(restockItem.id, restockItem.variantId, restockQty);
    } else if (restockItem.type === 'material') {
      onRestockRawMaterial(restockItem.id, restockQty);
    }

    setRestockItem(null);
    setRestockQty(0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const AppIcon = ({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) => (
    <div onClick={onClick} className="flex flex-col items-center gap-2 cursor-pointer group">
      <div className={`w-16 h-16 rounded-2xl ${color} text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}>
        {React.cloneElement(icon as React.ReactElement, { size: 28 })}
      </div>
      <span className="text-xs font-medium text-stone-600 text-center">{label}</span>
    </div>
  );

  const StatCard = ({ title, value, trend }: { title: string, value: string | number, trend?: { value: string, isPositive: boolean } }) => (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm text-center">
      <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-2 font-bold">{title}</p>
      <p className="text-3xl font-bold text-stone-950 mb-2">{value}</p>
      {trend && (
        <p className={`text-[10px] font-bold uppercase tracking-wider ${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend.isPositive ? '↑' : '↓'} {trend.value}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto min-h-0 font-sans bg-[#faf9f8] p-4 md:p-8 rounded-3xl relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <button 
            onClick={() => setShowCalendar(true)}
            className="flex items-center gap-2 text-stone-400 hover:text-stone-600 transition-colors mb-1"
          >
            <CalendarIcon size={12} />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">{formattedDate}</span>
          </button>
          <div className="flex items-baseline gap-3">
            <h2 className="text-3xl font-serif font-bold text-stone-900 tracking-tight">Dashboard</h2>
            <span className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium">Janlu Velas</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {lastSync && onRefresh && (
            <button 
              onClick={onRefresh}
              className="p-2 rounded-full text-stone-400 hover:text-stone-600 transition-colors bg-white shadow-sm border border-stone-100"
              title="Sincronizar ahora"
            >
              <ArrowRightLeft size={14} />
            </button>
          )}
          <select
            className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-900 shadow-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'current_month' | 'current_year')}
          >
            <option value="all">Histórico</option>
            <option value="current_month">Mes Actual</option>
            <option value="current_year">Año Actual</option>
          </select>
        </div>
      </div>

      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100/50">
          <p className="text-[10px] font-serif italic text-stone-500 uppercase tracking-widest mb-3">Ventas de Hoy</p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-sans font-bold text-stone-900">{formatCurrency(todayRevenue)}</h3>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">{todaySales.length} op.</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100/50">
          <p className="text-[10px] font-serif italic text-stone-500 uppercase tracking-widest mb-3">Presupuestos Activos</p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-sans font-bold text-stone-900">{pendingQuotes}</h3>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">pendientes</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100/50">
          <p className="text-[10px] font-serif italic text-stone-500 uppercase tracking-widest mb-3">Ingresos del Período</p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-sans font-bold text-stone-900">{formatCurrency(filteredRevenue)}</h3>
            <div className={`flex items-center gap-1 text-[10px] font-bold ${revenueGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(revenueGrowth).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-4 mb-10">
        <button 
          onClick={() => onNavigate('sales')}
          className="px-6 py-2.5 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-stone-800 transition-all shadow-md shadow-stone-900/10 flex items-center gap-2"
        >
          <Plus size={14} />
          Registrar Nueva Venta
        </button>
        <button 
          onClick={() => onNavigate('products')}
          className="px-6 py-2.5 bg-white text-stone-600 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-stone-50 transition-all flex items-center gap-2"
        >
          <LayoutGrid size={14} />
          Gestionar Inventario
        </button>
        <button 
          onClick={() => onNavigate('customers')}
          className="px-6 py-2.5 bg-white text-stone-600 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-stone-50 transition-all flex items-center gap-2"
        >
          <Users size={14} />
          Ver Clientes
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Charts, Activity, and Stock Summary */}
        <div className="lg:col-span-2 space-y-8">
          {/* Revenue Chart */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100/50">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-serif font-bold text-stone-900">Evolución de Ingresos</h3>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-stone-900"></div>
                  <span>Ventas</span>
                </div>
              </div>
            </div>
            <div className="h-72 w-full min-h-[288px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={288}>
                <LineChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a8a29e', fontSize: 9, fontWeight: 'bold' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a8a29e', fontSize: 9, fontWeight: 'bold' }} 
                    tickFormatter={(val) => `$${val/1000}k`} 
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', 
                      padding: '12px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#1c1917" 
                    strokeWidth={2.5} 
                    dot={{ r: 3, fill: '#1c1917', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 5 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity & Agenda Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Recent Sales */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100/50">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-serif font-bold text-stone-900">Últimas Ventas</h3>
                <button 
                  onClick={() => onNavigate('sales')}
                  className="text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:text-stone-900 transition-colors"
                >
                  Ver todas
                </button>
              </div>
              <div className="space-y-4">
                {validSales.slice(0, 5).map(sale => (
                  <div key={sale.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center text-stone-400">
                        <DollarSign size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-stone-800">Venta #{sale.id.slice(-4)}</p>
                        <p className="text-[10px] text-stone-400 uppercase tracking-widest">
                          {new Date(sale.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-stone-900">{formatCurrency(sale.totalAmount)}</p>
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${
                        sale.status === 'completado' ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {sale.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agenda Section */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100/50">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-serif font-bold text-stone-900">Agenda</h3>
                <button 
                  onClick={() => setShowCalendar(true)}
                  className="text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:text-stone-900 transition-colors"
                >
                  Calendario
                </button>
              </div>
              {todayActivities.length > 0 ? (
                <div className="space-y-1">
                  {todayActivities.map(activity => (
                    <div key={activity.id} className="py-3 flex gap-4 items-center group border-b border-stone-50 last:border-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        activity.type === 'inventory' ? 'bg-emerald-400' :
                        activity.type === 'quote' ? 'bg-amber-400' :
                        activity.type === 'delivery' ? 'bg-rose-400' : 'bg-stone-300'
                      }`}></div>
                      <div className="flex-1 flex items-center justify-between">
                        <p className={`text-sm ${activity.status === 'completed' ? 'line-through text-stone-300' : 'text-stone-700'}`}>
                          {activity.title}
                        </p>
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{activity.time} hs</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center border border-dashed border-stone-100 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Sin actividades hoy</p>
                </div>
              )}
            </div>
          </div>

          {/* Stock & Distribution Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Products Summary */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100/50 flex flex-col">
              <h3 className="text-lg font-serif font-bold text-stone-900 mb-8">Productos</h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-1">Valor en stock</p>
                    <p className="text-2xl font-bold text-stone-950">{formatCurrency(stockValue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-1">Registrados</p>
                    <p className="text-2xl font-bold text-stone-950">{products.length}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Entradas</p>
                    <p className="text-lg font-bold text-emerald-700">+{productMovements.ingresos}</p>
                  </div>
                  <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50">
                    <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mb-1">Salidas</p>
                    <p className="text-lg font-bold text-rose-700">-{productMovements.egresos}</p>
                  </div>
                </div>

                <button 
                  onClick={() => onNavigate('products')}
                  className="w-full py-3 bg-stone-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all"
                >
                  Gestionar Productos
                </button>
              </div>
            </div>

            {/* Distribution Chart */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100/50">
              <h3 className="text-lg font-serif font-bold text-stone-900 mb-6">Distribución</h3>
              <div className="h-48 w-full min-h-[192px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={192}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${value} unid.`, 'Stock']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {pieData.slice(0, 4).map((entry, index) => (
                  <div key={entry.name} className="flex items-center text-[9px] font-bold uppercase tracking-widest text-stone-400">
                    <div 
                      className="w-1.5 h-1.5 rounded-full mr-1.5" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Products Section */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100/50">
            <h3 className="text-lg font-serif font-bold text-stone-900 mb-8">Productos Estrella</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-4 rounded-2xl bg-stone-50/30 border border-stone-100/50 group transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xs font-bold text-stone-400 border border-stone-100 shadow-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-stone-900">{product.name}</p>
                      <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-0.5">{product.stock} unidades</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-stone-950 text-sm">{formatCurrency(product.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Alerts and Birthdays */}
        <div className="space-y-8">
          {/* Birthdays Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100/50">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-serif font-bold text-stone-900">Cumpleaños</h3>
              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Próx. 7 días</span>
            </div>
            {upcomingBirthdays.length > 0 ? (
              <div className="space-y-6">
                {upcomingBirthdays.map(customer => {
                  const parseLocalDate = (dateStr: string) => {
                    if (!dateStr) return new Date();
                    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
                    return new Date(year, month - 1, day);
                  };

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const bday = parseLocalDate(customer.birthDate!);
                  let nextBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                  if (nextBday < today) {
                    nextBday.setFullYear(today.getFullYear() + 1);
                  }
                  const diffTime = nextBday.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  const isToday = diffDays === 0;
                  
                  return (
                    <div key={customer.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border ${
                          isToday ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-stone-50 border-stone-100 text-stone-400'
                        }`}>
                          {customer.name.charAt(0)}{customer.surname?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-stone-900">
                            {customer.name} {customer.surname}
                          </p>
                          <p className="text-[9px] uppercase tracking-widest text-stone-400 mt-0.5">
                            {bday.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                            {isToday && <span className="ml-2 text-amber-600 font-bold italic">¡Hoy!</span>}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleSendBirthdayWpp(customer)}
                        className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                        title="Enviar saludo"
                      >
                        <ShoppingCart size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold text-center py-4">Sin cumpleaños próximos</p>
            )}
          </div>

          {/* Stock Alerts Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100/50">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-serif font-bold text-stone-900">Alertas de Stock</h3>
              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Crítico</span>
            </div>
            {lowStockItems.length > 0 ? (
              <div className="space-y-4">
                {lowStockItems.map((item) => (
                  <div key={`${item.type}-${item.id}${item.variantId ? `-${item.variantId}` : ''}`} className="flex items-center justify-between p-3 rounded-xl bg-stone-50/50 border border-stone-100 group">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-stone-700 truncate max-w-[120px]">{item.name}</span>
                      <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">{item.stock} {item.unit}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setRestockItem({
                          type: item.type,
                          id: item.id,
                          variantId: item.variantId,
                          name: item.name
                        });
                        setRestockQty(0);
                      }}
                      className="p-1.5 text-stone-400 hover:text-stone-900 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => onNavigate('products')}
                  className="w-full mt-2 py-2 text-[9px] font-bold text-stone-400 uppercase tracking-[0.2em] hover:text-stone-900 transition-colors border-t border-stone-50 pt-4"
                >
                  Ver inventario completo
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Stock al día ✨</p>
              </div>
            )}
          </div>

          {/* Insumos Summary Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100/50 flex flex-col">
            <h3 className="text-lg font-serif font-bold text-stone-900 mb-8">Insumos</h3>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-1">Registrados</p>
                  <p className="text-2xl font-bold text-stone-950">{rawMaterials.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-1">Alertas</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {rawMaterials.filter(rm => rm.stock <= rm.minStock).length}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Entradas</p>
                  <p className="text-lg font-bold text-emerald-700">+{rawMaterialMovements.ingresos.toFixed(0)}</p>
                </div>
                <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50">
                  <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mb-1">Salidas</p>
                  <p className="text-lg font-bold text-rose-700">-{rawMaterialMovements.egresos.toFixed(0)}</p>
                </div>
              </div>

              <button 
                onClick={() => onNavigate('products')}
                className="w-full py-3 bg-stone-50 text-stone-600 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-100 transition-all"
              >
                Gestionar Insumos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-stone-200 animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <h3 className="font-serif font-bold text-stone-900 text-xl">Reponer Stock</h3>
              <button onClick={() => setRestockItem(null)} className="text-stone-400 hover:text-stone-900 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleQuickRestock} className="p-8 space-y-6">
              <div>
                <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-2">Sumar unidades a:</p>
                <p className="text-lg font-bold text-stone-900">{restockItem.name}</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3">Cantidad a Agregar</label>
                <input 
                  type="number" 
                  autoFocus
                  required 
                  value={restockQty || ''} 
                  onChange={e => setRestockQty(parseFloat(e.target.value))}
                  className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-stone-900 text-2xl font-bold text-stone-900"
                  placeholder="0"
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-stone-900 text-white font-bold py-5 rounded-2xl hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20 text-[10px] uppercase tracking-widest"
              >
                Confirmar Ingreso
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendar && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-stone-200">
            <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white text-stone-900 flex items-center justify-center border border-stone-100 shadow-sm">
                  <CalendarIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-stone-900">Calendario</h3>
                  <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mt-1">{formattedDate}</p>
                </div>
              </div>
              <button onClick={() => { setShowCalendar(false); setShowActivityForm(false); }} className="text-stone-400 hover:text-stone-900 p-2 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              {showActivityForm ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-6">Nueva Actividad</h4>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2">Título</label>
                      <input 
                        type="text" 
                        value={newActivity.title}
                        onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                        className="w-full px-5 py-3 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-stone-900 outline-none font-medium"
                        placeholder="Ej: Entrega de pedido #123"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2">Descripción</label>
                      <textarea 
                        value={newActivity.description}
                        onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                        className="w-full px-5 py-3 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-stone-900 outline-none h-24 font-medium"
                        placeholder="Detalles de la actividad..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2">Fecha</label>
                        <input 
                          type="date" 
                          value={newActivity.date}
                          onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
                          className="w-full px-5 py-3 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-stone-900 outline-none font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2">Hora</label>
                        <input 
                          type="time" 
                          value={newActivity.time}
                          onChange={(e) => setNewActivity({ ...newActivity, time: e.target.value })}
                          className="w-full px-5 py-3 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-stone-900 outline-none font-medium"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2">Tipo</label>
                      <select 
                        value={newActivity.type}
                        onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value as 'inventory' | 'quote' | 'delivery' | 'other' })}
                        className="w-full px-5 py-3 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-stone-900 outline-none font-medium appearance-none"
                      >
                        <option value="inventory">Inventario</option>
                        <option value="quote">Presupuesto</option>
                        <option value="delivery">Entrega</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-6">
                    <button 
                      onClick={() => setShowActivityForm(false)}
                      className="flex-1 py-4 px-4 bg-stone-50 text-stone-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-100 transition-colors border border-stone-100"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => {
                        onAddActivity(newActivity);
                        setShowActivityForm(false);
                        setNewActivity({
                          title: '',
                          description: '',
                          date: new Date().toISOString().split('T')[0],
                          time: '12:00',
                          type: 'other',
                          status: 'pending'
                        });
                      }}
                      disabled={!newActivity.title || !newActivity.date}
                      className="flex-1 py-4 px-4 bg-stone-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-stone-900/10"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-6">Compromisos y Actividades</h4>
                  <div className="space-y-4 divide-y divide-stone-100">
                    {activities.length > 0 ? (
                      activities
                        .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
                        .map((activity) => (
                          <div key={activity.id} className={`pt-4 first:pt-0 flex gap-5 items-start relative group ${activity.status === 'completed' ? 'opacity-50' : ''}`}>
                            <div className={`w-2.5 h-2.5 mt-2 rounded-full shrink-0 ${
                              activity.type === 'inventory' ? 'bg-emerald-500' :
                              activity.type === 'quote' ? 'bg-amber-500' :
                              activity.type === 'delivery' ? 'bg-rose-500' : 'bg-stone-300'
                            }`}></div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <p className={`font-bold text-sm ${activity.status === 'completed' ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                                  {activity.title}
                                </p>
                                <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onUpdateActivity({ ...activity, status: activity.status === 'completed' ? 'pending' : 'completed' }); }}
                                    className="p-1.5 bg-stone-50 rounded-lg text-stone-400 hover:text-stone-900 border border-stone-100"
                                    title={activity.status === 'completed' ? 'Marcar como pendiente' : 'Marcar como completada'}
                                  >
                                    <Sparkles size={12} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteActivity(activity.id); }}
                                    className="p-1.5 bg-stone-50 rounded-lg text-stone-400 hover:text-rose-600 border border-stone-100"
                                    title="Eliminar"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-stone-500 mt-1 leading-relaxed">{activity.description}</p>
                              <div className="flex items-center gap-3 mt-3">
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                  activity.status === 'completed' ? 'bg-stone-50 text-stone-400 border-stone-100' :
                                  activity.type === 'inventory' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                  activity.type === 'quote' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                  activity.type === 'delivery' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-stone-50 text-stone-500 border-stone-100'
                                }`}>
                                  {activity.type}
                                </span>
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                  {new Date(activity.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}, {activity.time} hs
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">No hay actividades programadas</p>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setShowActivityForm(true)}
                    className="w-full mt-8 py-4 bg-stone-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10"
                  >
                    <Plus size={16} /> Agregar Actividad
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
